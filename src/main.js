import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { newBoard, columnHeight, isBoardFull, SIZE } from './game/board.js';
import { checkWin } from './game/check-win.js';
import { screenDirToBoardDir } from './game/screen-dir.js';

/* ============================================================
   遊戲邏輯
   ============================================================ */
const SPACING = 1.2;
const BEAD_R = 0.45;
const POLE_R = 0.06;
const POLE_H = SIZE * SPACING * 0.95;

// 棋盤垂直範圍：底座底面 y=-BASE_THICKNESS（局部）→ 柱頂 y=POLE_H（局部）
// 為了讓整個棋盤的「幾何中點」落在世界原點 (0,0,0)，需把 boardGroup 下移此中點值
const BASE_THICKNESS = 0.25;
const BOARD_MIN_Y = -BASE_THICKNESS; // 底座底面（局部座標）
const BOARD_MAX_Y = POLE_H; // 柱頂（局部座標）
const BOARD_VISUAL_CENTER = (BOARD_MIN_Y + BOARD_MAX_Y) / 2; // 真正幾何中點

let board, currentPlayer, moveHistory, gameOver, scores;
let selected = null; // 鍵盤選取的格子 {x, z}，null 表示未啟用

/* ============================================================
   Three.js
   ============================================================ */
const wrap = document.getElementById('canvas-wrap');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf5efe4);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
wrap.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xfff5e8, 0.7));
const keyLight = new THREE.DirectionalLight(0xfff2dc, 0.9);
keyLight.position.set(6, 12, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -10;
keyLight.shadow.camera.right = 10;
keyLight.shadow.camera.top = 10;
keyLight.shadow.camera.bottom = -10;
keyLight.shadow.bias = -0.0005;
keyLight.shadow.radius = 4;
scene.add(keyLight);

// 補光：稍微帶一點冷色，模擬天光
const fillLight = new THREE.DirectionalLight(0xc8d6e0, 0.35);
fillLight.position.set(-5, 6, -3);
scene.add(fillLight);

// 半球光：地面反射的暖色補光
const hemi = new THREE.HemisphereLight(0xfff5e8, 0xb8a07a, 0.4);
scene.add(hemi);

// 地板：淺木桌面
const FLOOR_Y = -BOARD_VISUAL_CENTER - 0.4;
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({
    color: 0xe8d9bf,
    roughness: 0.85,
    metalness: 0,
  })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = FLOOR_Y;
floor.receiveShadow = true;
scene.add(floor);

// 細格線：很淡的木紋暗示
const grid = new THREE.GridHelper(20, 20, 0xc8b394, 0xd4c4a8);
grid.position.y = FLOOR_Y + 0.01;
grid.material.transparent = true;
grid.material.opacity = 0.35;
scene.add(grid);

/* ============================================================
   棋盤：所有東西放進 boardGroup
   局部座標：底座頂面 = y=0，柱頂 = y=POLE_H
   外層平移：boardGroup.y = -BOARD_VISUAL_CENTER
   結果：整個棋盤的垂直中點落在世界原點 (0,0,0)
   ============================================================ */
const boardGroup = new THREE.Group();
boardGroup.position.y = -BOARD_VISUAL_CENTER;
scene.add(boardGroup);

// 底座：深木色
const baseGeo = new THREE.BoxGeometry(SIZE * SPACING + 0.6, BASE_THICKNESS, SIZE * SPACING + 0.6);
const baseMesh = new THREE.Mesh(
  baseGeo,
  new THREE.MeshStandardMaterial({
    color: 0x8b6f4e, // 中深木色
    roughness: 0.65,
    metalness: 0,
  })
);
baseMesh.position.y = -BASE_THICKNESS / 2;
baseMesh.castShadow = true;
baseMesh.receiveShadow = true;
boardGroup.add(baseMesh);

const edgeLines = new THREE.LineSegments(
  new THREE.EdgesGeometry(baseGeo),
  new THREE.LineBasicMaterial({ color: 0x5a4632, transparent: true, opacity: 0.5 })
);
edgeLines.position.y = -BASE_THICKNESS / 2;
boardGroup.add(edgeLines);

// 柱子
const poles = [];
const poleMat = new THREE.MeshStandardMaterial({
  color: 0xc9a878, // 淺木色
  roughness: 0.7,
  metalness: 0,
});

for (let x = 0; x < SIZE; x++) {
  for (let z = 0; z < SIZE; z++) {
    const px = (x - (SIZE - 1) / 2) * SPACING;
    const pz = (z - (SIZE - 1) / 2) * SPACING;

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(POLE_R, POLE_R, POLE_H, 16), poleMat);
    pole.position.set(px, POLE_H / 2, pz);
    pole.castShadow = true;
    boardGroup.add(pole);

    const hitbox = new THREE.Mesh(
      new THREE.CylinderGeometry(BEAD_R * 0.95, BEAD_R * 0.95, POLE_H, 12),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitbox.position.set(px, POLE_H / 2, pz);
    hitbox.userData = { x, z };
    boardGroup.add(hitbox);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(BEAD_R * 0.85, BEAD_R * 1.05, 32),
      new THREE.MeshBasicMaterial({
        color: 0x8b6f4e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(px, 0.01, pz);
    boardGroup.add(ring);

    poles.push({ mesh: pole, hitbox, x, z, hoverRing: ring });
  }
}

/* === 鍵盤選取游標 === */
// 外環：較大、實色
const cursorOuter = new THREE.Mesh(
  new THREE.RingGeometry(BEAD_R * 1.05, BEAD_R * 1.25, 48),
  new THREE.MeshBasicMaterial({
    color: 0x3d342a,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
  })
);
cursorOuter.rotation.x = -Math.PI / 2;
cursorOuter.position.y = 0.02;
boardGroup.add(cursorOuter);

// 內環：較小、棋色
const cursorInner = new THREE.Mesh(
  new THREE.RingGeometry(BEAD_R * 0.78, BEAD_R * 0.92, 48),
  new THREE.MeshBasicMaterial({
    color: 0xc84238,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0,
  })
);
cursorInner.rotation.x = -Math.PI / 2;
cursorInner.position.y = 0.02;
boardGroup.add(cursorInner);

// 預覽棋珠：半透明，浮在當前柱頂上方
const previewBead = new THREE.Mesh(
  new THREE.SphereGeometry(BEAD_R, 24, 18),
  new THREE.MeshBasicMaterial({
    color: 0xc84238,
    transparent: true,
    opacity: 0,
  })
);
boardGroup.add(previewBead);

const beadMat1 = new THREE.MeshStandardMaterial({
  color: 0xc84238, // 朱紅
  roughness: 0.35,
  metalness: 0.05,
});
const beadMat2 = new THREE.MeshStandardMaterial({
  color: 0x3a7ca5, // 藍青
  roughness: 0.35,
  metalness: 0.05,
});

const beads = [];

/* ============================================================
   視角：OrbitControls（拖拽旋轉、滾輪/雙指縮放、鍵盤微調）
   ============================================================ */

// 預設視角：方位角 45°、仰角 25°、距離 14（與原型一致）
const DEFAULT_AZIMUTH_DEG = 45;
const DEFAULT_POLAR_DEG = 90 - 25; // OrbitControls polar 從 +Y 軸算起
const DEFAULT_RADIUS = 14;

function setInitialCameraPosition() {
  const azimuth = THREE.MathUtils.degToRad(DEFAULT_AZIMUTH_DEG);
  const polar = THREE.MathUtils.degToRad(DEFAULT_POLAR_DEG);
  camera.position.setFromSphericalCoords(DEFAULT_RADIUS, polar, azimuth);
  camera.lookAt(0, 0, 0);
}
setInitialCameraPosition();

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false; // 不允許平移，避免拖出視野
controls.minDistance = 8;
controls.maxDistance = 24;
controls.minPolarAngle = THREE.MathUtils.degToRad(5); // 避免穿透天頂
controls.maxPolarAngle = THREE.MathUtils.degToRad(85); // 避免低於地板水平面
controls.zoomSpeed = 0.6;
controls.rotateSpeed = 0.7;
controls.saveState(); // 記錄初始狀態為 reset 目標

// 拖拽期間關掉 hover ring（避免動到柱子的 hover 提示）
let isDraggingView = false;
controls.addEventListener('start', () => {
  isDraggingView = true;
});
controls.addEventListener('end', () => {
  isDraggingView = false;
});

function resetView() {
  controls.reset();
}

// 鍵盤旋轉：[ 逆時針、] 順時針，每按一次 azimuth ±15°
const KEY_ROTATE_STEP_DEG = 15;
function rotateAzimuthByKey(deg) {
  const offset = camera.position.clone().sub(controls.target);
  const spherical = new THREE.Spherical().setFromVector3(offset);
  spherical.theta += THREE.MathUtils.degToRad(deg);
  offset.setFromSpherical(spherical);
  camera.position.copy(controls.target).add(offset);
  camera.lookAt(controls.target);
  controls.update();
}

/* ============================================================
   點擊
   ============================================================ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveredPole = null;

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function getPickedPole() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(
    poles.map((p) => p.hitbox),
    false
  );
  if (hits.length === 0) return null;
  const { x, z } = hits[0].object.userData;
  return poles.find((p) => p.x === x && p.z === z);
}

function onPointerMove(event) {
  if (gameOver) return;
  // 拖拽視角時不顯示 hover（避免誤導使用者）
  if (isDraggingView) {
    if (hoveredPole) {
      hoveredPole.hoverRing.material.opacity = 0;
      hoveredPole = null;
    }
    renderer.domElement.style.cursor = 'grabbing';
    return;
  }
  updatePointer(event);
  const pole = getPickedPole();
  if (pole !== hoveredPole) {
    if (hoveredPole) hoveredPole.hoverRing.material.opacity = 0;
    hoveredPole = pole;
    if (hoveredPole && columnHeight(board, hoveredPole.x, hoveredPole.z) < SIZE)
      hoveredPole.hoverRing.material.opacity = 0.7;
  }
  renderer.domElement.style.cursor =
    pole && columnHeight(board, pole.x, pole.z) < SIZE ? 'pointer' : 'grab';
}

function onClick(event) {
  if (gameOver) return;
  updatePointer(event);
  const pole = getPickedPole();
  if (!pole) return;
  tryDrop(pole.x, pole.z);
}

renderer.domElement.addEventListener('pointermove', onPointerMove);
renderer.domElement.addEventListener('click', onClick);

/* ============================================================
   落子
   ============================================================ */
function tryDrop(x, z) {
  if (gameOver) return;
  const y = columnHeight(board, x, z);
  if (y >= SIZE) return;

  board[x][z][y] = currentPlayer;
  moveHistory.push({ x, z, y, player: currentPlayer });

  const mat = currentPlayer === 1 ? beadMat1 : beadMat2;
  const bead = new THREE.Mesh(new THREE.SphereGeometry(BEAD_R, 32, 24), mat.clone());
  bead.castShadow = true;
  bead.receiveShadow = true;

  const px = (x - (SIZE - 1) / 2) * SPACING;
  const pz = (z - (SIZE - 1) / 2) * SPACING;

  // 棋珠也加進 boardGroup，保持與整體一致的座標系
  const localTargetY = y * SPACING + BEAD_R + 0.05;
  bead.position.set(px, POLE_H + 0.5, pz);
  boardGroup.add(bead);

  beads.push({
    mesh: bead,
    x,
    y,
    z,
    player: currentPlayer,
    targetY: localTargetY,
    velocity: 0,
    landed: false,
  });

  const winLine = checkWin(board, currentPlayer);
  if (winLine) {
    gameOver = true;
    setTimeout(() => highlightWinLine(winLine), 600);
    setTimeout(() => showWinner(currentPlayer), 1100);
    scores[currentPlayer]++;
    updateScoreboard();
  } else if (isBoardFull(board)) {
    gameOver = true;
    setTimeout(() => showWinner(0), 600);
  } else {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    updateTurnUI();
    updateCursor();
  }
}

function highlightWinLine(line) {
  const winningBeads = beads.filter((b) =>
    line.some(([x, y, z]) => b.x === x && b.y === y && b.z === z)
  );
  winningBeads.forEach((b, i) => {
    setTimeout(() => {
      // 用棋子本色發光，並放大
      const baseColor = b.player === 1 ? 0xc84238 : 0x3a7ca5;
      b.mesh.material.emissive = new THREE.Color(baseColor);
      b.mesh.material.emissiveIntensity = 0.6;
      b.mesh.scale.setScalar(1.18);
    }, i * 120);
  });
}

function showWinner(player) {
  const overlay = document.getElementById('winner-overlay');
  const card = document.getElementById('winner-card');
  const eyebrow = document.getElementById('winner-eyebrow');
  const title = document.getElementById('winner-title');
  const sub = document.getElementById('winner-sub');
  card.classList.remove('p1', 'p2', 'draw');
  if (player === 1) {
    card.classList.add('p1');
    eyebrow.textContent = 'VICTORY · 勝負已分';
    title.textContent = '朱方勝';
    sub.textContent = `第 ${moveHistory.length} 手 連成一線`;
  } else if (player === 2) {
    card.classList.add('p2');
    eyebrow.textContent = 'VICTORY · 勝負已分';
    title.textContent = '青方勝';
    sub.textContent = `第 ${moveHistory.length} 手 連成一線`;
  } else {
    card.classList.add('draw');
    eyebrow.textContent = 'DRAW · 棋盤已滿';
    title.textContent = '和局';
    sub.textContent = '64 子俱滿 無人連線';
  }
  overlay.classList.add('show');
}

/* ============================================================
   悔棋 / 新局
   ============================================================ */
function undoMove() {
  if (moveHistory.length === 0) return;
  const overlay = document.getElementById('winner-overlay');
  if (gameOver && overlay.classList.contains('show')) {
    overlay.classList.remove('show');
    if (moveHistory.length > 0) {
      const lastWin = checkWin(board, moveHistory[moveHistory.length - 1].player);
      if (lastWin) {
        scores[moveHistory[moveHistory.length - 1].player]--;
        updateScoreboard();
      }
    }
  }
  gameOver = false;

  const last = moveHistory.pop();
  board[last.x][last.z][last.y] = 0;

  const idx = beads.findIndex((b) => b.x === last.x && b.y === last.y && b.z === last.z);
  if (idx >= 0) {
    const b = beads[idx];
    boardGroup.remove(b.mesh);
    b.mesh.geometry.dispose();
    b.mesh.material.dispose();
    beads.splice(idx, 1);
  }
  beads.forEach((b) => {
    b.mesh.material.emissive = new THREE.Color(0x000000);
    b.mesh.material.emissiveIntensity = 0;
    b.mesh.scale.setScalar(1);
  });

  currentPlayer = last.player;
  updateTurnUI();
  updateCursor();
}

function newGame(keepScore = true) {
  beads.forEach((b) => {
    boardGroup.remove(b.mesh);
    b.mesh.geometry.dispose();
    b.mesh.material.dispose();
  });
  beads.length = 0;

  board = newBoard();
  currentPlayer = 1;
  moveHistory = [];
  gameOver = false;
  if (!keepScore) scores = { 1: 0, 2: 0 };

  document.getElementById('winner-overlay').classList.remove('show');
  selected = null;
  updateCursor();
  updateTurnUI();
  updateScoreboard();
}

/* ============================================================
   UI
   ============================================================ */
function updateTurnUI() {
  const dot = document.getElementById('turn-dot');
  dot.classList.toggle('p1', currentPlayer === 1);
  dot.classList.toggle('p2', currentPlayer === 2);
  document.getElementById('turn-label').textContent = currentPlayer === 1 ? '朱方落子' : '青方落子';
  document.getElementById('turn-num').textContent = `第 ${moveHistory.length + 1} 手`;
}
function updateScoreboard() {
  document.getElementById('score-p1').textContent = scores[1];
  document.getElementById('score-p2').textContent = scores[2];
}

document.getElementById('btn-new').addEventListener('click', () => newGame(true));
document.getElementById('btn-undo').addEventListener('click', undoMove);
document.getElementById('btn-reset-view').addEventListener('click', resetView);
document.getElementById('winner-replay').addEventListener('click', () => newGame(true));
document.getElementById('btn-rules').addEventListener('click', () => {
  alert(
    '方垛式四子棋（Score Four）\n\n' +
      '· 棋盤為 4×4×4 立柱結構，共 16 根柱子，每柱可放 4 顆棋珠。\n' +
      '· 雙方輪流選一根未滿的柱子，棋珠因重力落到該柱最底空位。\n' +
      '· 率先在三維空間中任一方向（橫、直、斜，含跨層對角線）連成 4 顆同色者勝。\n' +
      '· 共 76 條獲勝線。\n\n' +
      '操作：點選柱子落子，使用右下角控制桿調整視角，滾輪可縮放。'
  );
});

/* ============================================================
   鍵盤選取
   ============================================================ */
function setCursorVisible(visible) {
  const op = visible ? 1 : 0;
  cursorOuter.material.opacity = op * 0.7;
  cursorInner.material.opacity = op;
  previewBead.material.opacity = op * 0.45;
}

function updateCursor() {
  if (!selected) {
    setCursorVisible(false);
    return;
  }
  const px = (selected.x - (SIZE - 1) / 2) * SPACING;
  const pz = (selected.z - (SIZE - 1) / 2) * SPACING;
  cursorOuter.position.x = px;
  cursorOuter.position.z = pz;
  cursorInner.position.x = px;
  cursorInner.position.z = pz;

  // 預覽棋珠位置：當前柱子下一個會落到的位置
  const nextY = columnHeight(board, selected.x, selected.z);
  if (nextY >= SIZE) {
    // 滿了：藏起預覽棋珠，內環變灰
    previewBead.material.opacity = 0;
    cursorInner.material.color.setHex(0x8a7c6a);
  } else {
    previewBead.position.set(px, nextY * SPACING + BEAD_R + 0.05, pz);
    const color = currentPlayer === 1 ? 0xc84238 : 0x3a7ca5;
    previewBead.material.color.setHex(color);
    previewBead.material.opacity = 0.45;
    cursorInner.material.color.setHex(color);
  }
  setCursorVisible(true);
  // 重新打開（避免被 setCursorVisible 全部設成 1）
  if (nextY >= SIZE) previewBead.material.opacity = 0;
}

function moveSelection(screenDx, screenDz) {
  if (!selected) {
    // 第一次按方向鍵：從棋盤中央附近的格子開始
    selected = { x: 1, z: 1 };
    updateCursor();
    return;
  }
  const { dx, dz } = screenDirToBoardDir(camera, screenDx, screenDz);
  const nx = Math.max(0, Math.min(SIZE - 1, selected.x + dx));
  const nz = Math.max(0, Math.min(SIZE - 1, selected.z + dz));
  selected = { x: nx, z: nz };
  updateCursor();
}

function confirmSelection() {
  if (!selected) {
    selected = { x: 1, z: 1 };
    updateCursor();
    return;
  }
  if (columnHeight(board, selected.x, selected.z) >= SIZE) return;
  tryDrop(selected.x, selected.z);
  // 落子後游標保持在原位（換另一方時可能會想往別處走）
  updateCursor();
}

document.addEventListener('keydown', (e) => {
  // 方向鍵：螢幕座標的 (dx, dz)，dz=+1 為「往畫面深處」（上）
  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault();
      moveSelection(0, 1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      moveSelection(0, -1);
      break;
    case 'ArrowLeft':
      e.preventDefault();
      moveSelection(-1, 0);
      break;
    case 'ArrowRight':
      e.preventDefault();
      moveSelection(1, 0);
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      confirmSelection();
      break;
    case 'Escape':
      selected = null;
      updateCursor();
      break;
    case 'z':
    case 'Z':
      undoMove();
      break;
    case 'r':
    case 'R':
      resetView();
      break;
    case 'n':
    case 'N':
      newGame(true);
      break;
    case '[':
      rotateAzimuthByKey(-KEY_ROTATE_STEP_DEG);
      break;
    case ']':
      rotateAzimuthByKey(KEY_ROTATE_STEP_DEG);
      break;
  }
});

/* ============================================================
   渲染
   ============================================================ */
function animate() {
  requestAnimationFrame(animate);

  for (const b of beads) {
    if (b.landed) continue;
    b.velocity += 0.025;
    b.mesh.position.y -= b.velocity;
    if (b.mesh.position.y <= b.targetY) {
      b.mesh.position.y = b.targetY;
      if (b.velocity > 0.15) b.velocity = -b.velocity * 0.35;
      else {
        b.velocity = 0;
        b.landed = true;
      }
    }
  }

  if (hoveredPole && !gameOver) {
    const t = performance.now() * 0.003;
    hoveredPole.hoverRing.material.opacity = 0.5 + Math.sin(t) * 0.25;
  }

  controls.update(); // damping 需要每幀 update
  renderer.render(scene, camera);
}

function onResize() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, true);
}
window.addEventListener('resize', onResize);
// 用 ResizeObserver 監聽 canvas 容器本身的尺寸變化（grid 佈局下更可靠）
if (typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => onResize());
  ro.observe(wrap);
}

scores = { 1: 0, 2: 0 };
newGame(false);
// 延後初始化以等 grid 佈局穩定
requestAnimationFrame(() => {
  onResize();
  animate();
});
