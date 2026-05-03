import { test, expect } from '@playwright/test';

/**
 * E2E：完整對局流程，全部走鍵盤操作（避開 canvas 像素級點擊）。
 * Page state 透過 DOM 元素文字驗證（turn-label / turn-num / scoreboard）。
 */

test.beforeEach(async ({ page }) => {
  // 預設「規則已讀」避免首次造訪 auto-show overlay 攔截後續互動。
  // 預設「splash 已看過」避免啟動畫面阻擋 canvas 互動。
  // 想驗證 auto-show / splash 首訪行為的測試請另寫。
  await page.addInitScript(() => {
    window.localStorage.setItem('score-four:rules-seen', '1');
    window.localStorage.setItem('score-four:visited', '1');
  });
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

test('滑鼠點擊柱子：直接落子', async ({ page }) => {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  await canvas.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  await expect(page.locator('#turn-num')).toHaveText('第 2 手');
});

test('滑鼠 hover 後按 Enter：直接落子（hover 已寫入 selected）', async ({ page }) => {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  // hover 棋盤中央，pointermove 應寫入 selected
  await canvas.hover({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  await page.waitForTimeout(150); // 等 pointermove 處理
  // 直接按 Enter，應從 hover 位置落子（若 selected 沒被寫，Enter 只會初始化不落子）
  await page.keyboard.press('Enter');
  await expect(page.locator('#turn-num')).toHaveText('第 2 手');
});

test('拖視角不誤觸落子（drag-vs-click 辨識）', async ({ page }) => {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.5;
  // 模擬拖視角：在 canvas 中央按下 → 大幅移動 → 在棋盤範圍內放開
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 30, { steps: 10 });
  await page.mouse.up();
  // 拖視角結束時不該觸發落子，turn-num 仍為「第 1 手」
  await expect(page.locator('#turn-num')).toHaveText('第 1 手');
});

test('滑鼠 hover → pointerleave 後 Enter 仍能落子（sticky selected）', async ({ page }) => {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  // 1. 滑鼠 hover canvas 中央寫入 selected
  await canvas.hover({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  await page.waitForTimeout(150);
  // 2. 模擬滑鼠離開 canvas（pointerleave 應 sticky 保留 selected）
  await page.evaluate(() => {
    const c = document.querySelector('canvas');
    c.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }));
  });
  // 3. 直接按 Enter（不按 ArrowKey）—— 關鍵 discrimination：
  //    若 pointerleave 清空 selected，confirmSelection 看到 null 只會 init (1,1) 並 return
  //    （不落子），turn-num 卡在第 1 手；只有 sticky 行為正確才會落子推進到第 2 手。
  //    若混入 ArrowKey 會 mask 此 case（ArrowKey 也會把 null 初始化成 (1,1)），故省略。
  await page.keyboard.press('Enter');
  await expect(page.locator('#turn-num')).toHaveText('第 2 手');
});

test('規則 overlay：點規則按鈕開啟', async ({ page }) => {
  await expect(page.locator('#rules-overlay')).toBeHidden();
  await page.locator('#btn-rules').click();
  await expect(page.locator('#rules-overlay')).toBeVisible();
  await expect(page.locator('#rules-title')).toHaveText('方垛式四子棋');
});

test('規則 overlay：× 按鈕關閉', async ({ page }) => {
  await page.locator('#btn-rules').click();
  await expect(page.locator('#rules-overlay')).toBeVisible();
  await page.locator('#rules-close').click();
  await expect(page.locator('#rules-overlay')).toBeHidden();
});

test('規則 overlay：ESC 關閉（優先於勝負/取消選取）', async ({ page }) => {
  await page.locator('#btn-rules').click();
  await expect(page.locator('#rules-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#rules-overlay')).toBeHidden();
});

test('規則 overlay：開著時按 N（新局）會一併關閉', async ({ page }) => {
  await page.locator('#btn-rules').click();
  await expect(page.locator('#rules-overlay')).toBeVisible();
  // overlay 開著時觸發新局：應重置棋盤同時關閉 overlay（避免 overlay 遺留前景）
  await page.keyboard.press('n');
  await expect(page.locator('#rules-overlay')).toBeHidden();
  await expect(page.locator('#turn-num')).toHaveText('第 1 手');
});

test('規則 overlay：點背景關閉', async ({ page }) => {
  await page.locator('#btn-rules').click();
  await expect(page.locator('#rules-overlay')).toBeVisible();
  // 用左上角 position 點 backdrop（避開中央被 card 蓋住的區域）
  await page.locator('#rules-backdrop').click({ position: { x: 8, y: 8 } });
  await expect(page.locator('#rules-overlay')).toBeHidden();
});

test('規則 overlay：首次造訪自動顯示，再次造訪不顯示', async ({ browser }) => {
  // 用全新 context 繞過 beforeEach 的 addInitScript（page-scoped 沒辦法在單測試覆蓋）
  const context = await browser.newContext();
  const page = await context.newPage();
  // 焦點是規則 auto-show 行為，預設 splash 已看過避免攔截
  await page.addInitScript(() => {
    window.localStorage.setItem('score-four:visited', '1');
  });
  await page.goto('/');
  await expect(page.locator('#rules-overlay')).toBeVisible({ timeout: 2000 });
  // 關閉應寫入 localStorage
  await page.locator('#rules-close').click();
  await expect(page.locator('#rules-overlay')).toBeHidden();
  // 再次 navigate（同 context 共享 localStorage）：不應自動顯示
  await page.goto('/');
  await expect(page.locator('#turn-label')).toBeVisible();
  await expect(page.locator('#rules-overlay')).toBeHidden();
  await context.close();
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
