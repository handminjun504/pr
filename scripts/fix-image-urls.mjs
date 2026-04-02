/**
 * gc_proposal_services 의 image_url 필드를 ./images/{serviceId}.png 형식으로 일괄 업데이트
 *
 * 환경: .env.migrate 또는 환경 변수
 *   POCKETBASE_URL
 *   POCKETBASE_ADMIN_EMAIL
 *   POCKETBASE_ADMIN_PASSWORD
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PocketBase from 'pocketbase';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** migrate 전용: 파일이 있으면 키가 정의된 항목은 항상 적용 (setx 로 남은 잘못된 URL 이 실제 파일보다 우선되던 문제 방지) */
function loadEnvFileMigrate(name) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) return { path: p, loaded: false };
  const text = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (v !== '') process.env[k] = v;
  }
  return { path: p, loaded: true };
}

const migrateEnv = loadEnvFileMigrate('.env.migrate');

/** Node에서 localhost → ::1 로 잡혀 PocketBase(IPv4만)와 맞지 않는 경우 방지 */
function normalizePocketBaseUrl(raw) {
  const trimmed = (raw || '').replace(/\/$/, '');
  return trimmed.replace(/^http:\/\/localhost\b/i, 'http://127.0.0.1').replace(/^https:\/\/localhost\b/i, 'https://127.0.0.1');
}

const PB_URL = normalizePocketBaseUrl((process.env.POCKETBASE_URL || '').trim());
const EMAIL = (process.env.POCKETBASE_ADMIN_EMAIL || '').trim();
const PASS = (process.env.POCKETBASE_ADMIN_PASSWORD || '').trim();

if (!PB_URL || !EMAIL || !PASS) {
  console.error('POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD 필요 (.env.migrate 권장)');
  if (!migrateEnv.loaded) console.error('  → 없음:', migrateEnv.path);
  process.exit(1);
}

if (typeof fetch === 'undefined') {
  console.error('Node 18+ 필요 (전역 fetch). 현재:', process.version);
  process.exit(1);
}

const COL = 'gc_proposal_services';
const PUBLIC_IMAGES = path.join(root, 'public', 'images');

async function checkReachable(baseUrl) {
  const healthUrl = `${baseUrl}/api/health`;
  let res;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 15_000);
  try {
    res = await fetch(healthUrl, { signal: ac.signal });
  } catch (err) {
    throw new Error(`HTTP 요청 실패 (${healthUrl}): ${err?.message || err}`);
  } finally {
    clearTimeout(t);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} (${healthUrl}): ${text.slice(0, 500)}`);
  }
  return text;
}

function logPbErr(label, err) {
  console.error(`  → ${label}:`, err?.message || err);
  if (err?.status != null) console.error('     HTTP status:', err.status);
  if (err?.url) console.error('     요청 URL:', err.url);
  if (err?.response && Object.keys(err.response).length) {
    console.error('     응답:', JSON.stringify(err.response));
  }
}

async function pickReachableBase(candidates) {
  const errors = [];
  for (const base of candidates) {
    if (!base) continue;
    try {
      await checkReachable(base);
      return base;
    } catch (e) {
      errors.push(`${base}: ${e?.message || e}`);
    }
  }
  throw new Error(errors.join(' | '));
}

async function main() {
  console.log('[fix:image-urls] cwd =', process.cwd());
  console.log('[fix:image-urls] .env.migrate =', migrateEnv.loaded ? migrateEnv.path : '(없음, 환경변수만 사용)');
  console.log('[fix:image-urls] POCKETBASE_URL =', PB_URL);

  const fallbackBases = [
    PB_URL,
    normalizePocketBaseUrl('http://127.0.0.1:8090'),
    'http://127.0.0.1:8090'
  ];
  const uniqueBases = [...new Set(fallbackBases)];

  let baseUrl;
  try {
    baseUrl = await pickReachableBase(uniqueBases);
  } catch (e) {
    console.error('PocketBase /api/health 실패 (시도한 URL):', uniqueBases.join(', '));
    console.error('  세부:', e?.message || e);
    console.error('  → PC에서 curl http://127.0.0.1:8090/api/health 가 되면, setx 로 POCKETBASE_URL 이 다른 값이면 이전에 .env.migrate 가 무시됐을 수 있음 → 스크립트는 이제 .env.migrate 가 우선합니다. git pull 후 다시 실행하세요.');
    process.exit(1);
  }

  if (baseUrl !== PB_URL) {
    console.log('[fix:image-urls] 연결에 성공한 주소로 전환:', baseUrl, '(설정값과 다름)');
  }

  const pb = new PocketBase(baseUrl);
  pb.autoCancellation(false);

  let superErr;
  try {
    await pb.collection('_superusers').authWithPassword(EMAIL, PASS);
  } catch (e) {
    superErr = e;
  }
  if (!pb.authStore.isValid) {
    try {
      await pb.admins.authWithPassword(EMAIL, PASS);
    } catch (adminErr) {
      console.error('연결(/api/health)은 성공했습니다. 아래는 관리자 로그인 실패입니다.');
      logPbErr('_superusers', superErr);
      logPbErr('admins (구버전)', adminErr);
      process.exit(1);
    }
  }

  const records = await pb.collection(COL).getFullList({ sort: 'sort_order' });
  let updated = 0;
  let skipped = 0;

  for (const row of records) {
    const sid = row.service_id;
    if (!sid) continue;

    const correctUrl = `./images/${sid}.png`;
    const current = (row.image_url || '').trim();

    if (current === correctUrl) {
      skipped++;
      continue;
    }

    if (!fs.existsSync(path.join(PUBLIC_IMAGES, `${sid}.png`))) {
      console.warn(`[skip] public/images/${sid}.png 파일 없음`);
      skipped++;
      continue;
    }

    try {
      await pb.collection(COL).update(row.id, { image_url: correctUrl });
      console.log(`[ok] ${sid}: "${current}" → "${correctUrl}"`);
      updated++;
    } catch (e) {
      console.error(`[err] ${sid}:`, e?.message || e);
    }
  }

  console.log(`\n완료: 업데이트 ${updated}, 스킵 ${skipped}`);
  pb.authStore.clear();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
