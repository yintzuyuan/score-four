# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概覽

3D 立體四子棋（方垛式四子棋 / Score Four）。原型來自 `~/Downloads/score-four.html`，已搬遷為 Vite 專案，部署到 GitHub Pages，作為個人官網 `erikyin.net` 作品集的一部分。

## 技術棧

- **Three.js 0.160**（與原型同版，避免行為漂移）
- **Vite 5** + **vanilla JS**（不引入 TypeScript，後續用 JSDoc 漸進加型別）
- **ESLint flat config**（`eslint.config.js`）+ **Prettier**
- **Vitest**（P2 之後）— 單元測試
- **Playwright**（P2 之後）— E2E 與視覺回歸

## 目錄結構

```
score-four/
├── index.html                      # 入口 HTML
├── src/
│   ├── main.js                     # 主程式（P2 後拆分為 game/three/ui 模組）
│   ├── styles/main.css             # 樣式
│   ├── game/                       # P2：純遊戲邏輯（可單元測試）
│   │   ├── board.js
│   │   ├── win-lines.js
│   │   ├── check-win.js
│   │   └── screen-dir.js
│   └── types.js                    # P2：JSDoc typedef
├── tests/                          # P2 之後
│   ├── unit/                       # Vitest
│   └── e2e/                        # Playwright
├── vite.config.js
├── eslint.config.js
├── .prettierrc
└── .github/workflows/deploy.yml    # GH Pages auto deploy
```

## TDD 範圍（重要）

並非全部程式碼都走 TDD。本專案的測試金字塔：

| 層                    | 測試方式                   | 範圍                             |
| --------------------- | -------------------------- | -------------------------------- |
| **遊戲純邏輯**        | Vitest TDD（嚴格紅綠重構） | `src/game/` 下的所有純函式       |
| **DOM/UI 互動**       | Playwright E2E             | 完整對局流程、按鈕、鍵盤         |
| **3D 視覺**           | Playwright 截圖回歸        | 初始畫面、5 手後、勝負、不同視角 |
| **Three.js 場景組裝** | 不寫測試                   | 維護成本過高，靠視覺回歸把關     |

修改 `src/game/` 任何純函式 → **必須先有失敗的測試**，再改實作。
修改 `src/main.js` 的 Three.js 部分 → 跑 `npm run test:e2e` 與視覺回歸確認沒破。

## Git 工作流程

程式碼專案，**走 PR 流程**（不直推 main）：

1. `feature/<issue#>-<description>` 或 `fix/<issue#>-<description>` 分支
2. Conventional Commits：`feat:` / `fix:` / `refactor:` / `style:` / `test:` / `docs:` / `chore:`
3. PR body 包含 `fixes #N` 或 `closes #N`
4. 透過 GitHub 介面 merge，刪除分支

直推 main 例外：純文件修錯字、CI 修復。其他都走 PR。

## 不可妥協的核心原則

繼承自全域 CLAUDE.md：

- **繁體中文**（台灣 IT 術語）
- **禁止硬編碼路徑**：`vite.config.js` 的 `base` 已用環境變數
- **絕對強制 TDD**：適用於 `src/game/` 純邏輯
- **減法重構**：統一而非添加；先完成再優化
- **PreToolUse hooks**：保護 `.env`/lock 檔案，不繞過

## 部署

- 觸發：push `main` → GitHub Actions
- 流程：checkout → npm ci → npm run build → upload artifact → GH Pages deploy
- 環境變數：`VITE_BASE` 控制 base path（預設 `/score-four/`，自訂域名時設為 `/`）

## 開發路線圖（Phase 對應）

詳見 `~/.claude/plans/clever-inventing-rose.md`（P1 結束後會遷移為本 repo 的 `docs/superpowers/specs/`）。

當前 Phase：**P1 搬遷上線**

## 已知議題（P3 之後處理）

- 視角控制目前用 H/V slider，將改為 OrbitControls 拖拽
- 鍵盤方向投影（`screenDirToBoardDir`）在某些視角下不直覺，待調查
- 獲勝後 overlay 全螢幕遮住連線本體，將改為側邊卡片
- 規則按鈕用 `alert()` 跳瀏覽器原生視窗，將改為 in-game overlay（半透明背景、可關閉、首次自動顯示）
- 棋珠堆疊時辨識度不足，需要 rim light/outline 處理

## 暫時不做（範圍外）

- AI 對手、線上多人、不同盤面尺寸（5×5×5）、玩家系統
- 統計面板、棋譜回放、雲端存檔
