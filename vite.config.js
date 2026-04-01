import { defineConfig } from 'vite';

export default defineConfig({
  // 서브경로 정적 호스팅에서도 ./images/ 등 상대 경로가 동작하도록
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  define: {
    'process.env.VITE_POCKETBASE_URL': JSON.stringify(process.env.VITE_POCKETBASE_URL || '')
  }
});
