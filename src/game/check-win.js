import { WIN_LINES } from './win-lines.js';

/**
 * 檢查 player 是否在 board 上連成任一條獲勝線。
 * 找到第一條完全屬於 player 的線即回傳；否則回傳 null。
 *
 * @param {import('../types.js').Board} board
 * @param {import('../types.js').Player} player
 * @returns {import('../types.js').WinLine | null}
 */
export function checkWin(board, player) {
  for (const line of WIN_LINES) {
    if (line.every(([x, y, z]) => board[x][z][y] === player)) return line;
  }
  return null;
}
