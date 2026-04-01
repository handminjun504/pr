/**
 * 빌드 시 Vite가 VITE_* 를 주입합니다.
 * gl-server 정적 호스팅 시 빌드: VITE_POCKETBASE_URL=https://pb.example.com npm run build
 */

window.ENV = {
  POCKETBASE_URL:
    import.meta.env?.VITE_POCKETBASE_URL || process.env.VITE_POCKETBASE_URL || ''
};
