/**
 * 棋盤模型：4×4×4 三維陣列。索引順序為 [x][z][y]（保持與原型一致）。
 * 0 = 空，1 = 朱方（P1），2 = 青方（P2）。
 *
 * @typedef {0 | 1 | 2} Cell
 * @typedef {Cell[][][]} Board
 */

export const SIZE = 4;

/** 建立空棋盤。每次呼叫回傳獨立新實例。 */
export function newBoard() {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => Array(SIZE).fill(0))
  );
}

/**
 * 計算指定柱（x, z）已堆疊的棋珠數量（即下一顆會落在的 y 索引）。
 * 從柱底往上掃，遇到第一個 0 即為高度。
 */
export function columnHeight(board, x, z) {
  let h = 0;
  while (h < SIZE && board[x][z][h] !== 0) h++;
  return h;
}

/** 棋盤是否全滿（所有 64 格皆有棋珠）。 */
export function isBoardFull(board) {
  for (let x = 0; x < SIZE; x++) {
    for (let z = 0; z < SIZE; z++) {
      if (columnHeight(board, x, z) < SIZE) return false;
    }
  }
  return true;
}
