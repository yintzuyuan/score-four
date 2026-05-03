import { defineConfig } from 'vite';

// GH Pages 子目錄部署時 base 必須是 `/score-four/`；
// 自訂域名（CNAME）時應為 `/`。透過環境變數覆寫，避免硬編碼。
const base = process.env.VITE_BASE ?? '/score-four/';

export default defineConfig({
  base,
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: false,
  },
});
