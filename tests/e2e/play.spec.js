import { test, expect } from '@playwright/test';

/**
 * E2E：完整對局流程，全部走鍵盤操作（避開 canvas 像素級點擊）。
 * Page state 透過 DOM 元素文字驗證（turn-label / turn-num / scoreboard）。
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#turn-label')).toBeVisible();
});

test('初始畫面：顯示朱方第 1 手、分數 0:0', async ({ page }) => {
  await expect(page.locator('#turn-label')).toHaveText('朱方落子');
  await expect(page.locator('#turn-num')).toHaveText('第 1 手');
  await expect(page.locator('#score-p1')).toHaveText('0');
  await expect(page.locator('#score-p2')).toHaveText('0');
});

test('鍵盤落子：Enter 後切換到青方第 2 手', async ({ page }) => {
  // 先按方向鍵叫出游標選取（從中央 (1, 1) 開始）
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.locator('#turn-label')).toHaveText('青方落子');
  await expect(page.locator('#turn-num')).toHaveText('第 2 手');
});

test('悔棋（Z 鍵）：回到上一手', async ({ page }) => {
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter'); // 朱方落子
  await page.keyboard.press('Enter'); // 青方落子
  await expect(page.locator('#turn-num')).toHaveText('第 3 手');

  await page.keyboard.press('z');
  await expect(page.locator('#turn-num')).toHaveText('第 2 手');
  await expect(page.locator('#turn-label')).toHaveText('青方落子');
});

test('新局按鈕：重置局面但保留分數', async ({ page }) => {
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.locator('#turn-num')).toHaveText('第 3 手');

  await page.locator('#btn-new').click();
  await expect(page.locator('#turn-label')).toHaveText('朱方落子');
  await expect(page.locator('#turn-num')).toHaveText('第 1 手');
  await expect(page.locator('#score-p1')).toHaveText('0');
});

test('快捷鍵 N：開新局', async ({ page }) => {
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await expect(page.locator('#turn-num')).toHaveText('第 2 手');

  await page.keyboard.press('n');
  await expect(page.locator('#turn-num')).toHaveText('第 1 手');
});

test('Esc 取消選取（不會落子）', async ({ page }) => {
  await page.keyboard.press('ArrowUp'); // 啟動選取
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter'); // 沒有 selected，confirmSelection 會初始化但不落子
  // 第一次按 Enter 時 selected 為 null，會初始化游標但不落子
  await expect(page.locator('#turn-num')).toHaveText('第 1 手');
});

test('完成同柱 4 連勝：朱方勝畫面顯示', async ({ page }) => {
  // 同柱 4 顆：朱方落子 (1,1)、青方落子別處、朱方再落 (1,1)、青方別處... 共 4 朱 3 青
  // 簡化：直接連續 7 個 Enter（朱青交替），但每次回到同一柱會堆高
  // (1,1) 朱 → 移到 (0,0) 青 → 回 (1,1) 朱 → (0,0) 青 → (1,1) 朱 → (0,0) 青 → (1,1) 朱

  // P1: 朱方 (1,1) y=0
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');

  // P2: 青方 (0,0) y=0 — 移到 (0,0)
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');

  // P3: 朱方 (1,1) y=1 — 回 (1,1)
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  // P4: 青方 (0,0) y=1
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');

  // P5: 朱方 (1,1) y=2
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  // P6: 青方 (0,0) y=2
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');

  // P7: 朱方 (1,1) y=3 → 朱方同柱連線勝
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');

  // 等獲勝動畫（600ms 開始連線、1080ms 連線完整、1600ms 卡片入場）
  await expect(page.locator('#winner-card')).toBeVisible({ timeout: 4000 });
  await expect(page.locator('#winner-title')).toHaveText('朱方勝');
  await expect(page.locator('#score-p1')).toHaveText('1');
  await expect(page.locator('#score-p2')).toHaveText('0');

  // 「檢視棋盤」按鈕暫時隱藏卡片，連線本體仍在棋盤
  await page.locator('#winner-view').click();
  await expect(page.locator('#winner-card')).toBeHidden();
});
