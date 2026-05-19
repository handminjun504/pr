import { defineConfig } from 'vite';

/** 개발 서버 포트: PORT 환경변수 우선, 없거나 잘못된 값이면 3000 */
const devPort = Number.parseInt(process.env.PORT || '3000', 10);
const serverPort = Number.isFinite(devPort) && devPort > 0 ? devPort : 3000;

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
    port: serverPort,
    open: true
  },
  define: {
    'process.env.VITE_POCKETBASE_URL': JSON.stringify(process.env.VITE_POCKETBASE_URL || '')
  }
});
