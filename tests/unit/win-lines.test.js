import { describe, test, expect } from 'vitest';
import { WIN_LINES } from '../../src/game/win-lines.js';
import { SIZE } from '../../src/game/board.js';

describe('WIN_LINES', () => {
  test('總數為 76 條（4×4×4 連四子棋的標準數字）', () => {
    expect(WIN_LINES).toHaveLength(76);
  });

  test('每條線恰好 4 個座標點', () => {
    for (const line of WIN_LINES) {
      expect(line).toHaveLength(SIZE);
    }
  });

  test('所有座標都在 [0, 3] 範圍內', () => {
    for (const line of WIN_LINES) {
      for (const [x, y, z] of line) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(SIZE);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(SIZE);
        expect(z).toBeGreaterThanOrEqual(0);
        expect(z).toBeLessThan(SIZE);
      }
    }
  });

  test('每條線內無重複座標點', () => {
    for (const line of WIN_LINES) {
      const keys = new Set(line.map(([x, y, z]) => `${x},${y},${z}`));
      expect(keys.size).toBe(SIZE);
    }
  });

  test('沒有重複的線（不同方向的同一條線只算一次）', () => {
    const sortedKeys = WIN_LINES.map((line) =>
      line
        .map(([x, y, z]) => `${x},${y},${z}`)
        .sort()
        .join('|')
    );
    expect(new Set(sortedKeys).size).toBe(WIN_LINES.length);
  });

  // 比對「無向線」：把每條線的 4 個座標排序後做字串 key
  const lineKey = (line) =>
    line
      .map(([x, y, z]) => `${x},${y},${z}`)
      .sort()
      .join('|');
  const allLineKeys = new Set(WIN_LINES.map(lineKey));

  test('包含 X 軸第一行第一列（y=0, z=0）', () => {
    const expected = [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [3, 0, 0],
    ];
    expect(allLineKeys.has(lineKey(expected))).toBe(true);
  });

  test('包含 4 條空間對角線（角到角）', () => {
    const corners = [
      [
        [0, 0, 0],
        [1, 1, 1],
        [2, 2, 2],
        [3, 3, 3],
      ],
      [
        [3, 0, 0],
        [2, 1, 1],
        [1, 2, 2],
        [0, 3, 3],
      ],
      [
        [0, 3, 0],
        [1, 2, 1],
        [2, 1, 2],
        [3, 0, 3],
      ],
      [
        [0, 0, 3],
        [1, 1, 2],
        [2, 2, 1],
        [3, 3, 0],
      ],
    ];
    for (const expected of corners) {
      expect(allLineKeys.has(lineKey(expected))).toBe(true);
    }
  });
});
