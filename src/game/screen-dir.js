/**
 * 把螢幕方向鍵向量投影到棋盤的 X/Z 軸，回傳 { dx, dz }（值為 -1 / 0 / 1）。
 *
 * - screenDx：螢幕「右(+1)/左(-1)」
 * - screenDz：螢幕「上(+1)/下(-1)」（dz=+1 為「往畫面深處」）
 *
 * 演算法（baseline，P1 行為）：
 * 1. 由相機朝原點的方向決定棋盤的「forward」軸
 * 2. 「right」= forward 順時針旋轉 90° → 注意此處方向約定可能與使用者期待不一致（P3c 處理）
 * 3. 將 (screenDx, screenDz) 投影到 (right, forward) 的世界座標
 * 4. 取絕對值較大的軸；兩軸接近時優先 dz（隱含偏好），可能造成 45° 邊界抖動（P3c 處理）
 *
 * @param {{ position: { x: number, z: number } }} camera Three.js Camera-like 物件（只用 position.x/z）
 * @param {number} screenDx
 * @param {number} screenDz
 * @returns {{ dx: -1 | 0 | 1, dz: -1 | 0 | 1 }}
 */
export function screenDirToBoardDir(camera, screenDx, screenDz) {
  // 相機在水平面上的朝向（從相機指向原點的反方向，即視線反向）
  // 相機看向 (0,0,0)，所以視線方向 = -camera.position（投影到 xz 平面）
  const viewX = -camera.position.x;
  const viewZ = -camera.position.z;
  const len = Math.hypot(viewX, viewZ);
  if (len < 0.001) {
    // 接近正上方視角：直接按棋盤軸
    return { dx: screenDx, dz: screenDz };
  }
  // 螢幕「上」對應到視線方向（往畫面深處）
  const forwardX = viewX / len;
  const forwardZ = viewZ / len;
  // 螢幕「右」對應到視線右側（forward 順時針旋轉 90°）
  const rightX = forwardZ;
  const rightZ = -forwardX;

  // 螢幕方向向量（screenDz 是「上下」軸：上=+1 表示往畫面深處）
  const wx = rightX * screenDx + forwardX * screenDz;
  const wz = rightZ * screenDx + forwardZ * screenDz;

  // 取絕對值較大的軸；若兩軸接近則維持方向，避免抖動
  let dx = 0;
  let dz = 0;
  if (Math.abs(wx) > Math.abs(wz)) {
    dx = wx > 0 ? 1 : -1;
  } else {
    dz = wz > 0 ? 1 : -1;
  }
  return { dx, dz };
}
