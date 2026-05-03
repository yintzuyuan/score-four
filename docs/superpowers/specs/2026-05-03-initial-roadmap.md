# Score Four — 初始開發路線圖

**狀態**：✅ approved（2026-05-03）
**對應 Issue/PR**：[#2 P2 測試底](https://github.com/yintzuyuan/score-four/issues/2)
**原始 brainstorming plan**：`~/.claude/plans/clever-inventing-rose.md`（私人）

---

## Context

`~/Downloads/score-four.html` 是一份完整可玩的「方垛式四子棋」3D 立體四子棋原型（單檔約 1100 行，Three.js + importmap，含完整遊戲邏輯、視角控制、鍵盤操作、勝負判定）。原型在技術品質上已可上線，但目前是孤立的 Downloads 檔案，沒有版本控制、沒有建構流程、沒有部署、沒有測試保護。

本路線圖將原型提升為一個正式的 side project：

- 放在個人官網 `erikyin.net` 的作品集中，有可分享的 URL 讓任何人開瀏覽器即玩
- 走建構流程（Vite + ESLint/Prettier）讓開發更穩定
- 持續迭代 UIUX 體驗（視角控制、鍵盤手感、視覺質感、勝負畫面、規則畫面、行動裝置）
- 透過測試（Vitest 單元 + Playwright E2E + 視覺回歸）保護後續 UI 重構

---

## 核心抉擇

| 主題 | 決策 | 理由 |
|---|---|---|
| Repo 結構 | 獨立 repo `score-four` | 個人官網是純靜態無 build，混入會打架；獨立才能自由用 Vite 工具鏈 |
| 部署 | GitHub Pages + GitHub Actions | 標準、零成本、與作品集整合自然 |
| 域名 | erikyin.net/score-four/（透過 yintzuyuan.github.io 的 CNAME 繼承） | 已自動掛上 |
| 語言 | 純 JS + JSDoc 漸進型別 | 原型已寫好，TS 化會分心；JSDoc 兼顧型別提示與最小改動 |
| 工具鏈 | Vite + ESLint + Prettier | Vite 對 importmap 遷移最順 |
| 測試 | Vitest（單元）+ Playwright（E2E + 視覺回歸） | 純函式 TDD；UI/3D 用 E2E 與截圖比對 |
| Git workflow | PR 流程 + Conventional Commits | feat/fix/refactor/test/docs/chore |

---

## Phase 拆解

```
P1 搬遷上線（已完成）
└── P2 測試底 + JSDoc + 視覺 baseline（進行中）
    ├── P3a U1 視角控制改 OrbitControls
    ├── P3b U4 獲勝畫面重做
    ├── P3c U2 鍵盤方向修正
    ├── P3d U5 規則說明 in-game overlay
    └── P3e U3 視覺/3D 質感（frontend-design 主導）
        └── P4 觸控手勢 + RWD 深化（+ PWA 可選）
```

P3 子階段彼此獨立，每個一條 PR；建議按列表順序，因為 OrbitControls 完成後才方便調整視角下測其他 UI。

---

## P1：搬遷上線（✅ 完成）

把原型搬進 Vite 結構、保留行為 100% 一致、deploy 到 GitHub Pages。**不重構、不加功能。**

完成內容：
- `~/code/personal/score-four/` 新 repo
- 拆分原型 HTML：`index.html` / `src/main.js` / `src/styles/main.css`
- importmap → npm import (`three@0.160.0`)
- Vite 5 + ESLint flat config + Prettier
- GitHub Actions deploy.yml 自動 build + deploy
- README + CLAUDE.md 規範

線上版本：https://erikyin.net/score-four/

---

## P2：測試底 + JSDoc + 視覺 baseline（進行中）

把純邏輯抽離成可測試模組、補上 Vitest TDD、加 Playwright 視覺 baseline，保護後續 UI 重構。

### 純函式抽離（`src/game/`）

從 `src/main.js` 抽出純函式到獨立模組，每個檔案配對 `tests/unit/*.test.js`，採 TDD 紅綠重構。

| 模組 | 職責 |
|---|---|
| `src/game/board.js` | `newBoard()`、`columnHeight(board, x, z)`、`isBoardFull(board)`、`SIZE` |
| `src/game/win-lines.js` | `WIN_LINES` 常數（76 條） |
| `src/game/check-win.js` | `checkWin(board, player)` |
| `src/game/screen-dir.js` | `screenDirToBoardDir(camera, sdx, sdz)` — 含 P3c baseline 測試 |
| `src/types.js` | JSDoc typedef 集中宣告 |

### Playwright E2E + 視覺 baseline

- `tests/e2e/play.spec.js`：完整對局流程（朱方落子→青方落子→悔棋→新局→鍵盤→勝負）
- `tests/e2e/visual.spec.js`：截圖 baseline（初始畫面、5 手後、勝負畫面）

### CI 整合

- `.github/workflows/test.yml`：PR + push main 觸發 lint + format + test:unit + test:e2e（不含 visual）
- `.github/workflows/deploy.yml`：push main 自動 build + deploy（保持原樣）

### 驗收

- `npm run test:unit` 全綠（≥40 tests）
- `npm run test:e2e` 全綠
- `npm run test:visual` baseline 已建立並 commit
- `main.js` 純邏輯改為從 `src/game/` import，行為與 P1 一致
- PR check：lint + test 全綠才能 merge

---

## P3：UIUX 精緻化

每個子階段都是獨立 PR，可獨立 review 與 merge。每個 PR 都會更新對應的視覺 baseline。

### P3a — U1 視角控制（slider → OrbitControls）

- 引入 `three/examples/jsm/controls/OrbitControls.js`
- 移除底部 view-panel 的 H/V slider，保留「重置視角」按鈕
- 觸控基本支援（OrbitControls 內建）
- 鍵盤旋轉視角（保留 `R` 為重置，新增 `[`/`]` 旋轉）

### P3b — U4 獲勝畫面重做

**問題**：現在 overlay 全螢幕遮罩，看不到剛連成的線。

**新設計**：
- 連線高亮成主角（`THREE.Line` + `LineDashedMaterial`，沿四顆棋珠中心連線）
- overlay 改側邊卡片，可手動關閉；加「檢視棋盤」按鈕暫時隱藏
- 連線持續高亮直到使用者按「再來一局」

### P3c — U2 鍵盤方向修正

**先做**：用 `tests/unit/screen-dir.test.js` 已有的 baseline 測試重現「不直覺」case。

**修正方向**：
- 從 +Z 看時「右 → -X」應改為「右 → +X」（right-handed Y-up 約定）
- 視角接近 45° 邊界時的軸向選擇可能會抖動，加 hysteresis
- 考慮改為「以游標當下螢幕位置為基準」而非「相機朝向投影」

### P3d — U5 規則說明 in-game overlay

**問題**：現在按「規則」按鈕用 `alert()` 跳瀏覽器原生視窗，破壞遊戲沉浸感與設計風格。

**新設計**：像一般遊戲的說明畫面 —
- 半透明背景蓋住棋盤（同 winner-overlay 樣式系統，但較淡）
- 中央卡片：標題、規則文字、視覺示意（小型 4×4×4 線框圖示連線方向）
- 右上角 × 關閉、`Esc` 可關、點背景區也可關
- 「不再顯示」checkbox（首次造訪時自動彈出）
- 第一次造訪的引導：自動顯示一次（localStorage 記錄）

### P3e — U3 視覺/3D 質感（frontend-design 主導）

**3D 渲染**
- 棋珠堆疊辨識：rim light（邊緣補光）、outline pass（後製描邊）、或 fresnel shader 邊緣高光
- 棋珠材質微調：`roughness` 0.35 → 0.5、加微 metalness、強化光照對比
- 環境光遮蔽（SSAO 可選，weight cost 高）
- 棋珠下墜物理感：彈跳曲線改用 cubic ease-out + 落下震動效果

**UI 精緻化**
- 字體層級、配色微調、HUD 卡片質感
- 啟動畫面（loading）

### 驗收（P3 整體）

- 每個 PR 視覺回歸測試通過或人工確認 baseline 更新
- 完整對局 E2E 仍綠
- 在三種以上視角下手動操作鍵盤、滑鼠、觸控

---

## P4：觸控手勢 + RWD 深化（+ PWA 可選）

- pinch zoom、雙指旋轉視角
- 行動裝置 viewport meta 微調、底部按鈕觸控目標 ≥ 44px
- 全螢幕模式、橫向支援
- PWA：`manifest.json`、Service Worker 離線快取（看時程）

---

## 範圍外（不做）

- AI 對手、線上多人對戰、不同盤面尺寸（5×5×5）、玩家系統
- 統計面板、棋譜回放、雲端存檔

這些列為「未來考慮」，避免 scope creep。
