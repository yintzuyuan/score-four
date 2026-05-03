import { SIZE } from './board.js';

/**
 * 4×4×4 連四子棋的全部 76 條獲勝線（每條 4 個座標 [x, y, z]）。
 *
 * 列舉方式：對每個起點 + 26 個 3D 方向，檢查整條線是否落在棋盤內；
 * 用 Set 去除「正反向同一條線」的重複（例：(0,0,0)→(3,3,3) 與 (3,3,3)→(0,0,0)）。
 *
 * @type {import('../types.js').WinLine[]}
 */
export const WIN_LINES = (() => {
  const lines = [];
  const inRange = (i) => i >= 0 && i < SIZE;
  const dirs = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (!(dx === 0 && dy === 0 && dz === 0)) dirs.push([dx, dy, dz]);
      }
    }
  }
  const seen = new Set();
  for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
      for (let z = 0; z < SIZE; z++) {
        for (const [dx, dy, dz] of dirs) {
          const ex = x + dx * (SIZE - 1);
          const ey = y + dy * (SIZE - 1);
          const ez = z + dz * (SIZE - 1);
          if (!inRange(ex) || !inRange(ey) || !inRange(ez)) continue;
          const key = [x, y, z, dx, dy, dz].join(',');
          const revKey = [ex, ey, ez, -dx, -dy, -dz].join(',');
          if (seen.has(revKey)) continue;
          seen.add(key);
          const line = [];
          for (let i = 0; i < SIZE; i++) {
            line.push([x + dx * i, y + dy * i, z + dz * i]);
          }
          lines.push(line);
        }
      }
    }
  }
  return lines;
})();
