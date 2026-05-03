import { describe, test, expect } from 'vitest';
import { screenDirToBoardDir } from '../../src/game/screen-dir.js';

/**
 * 建構一個極簡 camera-like 物件供測試。
 * screenDirToBoardDir 只用 camera.position.x / .z（忽略 y）。
 */
const cam = (x, z) => ({ position: { x, y: 5, z } });

describe('screenDirToBoardDir — P3c 修正後行為（right-handed Y-up）', () => {
  describe('相機位於正 +Z 方向（最常見的初始視角）', () => {
    const camera = cam(0, 14);

    test('「上」(0, 1) → 棋盤 -Z（往畫面深處）', () => {
      expect(screenDirToBoardDir(camera, 0, 1)).toEqual({ dx: 0, dz: -1 });
    });

    test('「下」(0, -1) → 棋盤 +Z', () => {
      expect(screenDirToBoardDir(camera, 0, -1)).toEqual({ dx: 0, dz: 1 });
    });

    // P3c 修正：right-handed Y-up 約定下，從 +Z 看原點時「螢幕右 = 世界 +X」。
    test('「右」(1, 0) → 棋盤 +X', () => {
      expect(screenDirToBoardDir(camera, 1, 0)).toEqual({ dx: 1, dz: 0 });
    });

    test('「左」(-1, 0) → 棋盤 -X', () => {
      expect(screenDirToBoardDir(camera, -1, 0)).toEqual({ dx: -1, dz: 0 });
    });
  });

  describe('相機位於正 +X 方向（從側面看）', () => {
    const camera = cam(14, 0);

    test('「上」(0, 1) → 棋盤 -X', () => {
      expect(screenDirToBoardDir(camera, 0, 1)).toEqual({ dx: -1, dz: 0 });
    });

    // 從 +X 看原點：forward = -X，up = +Y，right = forward × up 之 Y-up 慣例 = -Z
    test('「右」(1, 0) → 棋盤 -Z', () => {
      expect(screenDirToBoardDir(camera, 1, 0)).toEqual({ dx: 0, dz: -1 });
    });
  });

  describe('相機位於 -Z 方向（從反面看）', () => {
    const camera = cam(0, -14);

    test('「上」(0, 1) → 棋盤 +Z（從 -Z 看原點，深處方向是 +Z）', () => {
      expect(screenDirToBoardDir(camera, 0, 1)).toEqual({ dx: 0, dz: 1 });
    });

    // 對稱於 +Z 視角：從 -Z 看原點，「螢幕右 = 世界 -X」
    test('「右」(1, 0) → 棋盤 -X', () => {
      expect(screenDirToBoardDir(camera, 1, 0)).toEqual({ dx: -1, dz: 0 });
    });
  });

  describe('相機位於 -X 方向（從另一側面看）', () => {
    const camera = cam(-14, 0);

    test('「右」(1, 0) → 棋盤 +Z', () => {
      expect(screenDirToBoardDir(camera, 1, 0)).toEqual({ dx: 0, dz: 1 });
    });

    test('「上」(0, 1) → 棋盤 +X', () => {
      expect(screenDirToBoardDir(camera, 0, 1)).toEqual({ dx: 1, dz: 0 });
    });
  });

  describe('近正上方視角（相機 x、z 都接近 0）', () => {
    const camera = cam(0.0005, 0.0005);

    test('len < 0.001 時，直接回傳螢幕方向（不投影）', () => {
      expect(screenDirToBoardDir(camera, 1, 0)).toEqual({ dx: 1, dz: 0 });
      expect(screenDirToBoardDir(camera, 0, 1)).toEqual({ dx: 0, dz: 1 });
    });
  });

  describe('45 度斜視角（邊界 case，hysteresis 屬未來 PR 範圍）', () => {
    const camera = cam(10, 10); // 45 度方位角

    test('「上」(0, 1) — 兩軸接近時仍回傳合法格式', () => {
      // 在 45° 視角下，wx 與 wz 量級接近，軸選擇可能隨數值噪音翻轉。
      // 防呆 (hysteresis) 留待後續 PR；本測試只確認回傳格式合法。
      const result = screenDirToBoardDir(camera, 0, 1);
      expect(result).toHaveProperty('dx');
      expect(result).toHaveProperty('dz');
      expect(Math.abs(result.dx) + Math.abs(result.dz)).toBe(1);
    });
  });

  describe('回傳值不變式', () => {
    const camera = cam(0, 14);
    const cases = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];

    test.each(cases)('輸入 (%i, %i) 回傳的 dx/dz 都在 {-1, 0, 1}', (sdx, sdz) => {
      const { dx, dz } = screenDirToBoardDir(camera, sdx, sdz);
      expect([-1, 0, 1]).toContain(dx);
      expect([-1, 0, 1]).toContain(dz);
    });

    test.each(cases)('輸入 (%i, %i) 回傳恰好一個非零軸', (sdx, sdz) => {
      const { dx, dz } = screenDirToBoardDir(camera, sdx, sdz);
      expect(Math.abs(dx) + Math.abs(dz)).toBe(1);
    });
  });
});
