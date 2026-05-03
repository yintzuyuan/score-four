import { describe, test, expect } from 'vitest';
import { newBoard } from '../../src/game/board.js';
import { checkWin } from '../../src/game/check-win.js';

/** 把 (x, y, z) 直接放上盤面（無重力，純測試輔助）。 */
function place(board, x, y, z, player) {
  board[x][z][y] = player;
}

describe('checkWin', () => {
  test('空盤回傳 null', () => {
    expect(checkWin(newBoard(), 1)).toBeNull();
    expect(checkWin(newBoard(), 2)).toBeNull();
  });

  test('部分填充無勝局回傳 null', () => {
    const board = newBoard();
    place(board, 0, 0, 0, 1);
    place(board, 1, 0, 1, 1);
    place(board, 2, 0, 2, 2);
    expect(checkWin(board, 1)).toBeNull();
    expect(checkWin(board, 2)).toBeNull();
  });

  test('X 軸連線（z=0, y=0）回傳該線', () => {
    const board = newBoard();
    for (let x = 0; x < 4; x++) place(board, x, 0, 0, 1);
    const line = checkWin(board, 1);
    expect(line).not.toBeNull();
    expect(line).toHaveLength(4);
  });

  test('垂直連線（同柱 4 顆）回傳該線', () => {
    const board = newBoard();
    for (let y = 0; y < 4; y++) place(board, 2, y, 2, 2);
    const line = checkWin(board, 2);
    expect(line).not.toBeNull();
    expect(line.every(([x, , z]) => x === 2 && z === 2)).toBe(true);
  });

  test('空間對角線（角到角）回傳該線', () => {
    const board = newBoard();
    for (let i = 0; i < 4; i++) place(board, i, i, i, 1);
    expect(checkWin(board, 1)).not.toBeNull();
  });

  test('對手完成連線不算自己勝', () => {
    const board = newBoard();
    for (let x = 0; x < 4; x++) place(board, x, 0, 0, 2);
    expect(checkWin(board, 1)).toBeNull();
    expect(checkWin(board, 2)).not.toBeNull();
  });

  test('斷線（4 顆中夾雜對手）不算勝', () => {
    const board = newBoard();
    place(board, 0, 0, 0, 1);
    place(board, 1, 0, 0, 1);
    place(board, 2, 0, 0, 2); // 對手插一腳
    place(board, 3, 0, 0, 1);
    expect(checkWin(board, 1)).toBeNull();
  });
});
