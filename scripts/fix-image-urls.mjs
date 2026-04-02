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

function loadEnvFile(name) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
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
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFile('.env.migrate');

/** Node에서 localhost → ::1 로 잡혀 PocketBase(IPv4만)와 맞지 않는 경우 방지 */
function normalizePocketBaseUrl(raw) {
  const trimmed = (raw || '').replace(/\/$/, '');
  return trimmed.replace(/^http:\/\/localhost\b/i, 'http://127.0.0.1').replace(/^https:\/\/localhost\b/i, 'https://127.0.0.1');
}

const PB_URL = normalizePocketBaseUrl(process.env.POCKETBASE_URL || '');
const EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || '';
const PASS = process.env.POCKETBASE_ADMIN_PASSWORD || '';

if (!PB_URL || !EMAIL || !PASS) {
  console.error('POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD 필요 (.env.migrate 권장)');
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

async function main() {
  console.log('[fix:image-urls] POCKETBASE_URL =', PB_URL);

  const pb = new PocketBase(PB_URL);
  pb.autoCancellation(false);

  try {
    await checkReachable(PB_URL);
  } catch (e) {
    console.error('PocketBase 연결 실패:', e?.message || e);
    console.error('  → 같은 PC에서 PowerShell이면: $env:POCKETBASE_URL="http://127.0.0.1:8090"');
    console.error('  → .env.migrate 의 PB 주소가 192.168.x.x 면 방화벽·NIC 문제일 수 있음. 127.0.0.1:8090 권장');
    process.exit(1);
  }

  try {
    await pb.collection('_superusers').authWithPassword(EMAIL, PASS);
  } catch {
    try {
      await pb.admins.authWithPassword(EMAIL, PASS);
    } catch (e) {
      console.error('관리자 로그인 실패:', e?.message || e);
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
