/**
 * Supabase(REST)에서 테이블 덤프 → gl-migration/export/*.json
 * 레거시 numeric id를 legacy_supabase_id 등으로 보존해 gl-server 이관 시 매핑에 사용.
 *
 * 사용:
 *   export SUPABASE_URL="https://xxx.supabase.co"
 *   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."   # 또는 읽기 가능한 키( RLS 주의 )
 *   node scripts/export-supabase-for-gl.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'gl-migration', 'export');
fs.mkdirSync(outDir, { recursive: true });

const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!base || !key) {
  console.error('SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY(권장) 또는 SUPABASE_ANON_KEY 가 필요합니다.');
  process.exit(1);
}

const tables = [
  'proposal_services',
  'proposal_clients',
  'proposals',
  'proposal_service_selections',
  'proposal_templates'
];

async function fetchAll(table) {
  const url = `${base}/rest/v1/${table}?select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/json'
    }
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${table}: ${res.status} ${t}`);
  }
  return res.json();
}

for (const t of tables) {
  try {
    const rows = await fetchAll(t);
    const file = path.join(outDir, `${t}.json`);
    fs.writeFileSync(file, JSON.stringify(rows, null, 2), 'utf8');
    console.log(`${t}: ${rows.length} rows → ${file}`);
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
