/**
 * 환경 변수 설정
 * Vercel 배포 시 환경 변수가 자동으로 주입됩니다
 */

window.ENV = {
    SUPABASE_URL: import.meta.env?.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    SUPABASE_ANON_KEY: import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''
};
