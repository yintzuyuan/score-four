import { test, expect } from '@playwright/test';

/**
 * 視覺回歸 baseline。
 *
 * 第一次跑會 fail 並產生 baseline（tests/e2e/visual.spec.js-snapshots/）；
 * 後續 run 會與 baseline 比對，diff 超過閾值即 fail。
 *
 * Baseline 隨 OS / GPU / 字型有差異（Playwright 自動加 platform suffix）。
 * 跨平台的 baseline 需在各 OS 各跑一次 update-snapshots。
 *
 * 更新 baseline：`npm run test:e2e:update`
 */

const VIEWPORT = { width: 1280, height: 800 };

// 等渲染穩定（字型載入、3D 場景初始化、bead 落地動畫）
async function waitForStableScene(page, settleMs = 800) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(settleMs);
}

test.use({ viewport: VIEWPORT });

test.beforeEach(async ({ page }) => {
  // 同 play.spec.js：規則已讀 + splash 已看過，避免 overlay 干擾 baseline
  await page.addInitScript(() => {
    window.localStorage.setItem('score-four:rules-seen', '1');
    window.localStorage.setItem('score-four:visited', '1');
  });
});

test('初始畫面 baseline（無棋珠）', async ({ page }) => {
  await page.goto('/');
  await waitForStableScene(page);
  await expect(page).toHaveScreenshot('initial.png', {
    maxDiffPixelRatio: 0.02,
    animations: 'disabled',
  });
});

test('落 5 手後的棋盤 baseline', async ({ page }) => {
  await page.goto('/');
  await waitForStableScene(page);

  // 朱、青交替落子在 (1,1) 與 (2,2) — 各 2/3 顆
  await page.keyboard.press('ArrowUp'); // 啟動游標 (1,1)
  await page.keyboard.press('Enter'); // P1
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight'); // 移到 (2,2)
  await page.keyboard.press('Enter'); // P2
  await page.keyboard.press('Enter'); // P3 同柱 (2,2)
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowLeft'); // 回 (1,1)
  await page.keyboard.press('Enter'); // P4
  await page.keyboard.press('Enter'); // P5

  await waitForStableScene(page, 1500); // 等棋珠落地
  await expect(page).toHaveScreenshot('after-5-moves.png', {
    maxDiffPixelRatio: 0.03,
    animations: 'disabled',
  });
});

test('勝負畫面 baseline', async ({ page }) => {
  await page.goto('/');
  await waitForStableScene(page);

  // 朱方同柱 (1,1) 連 4
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter'); // 朱 (1,1) y=0
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft'); // 移到 (0,0)
  await page.keyboard.press('Enter'); // 青 (0,0) y=0
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight'); // 回 (1,1)
  await page.keyboard.press('Enter'); // 朱 (1,1) y=1
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter'); // 青 (0,0) y=1
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter'); // 朱 (1,1) y=2
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter'); // 青 (0,0) y=2
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter'); // 朱 (1,1) y=3 — 勝

  // 連線出現 (1080ms) + 棋珠飄浮 + 卡片入場 (1600ms) 完整跑完
  await expect(page.locator('#winner-card')).toBeVisible({ timeout: 4000 });
  await waitForStableScene(page, 1200);

  await expect(page).toHaveScreenshot('winner-p1.png', {
    maxDiffPixelRatio: 0.03,
    animations: 'disabled',
  });
});
