# 方垛式四子棋 · Score Four

3D 立體四子棋遊戲。在 4×4×4 的立體棋盤上落子，率先在三維空間中（橫、直、斜，含跨層對角線）連成 4 顆同色者勝。

> 線上 demo（部署後補上連結）

## 操作

- **滑鼠**：點選柱子落子，滾輪縮放
- **鍵盤**：方向鍵選取 → `Enter`／`Space` 落子
- **快捷鍵**：`Z` 悔棋 · `R` 重置視角 · `N` 新局 · `Esc` 取消選取
- **視角**：右下角 H／V 控制桿（P3a 之後改為游標拖拽）

## 規則

- 棋盤為 4×4×4 立柱結構，共 16 根柱子，每柱可放 4 顆棋珠
- 雙方輪流選一根未滿的柱子，棋珠因重力落到該柱最底空位
- 共有 76 條獲勝線

## 技術棧

- **Three.js 0.160** — 3D 渲染
- **Vite 5** — 開發與建構
- **ESLint + Prettier** — 程式碼一致性
- **Vitest（P2 後）** — 純函式單元測試
- **Playwright（P2 後）** — E2E 與視覺回歸測試

## 開發

```bash
npm install
npm run dev          # 開發伺服器 (http://localhost:5173)
npm run build        # 建構到 dist/
npm run preview      # 預覽 build 結果
npm run lint         # ESLint 檢查
npm run format       # Prettier 格式化
```

## 部署

push 到 `main` 後，GitHub Actions 自動 build 並 deploy 到 GitHub Pages。

`vite.config.js` 的 `base` 路徑透過環境變數 `VITE_BASE` 控制：

- 預設 `/score-four/`（GH Pages 子目錄）
- 自訂域名時設為 `/`

## 開發路線圖

| Phase   | 內容                                               |
| ------- | -------------------------------------------------- |
| **P1**  | 從原型搬遷到 Vite 結構 + GH Pages 部署             |
| **P2**  | 純函式抽離 + Vitest TDD + Playwright 視覺 baseline |
| **P3a** | 視角控制改 OrbitControls                           |
| **P3b** | 獲勝畫面重做（連線高亮為主）                       |
| **P3c** | 鍵盤方向修正（screenDirToBoardDir）                |
| **P3d** | 視覺/3D 質感（棋珠 rim light、UI 細節）            |
| **P4**  | 觸控手勢 + 行動裝置體驗                            |

詳見 `docs/superpowers/specs/`（P1 結束後遷移自原始計畫檔）。

## 授權

© Erikyin · 個人作品集專案
