/**
 * images/service-image-map.json 기준으로 로컬 이미지를 PocketBase gc_proposal_services에 업로드하고,
 * 동일 파일을 public/images/{serviceId}.확장자 로 복사해 정적 폴백에도 맞춥니다.
 *
 * 사전: Admin에서 gc_proposal_services 컬렉션에 illustration (file, max 1) 필드를 추가하세요.
 *
 * 환경: .env.migrate 또는 환경 변수
 *   POCKETBASE_URL
 *   POCKETBASE_ADMIN_EMAIL
 *   POCKETBASE_ADMIN_PASSWORD
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Blob } from 'buffer';
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

const PB_URL = (process.env.POCKETBASE_URL || '').replace(/\/$/, '');
const EMAIL = process.env.POCKETBASE_ADMIN_EMAIL || '';
const PASS = process.env.POCKETBASE_ADMIN_PASSWORD || '';

if (!PB_URL || !EMAIL || !PASS) {
  console.error(
    'POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD 가 필요합니다 (.env.migrate 권장).'
  );
  process.exit(1);
}

const IMAGES_DIR = path.join(root, 'images');
const MAP_PATH = path.join(IMAGES_DIR, 'service-image-map.json');
const PUBLIC_IMAGES = path.join(root, 'public', 'images');
const COL = 'gc_proposal_services';

function mimeFor(ext) {
  const e = ext.toLowerCase();
  if (e === '.png') return 'image/png';
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
  if (e === '.webp') return 'image/webp';
  if (e === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

/** map.json(NFC) vs APFS(NFD) 불일치 대비 */
function resolveImageFile(dir, wantedName) {
  const exact = path.join(dir, wantedName);
  if (fs.existsSync(exact)) return exact;
  const wN = wantedName.normalize('NFC');
  const wD = wantedName.normalize('NFD');
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith('._') || f === 'service-image-map.json') continue;
    if (f === wantedName || f.normalize('NFC') === wN || f.normalize('NFD') === wD) {
      return path.join(dir, f);
    }
  }
  return null;
}

function logClientError(label, err) {
  console.error(`  → ${label}:`, err?.message || err);
  if (err?.status != null) console.error('     HTTP status:', err.status);
  if (err?.url) console.error('     요청 URL:', err.url);
  if (err?.isAbort) console.error('     (요청이 auto-cancellation 으로 취소됨 → 스크립트에서 pb.autoCancellation(false) 사용)');
  if (err?.originalError) {
    console.error('     원인:', err.originalError?.message || err.originalError);
    if (err.originalError?.cause) console.error('     cause:', err.originalError.cause?.message || err.originalError.cause);
  }
  if (err?.response && Object.keys(err.response).length) {
    console.error('     응답:', JSON.stringify(err.response));
  }
}

async function authAdmin(pb) {
  let superErr;
  try {
    await pb.collection('_superusers').authWithPassword(EMAIL, PASS);
    return;
  } catch (e) {
    superErr = e;
  }
  try {
    await pb.admins.authWithPassword(EMAIL, PASS);
    return;
  } catch (adminErr) {
    console.error('관리자 로그인 실패.');
    logClientError('_superusers (PB 0.23+)', superErr);
    logClientError('admins (PB 구버전)', adminErr);
    console.error(
      '\n확인: PocketBase가 켜져 있는지(curl ' + PB_URL + '/api/health), POCKETBASE_URL이 브라우저 Admin과 동일한지, http↔https 혼동 없는지, 이메일·비밀번호가 슈퍼유저와 일치하는지.'
    );
    process.exit(1);
  }
}

async function main() {
  if (!fs.existsSync(MAP_PATH)) {
    console.error('없음:', MAP_PATH);
    process.exit(1);
  }

  const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  const pb = new PocketBase(PB_URL);
  // Node 스크립트에서 연속 요청이 서로 취소되며 "Something went wrong" 가 나는 경우 방지
  pb.autoCancellation(false);

  try {
    await pb.health.check();
  } catch (e) {
    console.error('PocketBase에 연결할 수 없습니다:', PB_URL);
    console.error('  →', e?.message || e);
    console.error('  서버를 띄운 뒤 다시 실행하세요. (예: ./pocketbase serve)');
    process.exit(1);
  }

  await authAdmin(pb);

  fs.mkdirSync(PUBLIC_IMAGES, { recursive: true });

  let ok = 0;
  let fail = 0;

  for (const [serviceId, fileName] of Object.entries(map)) {
    if (typeof fileName !== 'string' || !fileName.trim()) continue;

    const src = resolveImageFile(IMAGES_DIR, fileName.trim());
    if (!src) {
      console.warn(`[skip] 파일 없음: ${fileName} (${serviceId})`);
      fail++;
      continue;
    }

    let record;
    try {
      record = await pb.collection(COL).getFirstListItem(`service_id = "${serviceId.replace(/"/g, '\\"')}"`);
    } catch {
      console.warn(`[skip] PB에 service_id 없음: ${serviceId}`);
      fail++;
      continue;
    }

    const buf = fs.readFileSync(src);
    const ext = path.extname(src) || '.png';
    const blob = new Blob([buf], { type: mimeFor(ext) });
    const formData = new FormData();
    formData.append('illustration', blob, path.basename(src));

    try {
      await pb.collection(COL).update(record.id, formData);
      console.log(`[ok] ${serviceId} ← ${fileName}`);
      ok++;
    } catch (e) {
      console.error(`[err] ${serviceId}:`, e.message || e);
      if (String(e.message || e).includes('illustration') || String(e).includes('unknown')) {
        console.error(
          '  → gc_proposal_services 에 illustration (file, max 1) 필드를 추가했는지 Admin에서 확인하세요.'
        );
      }
      fail++;
      continue;
    }

    const outName = `${serviceId}${ext}`;
    const dest = path.join(PUBLIC_IMAGES, outName);
    fs.copyFileSync(src, dest);
  }

  console.log(`\n완료: 성공 ${ok}, 실패/스킵 ${fail}`);
  pb.authStore.clear();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
