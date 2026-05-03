import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { newBoard, columnHeight, isBoardFull, SIZE } from './game/board.js';
import { checkWin } from './game/check-win.js';
import { screenDirToBoardDir } from './game/screen-dir.js';

/* ============================================================
   遊戲邏輯
   ============================================================ */
const SPACING = 1.2; // 柱距（橫向呼吸感）
const BEAD_R = 0.45;
// 球心垂直堆疊間距：球直徑 + 微小防 z-fight；不沿用 SPACING，避免 0.3 真空隙
const BEAD_STACK_GAP = BEAD_R * 2 * 1.02;
const POLE_R = 0.06;
// 柱高：恰好包住 4 顆球（底層球底 → 頂層球頂 + 微小 margin）
const POLE_H = (SIZE - 1) * BEAD_STACK_GAP + BEAD_R * 2 + 0.05;

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

// Rim light：相機背後上方，補棋珠輪廓邊光（強化垂直堆疊辨識度）
const rimLight = new THREE.DirectionalLight(0xfff5e8, 0.4);
rimLight.position.set(-3, 8, -6);
scene.add(rimLight);

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

    poles.push({ mesh: pole, hitbox, x, z });
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

// 棋珠：MeshPhysicalMaterial + clearcoat 取得瓷釉/玉石邊緣高光
const beadMat1 = new THREE.MeshPhysicalMaterial({
  color: 0xc84238, // 朱紅
  roughness: 0.5,
  metalness: 0.15,
  clearcoat: 0.4,
  clearcoatRoughness: 0.15,
});
const beadMat2 = new THREE.MeshPhysicalMaterial({
  color: 0x3a7ca5, // 藍青
  roughness: 0.5,
  metalness: 0.15,
  clearcoat: 0.4,
  clearcoatRoughness: 0.15,
});

const beads = [];

// 勝負視覺：連線本體 + 高亮中的棋珠 ref
let winLineMesh = null;
let winningBeads = [];

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

// 拖拽視角期間：滑鼠用於旋轉，不該寫入 cursor 狀態
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
   點擊與滑鼠 hover：寫入共用的 selected 狀態
   ============================================================ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// 拖視角 vs 點擊落子辨識：pointerdown 後若移動超過閾值，視為 drag，後續 click 抑制
const DRAG_PIXEL_THRESHOLD = 5;
let pointerDownXY = null;
let wasDragGesture = false;

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

function onPointerDown(event) {
  pointerDownXY = { x: event.clientX, y: event.clientY };
  wasDragGesture = false;
}

function onPointerMove(event) {
  // 拖視角辨識：超過閾值即視為 drag，避免結束時 click 誤觸落子
  if (pointerDownXY) {
    const dx = event.clientX - pointerDownXY.x;
    const dy = event.clientY - pointerDownXY.y;
    if (Math.hypot(dx, dy) > DRAG_PIXEL_THRESHOLD) wasDragGesture = true;
  }
  if (gameOver) return;
  if (isDraggingView) {
    renderer.domElement.style.cursor = 'grabbing';
    return;
  }
  updatePointer(event);
  const pole = getPickedPole();
  renderer.domElement.style.cursor =
    pole && columnHeight(board, pole.x, pole.z) < SIZE ? 'pointer' : 'grab';
  if (!pole) return; // 沒命中柱子不動 selected（避免在棋盤外移動就清掉）
  if (!selected || selected.x !== pole.x || selected.z !== pole.z) {
    selected = { x: pole.x, z: pole.z };
    updateCursor();
  }
}

function onPointerUp() {
  pointerDownXY = null;
}

function onPointerLeave() {
  // 滑鼠離開 canvas 時 cursor 樣式還原；selected 黏著保留，讓鍵盤可從最後位置接手
  renderer.domElement.style.cursor = '';
}

function onClick(event) {
  if (gameOver) return;
  // 剛結束一次拖視角 → 抑制這次 click 避免誤觸落子
  if (wasDragGesture) {
    wasDragGesture = false;
    return;
  }
  updatePointer(event);
  const pole = getPickedPole();
  if (!pole) return;
  // 同步 selected 到點擊位置（觸控直接 tap 時 pointermove 可能不會先觸發）
  selected = { x: pole.x, z: pole.z };
  tryDrop(pole.x, pole.z);
}

renderer.domElement.addEventListener('pointerdown', onPointerDown);
renderer.domElement.addEventListener('pointermove', onPointerMove);
renderer.domElement.addEventListener('pointerup', onPointerUp);
renderer.domElement.addEventListener('pointerleave', onPointerLeave);
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
  const localTargetY = y * BEAD_STACK_GAP + BEAD_R + 0.05;
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
    const winningPlayer = currentPlayer;
    setTimeout(() => highlightWinLine(winLine, winningPlayer), 600);
    // 連線完整出現 + 棋珠飄浮先單獨展示 0.5 秒，再讓題詞置中入場
    setTimeout(() => showWinner(winningPlayer), 1600);
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

/** 把棋盤座標 [x, y, z] 轉為棋珠中心的 boardGroup 局部座標。 */
function beadLocalCenter([x, y, z]) {
  return new THREE.Vector3(
    (x - (SIZE - 1) / 2) * SPACING,
    y * BEAD_STACK_GAP + BEAD_R + 0.05,
    (z - (SIZE - 1) / 2) * SPACING
  );
}

/**
 * 「金線穿珠」— 沿勝方四顆棋珠中心建立有粗細的光柱（TubeGeometry）。
 * 用 CatmullRomCurve3 做平滑路徑（即使是直線也讓 cap 處圓滑），
 * MeshStandardMaterial + emissive 讓光柱有真實的光照與陰影互動。
 */
function buildWinLineMesh(line, color) {
  const points = line.map(beadLocalCenter);
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0);
  const TUBE_RADIUS = 0.07; // 比 POLE_R (0.06) 略粗，視覺上明顯
  const geometry = new THREE.TubeGeometry(curve, 64, TUBE_RADIUS, 12, false);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.85,
    roughness: 0.25,
    metalness: 0.4,
    transparent: true,
    opacity: 0, // 從 0 漸入，由 animate loop 推進
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  // 自製 progress 屬性給逐段顯現用（0–1，用 clipping plane 模擬「延伸」）
  mesh.userData = {
    appearStartedAt: 0,
    appearDuration: 280, // 從 0 → 1 的時間（ms）
    fullyVisible: false,
  };
  return mesh;
}

function highlightWinLine(line, player) {
  const baseColor = player === 1 ? 0xc84238 : 0x3a7ca5;
  // 1. 找出勝方四顆棋珠並逐一發光放大（依序動畫，引導視線）
  winningBeads = beads.filter((b) => line.some(([x, y, z]) => b.x === x && b.y === y && b.z === z));
  winningBeads.forEach((b, i) => {
    setTimeout(() => {
      b.mesh.material.emissive = new THREE.Color(baseColor);
      b.mesh.material.emissiveIntensity = 0.6;
      b.mesh.scale.setScalar(1.18);
      // 記錄飄浮基準 y，給 animate loop 做 sine 微飄
      b.floatBase = b.targetY;
      b.isWinning = true;
    }, i * 120);
  });
  // 2. 四顆都亮起後，加上「金線穿珠」光柱
  setTimeout(() => {
    winLineMesh = buildWinLineMesh(line, baseColor);
    winLineMesh.userData.appearStartedAt = performance.now();
    boardGroup.add(winLineMesh);
    // 同步觸發 vignette
    document.getElementById('vignette').classList.add('show');
  }, winningBeads.length * 120);
}

/** 清除勝負視覺（連線 + 棋珠發光 + vignette）。新局或悔棋時呼叫。 */
function clearWinHighlight() {
  if (winLineMesh) {
    boardGroup.remove(winLineMesh);
    winLineMesh.geometry.dispose();
    winLineMesh.material.dispose();
    winLineMesh = null;
  }
  winningBeads.forEach((b) => {
    if (!b.mesh.material) return;
    b.mesh.material.emissive = new THREE.Color(0x000000);
    b.mesh.material.emissiveIntensity = 0;
    b.mesh.scale.setScalar(1);
    b.isWinning = false;
    if (b.floatBase !== undefined) {
      b.mesh.position.y = b.floatBase;
    }
  });
  winningBeads = [];
  document.getElementById('vignette').classList.remove('show');
}

/** 把 Date 格式化成「2026.05.04」風格題詞日期。 */
function formatColophonDate(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

function showWinner(player) {
  const card = document.getElementById('winner-card');
  const eyebrow = document.getElementById('winner-eyebrow');
  const title = document.getElementById('winner-title');
  const sub = document.getElementById('winner-sub');
  const meta = document.getElementById('winner-meta');
  const viewBtn = document.getElementById('winner-view');
  card.classList.remove('p1', 'p2', 'draw');
  const date = formatColophonDate();
  if (player === 1) {
    card.classList.add('p1');
    eyebrow.textContent = '勝 · VICTORY';
    title.textContent = '朱方勝';
    sub.textContent = `第 ${moveHistory.length} 手 連成一線`;
    meta.textContent = `${date} · 對局 ${scores[1] + scores[2]}`;
    viewBtn.hidden = false;
  } else if (player === 2) {
    card.classList.add('p2');
    eyebrow.textContent = '勝 · VICTORY';
    title.textContent = '青方勝';
    sub.textContent = `第 ${moveHistory.length} 手 連成一線`;
    meta.textContent = `${date} · 對局 ${scores[1] + scores[2]}`;
    viewBtn.hidden = false;
  } else {
    card.classList.add('draw');
    eyebrow.textContent = '和 · DRAW';
    title.textContent = '和局';
    sub.textContent = '六十四子俱滿 無人連成';
    meta.textContent = `${date} · 對局 ${scores[1] + scores[2] + 1}`;
    viewBtn.hidden = true; // 和局沒連線，無棋盤可檢視
  }
  card.hidden = false;
}

function hideWinnerCard() {
  document.getElementById('winner-card').hidden = true;
}

/* ============================================================
   悔棋 / 新局
   ============================================================ */
function undoMove() {
  if (moveHistory.length === 0) return;
  if (gameOver) {
    // 從勝負狀態悔棋：扣回剛加的分、清掉勝負視覺與卡片
    const lastWin = checkWin(board, moveHistory[moveHistory.length - 1].player);
    if (lastWin) {
      scores[moveHistory[moveHistory.length - 1].player]--;
      updateScoreboard();
    }
    hideWinnerCard();
    clearWinHighlight();
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

  currentPlayer = last.player;
  updateTurnUI();
  updateCursor();
}

function newGame(keepScore = true) {
  clearWinHighlight();
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

  hideWinnerCard();
  hideRules();
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
document.getElementById('winner-close').addEventListener('click', hideWinnerCard);
document.getElementById('winner-view').addEventListener('click', hideWinnerCard);
/* === 規則說明 overlay === */
const RULES_SEEN_KEY = 'score-four:rules-seen';
const rulesOverlay = document.getElementById('rules-overlay');

function showRules() {
  rulesOverlay.hidden = false;
}
function hideRules() {
  // 只有真的從 visible → hidden 才標記已讀
  // 避免 init 時 newGame() 順手呼叫 hideRules 也被當成「使用者關閉」
  if (rulesOverlay.hidden) return;
  rulesOverlay.hidden = true;
  try {
    localStorage.setItem(RULES_SEEN_KEY, '1');
  } catch {
    // localStorage 失敗（例如 Safari 私密模式）：忽略，下次仍會自動跳
  }
}
function isRulesOpen() {
  return !rulesOverlay.hidden;
}

document.getElementById('btn-rules').addEventListener('click', showRules);
document.getElementById('rules-close').addEventListener('click', hideRules);
document.getElementById('rules-backdrop').addEventListener('click', hideRules);

function maybeAutoShowRules() {
  // 首次造訪：自動彈出一次（在 newGame init 之後呼叫，避免被 newGame 內的 hideRules 蓋掉）
  try {
    if (!localStorage.getItem(RULES_SEEN_KEY)) showRules();
  } catch {
    // localStorage 失敗（Safari 私密模式等）：每次造訪都自動跳，不阻擋
    showRules();
  }
}

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
    previewBead.position.set(px, nextY * BEAD_STACK_GAP + BEAD_R + 0.05, pz);
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
      // 優先序：規則 overlay > 勝負卡片 > 取消鍵盤選取
      if (isRulesOpen()) {
        hideRules();
      } else if (gameOver && !document.getElementById('winner-card').hidden) {
        hideWinnerCard();
      } else {
        selected = null;
        updateCursor();
      }
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

  // 勝負連線：280ms 漸入（從 0 → 0.95），完成後微脈動
  if (winLineMesh) {
    const now = performance.now();
    const progress = Math.min(
      1,
      (now - winLineMesh.userData.appearStartedAt) / winLineMesh.userData.appearDuration
    );
    if (progress < 1) {
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      winLineMesh.material.opacity = eased * 0.95;
      winLineMesh.material.emissiveIntensity = 0.4 + eased * 0.5;
    } else {
      winLineMesh.userData.fullyVisible = true;
      const t = now * 0.0015;
      winLineMesh.material.opacity = 0.85 + Math.sin(t) * 0.1;
      winLineMesh.material.emissiveIntensity = 0.85 + Math.sin(t * 1.3) * 0.15;
    }
  }

  // 勝方棋珠微飄浮（sine wave ±0.04y）
  for (const b of winningBeads) {
    if (!b.isWinning || b.floatBase === undefined) continue;
    const t = performance.now() * 0.0018;
    b.mesh.position.y = b.floatBase + Math.sin(t + (b.x + b.z) * 0.5) * 0.04;
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
maybeAutoShowRules();
// 延後初始化以等 grid 佈局穩定
requestAnimationFrame(() => {
  onResize();
  animate();
});
