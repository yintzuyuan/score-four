import { describe, test, expect } from 'vitest';
import { screenDirToBoardDir } from '../../src/game/screen-dir.js';

/**
 * 建構一個極簡 camera-like 物件供測試。
 * screenDirToBoardDir 只用 camera.position.x / .z（忽略 y）。
 */
const cam = (x, z) => ({ position: { x, y: 5, z } });

describe('screenDirToBoardDir — baseline（凍結 P1 行為，P3c 修正前）', () => {
  describe('相機位於正 +Z 方向（最常見的初始視角）', () => {
    const camera = cam(0, 14);

    test('「上」(0, 1) → 棋盤 -Z（往畫面深處）', () => {
      expect(screenDirToBoardDir(camera, 0, 1)).toEqual({ dx: 0, dz: -1 });
    });

    test('「下」(0, -1) → 棋盤 +Z', () => {
      expect(screenDirToBoardDir(camera, 0, -1)).toEqual({ dx: 0, dz: 1 });
    });

    // 註：以下「右 → -X」、「左 → +X」是 P3c 待修的「不直覺」行為之一。
    // 從 +Z 看原點時使用者期待「右 = +X」（right-handed Y-up），
    // 但目前實作將「螢幕右」算為 forward 順時針旋轉 90°，得到 -X。
    test('「右」(1, 0) → 棋盤 -X（baseline；P3c 應改為 +X）', () => {
      expect(screenDirToBoardDir(camera, 1, 0)).toEqual({ dx: -1, dz: 0 });
    });

    test('「左」(-1, 0) → 棋盤 +X（baseline；P3c 應改為 -X）', () => {
      expect(screenDirToBoardDir(camera, -1, 0)).toEqual({ dx: 1, dz: 0 });
    });
  });

  describe('相機位於正 +X 方向（從側面看）', () => {
    const camera = cam(14, 0);

    test('「上」(0, 1) → 棋盤 -X', () => {
      expect(screenDirToBoardDir(camera, 0, 1)).toEqual({ dx: -1, dz: 0 });
    });

    test('「右」(1, 0) → 棋盤 +Z（baseline；P3c 視期望可能改）', () => {
      expect(screenDirToBoardDir(camera, 1, 0)).toEqual({ dx: 0, dz: 1 });
    });
  });

  describe('相機位於 -Z 方向（從反面看）', () => {
    const camera = cam(0, -14);

    test('「上」(0, 1) → 棋盤 +Z（從 -Z 看原點，深處方向是 +Z）', () => {
      expect(screenDirToBoardDir(camera, 0, 1)).toEqual({ dx: 0, dz: 1 });
    });
  });

  describe('近正上方視角（相機 x、z 都接近 0）', () => {
    const camera = cam(0.0005, 0.0005);

    test('len < 0.001 時，直接回傳螢幕方向（不投影）', () => {
      expect(screenDirToBoardDir(camera, 1, 0)).toEqual({ dx: 1, dz: 0 });
      expect(screenDirToBoardDir(camera, 0, 1)).toEqual({ dx: 0, dz: 1 });
    });
  });

  describe('45 度斜視角（邊界 case，P3c 重點處理區）', () => {
    const camera = cam(10, 10); // 45 度方位角

    test('「上」(0, 1) — 兩軸接近時的軸向選擇（baseline）', () => {
      // 在 45° 視角下，wx 和 wz 量級接近，目前邏輯選 |wx| ≤ |wz| 時走 dz 軸。
      // 若計算讓 |wx| 略大則走 dx — 這是「不直覺」的根源之一。
      const result = screenDirToBoardDir(camera, 0, 1);
      // 確認回傳格式正確（軸向選擇本身屬 P3c）
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
