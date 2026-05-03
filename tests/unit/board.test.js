import { describe, test, expect } from 'vitest';
import { newBoard, columnHeight, isBoardFull, SIZE } from '../../src/game/board.js';

describe('newBoard', () => {
  test('回傳 4×4×4 三維陣列', () => {
    const board = newBoard();
    expect(board).toHaveLength(SIZE);
    expect(board[0]).toHaveLength(SIZE);
    expect(board[0][0]).toHaveLength(SIZE);
  });

  test('所有格子初始為 0（空）', () => {
    const board = newBoard();
    for (let x = 0; x < SIZE; x++) {
      for (let z = 0; z < SIZE; z++) {
        for (let y = 0; y < SIZE; y++) {
          expect(board[x][z][y]).toBe(0);
        }
      }
    }
  });

  test('每次呼叫回傳獨立新實例', () => {
    const a = newBoard();
    const b = newBoard();
    a[0][0][0] = 1;
    expect(b[0][0][0]).toBe(0);
  });
});

describe('columnHeight', () => {
  test('全空柱子高度為 0', () => {
    const board = newBoard();
    expect(columnHeight(board, 0, 0)).toBe(0);
    expect(columnHeight(board, 3, 3)).toBe(0);
  });

  test('柱底放一顆後高度為 1', () => {
    const board = newBoard();
    board[0][0][0] = 1;
    expect(columnHeight(board, 0, 0)).toBe(1);
  });

  test('柱中堆三顆後高度為 3', () => {
    const board = newBoard();
    board[1][2][0] = 1;
    board[1][2][1] = 2;
    board[1][2][2] = 1;
    expect(columnHeight(board, 1, 2)).toBe(3);
  });

  test('滿柱（4 顆）回傳 SIZE', () => {
    const board = newBoard();
    for (let y = 0; y < SIZE; y++) board[2][3][y] = 1;
    expect(columnHeight(board, 2, 3)).toBe(SIZE);
  });

  test('其他柱不影響該柱高度', () => {
    const board = newBoard();
    board[0][0][0] = 1;
    board[0][0][1] = 1;
    expect(columnHeight(board, 1, 0)).toBe(0);
    expect(columnHeight(board, 0, 1)).toBe(0);
  });
});

describe('isBoardFull', () => {
  test('空盤 false', () => {
    expect(isBoardFull(newBoard())).toBe(false);
  });

  test('部分填充 false', () => {
    const board = newBoard();
    board[0][0][0] = 1;
    expect(isBoardFull(board)).toBe(false);
  });

  test('剩一柱沒滿 false', () => {
    const board = newBoard();
    for (let x = 0; x < SIZE; x++) {
      for (let z = 0; z < SIZE; z++) {
        if (x === 3 && z === 3) continue;
        for (let y = 0; y < SIZE; y++) board[x][z][y] = 1;
      }
    }
    expect(isBoardFull(board)).toBe(false);
  });

  test('全部 64 格都填滿 true', () => {
    const board = newBoard();
    for (let x = 0; x < SIZE; x++)
      for (let z = 0; z < SIZE; z++)
        for (let y = 0; y < SIZE; y++) board[x][z][y] = (x + z + y) % 2 === 0 ? 1 : 2;
    expect(isBoardFull(board)).toBe(true);
  });
});
