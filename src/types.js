/**
 * 集中型別宣告。其他模組以 `@typedef {import('./types.js').Foo} Foo` 引用。
 *
 * 純 JS 專案，無 build-time 型別檢查；JSDoc 的價值在 IDE 智慧提示與文件性。
 *
 * @file
 */

/**
 * 棋盤一格的內容。
 * @typedef {0 | 1 | 2} Cell
 */

/**
 * 玩家識別。1 = 朱方，2 = 青方。
 * @typedef {1 | 2} Player
 */

/**
 * 棋盤模型：4×4×4 三維陣列，索引順序 [x][z][y]（保持與原型一致）。
 * @typedef {Cell[][][]} Board
 */

/**
 * 棋盤上一個座標點。
 * @typedef {[number, number, number]} Coord
 */

/**
 * 一條獲勝線（4 個座標點）。
 * @typedef {[Coord, Coord, Coord, Coord]} WinLine
 */

/**
 * 落子歷史紀錄項目（給悔棋用）。
 * @typedef {Object} Move
 * @property {number} x
 * @property {number} z
 * @property {number} y
 * @property {Player} player
 */

/**
 * 場上的棋珠物件（含 Three.js mesh + 動畫狀態）。
 * @typedef {Object} Bead
 * @property {import('three').Mesh} mesh
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {Player} player
 * @property {number} targetY    棋珠最終靜止的 y 座標
 * @property {number} velocity   下墜速度（每幀更新）
 * @property {boolean} landed    是否已停穩
 */

/**
 * 球座標視角狀態。
 * @typedef {Object} View
 * @property {number} radius     相機到原點距離
 * @property {number} hAngle     水平方位角（度）
 * @property {number} vAngle     垂直仰角（度）
 * @property {number} defaultH
 * @property {number} defaultV
 * @property {number} defaultR
 */

/**
 * 棋盤上的一根柱子（含視覺 mesh、hitbox、hover 視覺指示器）。
 * @typedef {Object} Pole
 * @property {import('three').Mesh} mesh
 * @property {import('three').Mesh} hitbox
 * @property {number} x
 * @property {number} z
 * @property {import('three').Mesh} hoverRing
 */

// 純宣告檔，無 runtime export。
export {};
