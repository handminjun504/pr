/**
 * Supabase → gl-server(PocketBase) 경청(gc_*) 컬렉션으로 한 번에 이관.
 *
 * 필요 환경 변수:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (권장, RLS 우회) 또는 SUPABASE_ANON_KEY
 *   POCKETBASE_URL             (예: http://192.168.0.53:8090 — 실제 PB API 베이스)
 *   POCKETBASE_ADMIN_EMAIL
 *   POCKETBASE_ADMIN_PASSWORD
 *
 * 선택: .env.migrate 파일 (repo 밖에 두거나 gitignore 권장)
 *   KEY=value 한 줄씩
 *
 * 실행: npm run migrate:legacy-supabase-to-gl
 *        (또는 node scripts/full-migrate-to-gl.mjs)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnvFile('.env.migrate');
loadEnvFile('.env.local');

const SB = process.env.SUPABASE_URL?.replace(/\/$/, '');
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const PB = process.env.POCKETBASE_URL?.replace(/\/$/, '');
const PB_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const PB_PASS = process.env.POCKETBASE_ADMIN_PASSWORD;

const COL = {
  services: 'gc_proposal_services',
  clients: 'gc_proposal_clients',
  templates: 'gc_proposal_templates',
  proposals: 'gc_proposals',
  selections: 'gc_proposal_service_selections'
};

function die(msg) {
  console.error(msg);
  process.exit(1);
}

if (!SB || !SB_KEY) die('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY(또는 SUPABASE_ANON_KEY) 필요');
if (!PB || !PB_EMAIL || !PB_PASS) die('POCKETBASE_URL, POCKETBASE_ADMIN_EMAIL, POCKETBASE_ADMIN_PASSWORD 필요');

async function sbFetch(table) {
  const url = `${SB}/rest/v1/${table}?select=*`;
  const res = await fetch(url, {
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      Accept: 'application/json',
      Prefer: 'count=exact'
    }
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

let adminToken = '';

async function pbAuth() {
  const res = await fetch(`${PB}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) die(`PocketBase 로그인 실패: ${res.status} ${JSON.stringify(data)}`);
  adminToken = data.token;
  if (!adminToken) die('PocketBase token 없음 — URL이 실제 PocketBase API인지 확인하세요.');
  console.log('PocketBase 관리자 로그인 OK');
}

async function pb(path, opts = {}) {
  const res = await fetch(`${PB}${path}`, {
    ...opts,
    headers: {
      Authorization: adminToken,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...opts.headers
    }
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} → ${res.status} ${text.slice(0, 500)}`);
  return data;
}

/** service_id(문자) → PB 레코드 id */
async function loadServiceIndex() {
  const map = new Map();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const q = new URLSearchParams({ page: String(page), perPage: String(perPage) });
    const data = await pb(`/api/collections/${COL.services}/records?${q}`);
    const items = data.items || [];
    for (const r of items) {
      if (r.service_id) map.set(r.service_id, r.id);
    }
    const tp = data.totalPages;
    if (tp != null && page >= tp) break;
    if (items.length < perPage) break;
    page++;
    if (page > 500) break;
  }
  return map;
}

async function findClientByLegacy(supabaseId) {
  const filter = encodeURIComponent(`legacy_supabase_id=${Number(supabaseId)}`);
  const data = await pb(`/api/collections/${COL.clients}/records?filter=${filter}&perPage=1`);
  return data.items?.[0]?.id ?? null;
}

async function findProposalByLegacy(supabaseId) {
  const filter = encodeURIComponent(`legacy_supabase_id=${Number(supabaseId)}`);
  const data = await pb(`/api/collections/${COL.proposals}/records?filter=${filter}&perPage=1`);
  return data.items?.[0]?.id ?? null;
}

async function pbCreate(collection, body) {
  const created = await pb(`/api/collections/${collection}/records`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return created.id;
}

async function main() {
  console.log('Supabase에서 테이블 읽는 중…');
  let services = [];
  let clients = [];
  let proposals = [];
  let selections = [];
  let templates = [];
  try {
    services = await sbFetch('proposal_services');
  } catch (e) {
    console.warn('proposal_services:', e.message);
  }
  try {
    clients = await sbFetch('proposal_clients');
  } catch (e) {
    console.warn('proposal_clients:', e.message);
  }
  try {
    proposals = await sbFetch('proposals');
  } catch (e) {
    console.warn('proposals:', e.message);
  }
  try {
    selections = await sbFetch('proposal_service_selections');
  } catch (e) {
    console.warn('proposal_service_selections:', e.message);
  }
  try {
    templates = await sbFetch('proposal_templates');
  } catch (e) {
    console.warn('proposal_templates:', e.message);
  }

  console.log(
    `읽음: services ${services.length}, clients ${clients.length}, proposals ${proposals.length}, selections ${selections.length}, templates ${templates.length}`
  );

  await pbAuth();

  const serviceByKey = await loadServiceIndex();
  let createdSvc = 0;
  for (const s of services) {
    const key = s.service_id;
    if (!key || serviceByKey.has(key)) continue;
    const id = await pbCreate(COL.services, {
      service_id: key,
      category: s.category,
      title: s.title,
      icon: s.icon ?? '',
      method: s.method,
      detail: s.detail,
      effect: s.effect,
      sample: s.sample ?? '',
      is_active: s.is_active ?? true,
      sort_order: s.sort_order ?? 0
    });
    serviceByKey.set(key, id);
    createdSvc++;
  }
  console.log(`gc_proposal_services: 기존 ${serviceByKey.size - createdSvc}건, 신규 생성 ${createdSvc}건`);

  const clientMap = new Map();
  let clientsNew = 0;
  for (const c of clients) {
    const legacy = Number(c.id);
    let id = await findClientByLegacy(legacy);
    if (!id) {
      id = await pbCreate(COL.clients, {
        company_name: c.company_name,
        contact_name: c.contact_name ?? '',
        industry_type: c.industry_type ?? '',
        phone: c.phone ?? '',
        email: c.email ?? '',
        legacy_supabase_id: legacy
      });
      clientsNew++;
    }
    clientMap.set(legacy, id);
  }
  console.log(`gc_proposal_clients: ${clients.length}건 반영 (신규 ${clientsNew}건)`);

  let tplNew = 0;
  for (const t of templates) {
    const legacy = Number(t.id);
    const filter = encodeURIComponent(`legacy_supabase_id=${legacy}`);
    const ex = await pb(`/api/collections/${COL.templates}/records?filter=${filter}&perPage=1`);
    if (ex.items?.[0]) continue;
    await pbCreate(COL.templates, {
      name: t.name,
      payload: t.payload ?? {},
      is_default: t.is_default ?? false,
      usage_count: t.usage_count ?? 0,
      legacy_supabase_id: legacy
    });
    tplNew++;
  }
  console.log(`gc_proposal_templates: ${templates.length}건 처리 (신규 ${tplNew}건)`);

  const proposalMap = new Map();
  let propNew = 0;
  for (const p of proposals) {
    const legacy = Number(p.id);
    let id = await findProposalByLegacy(legacy);
    if (!id) {
      const cid = clientMap.get(Number(p.client_id));
      if (!cid) {
        console.warn(`제안서 스킵 (고객 매핑 없음) legacy client_id=${p.client_id}`);
        continue;
      }
      id = await pbCreate(COL.proposals, {
        client: cid,
        title: p.title,
        status: p.status ?? 'draft',
        include_existing_staff: p.include_existing_staff ?? false,
        include_erp_promo: p.include_erp_promo ?? true,
        custom_content: p.custom_content ?? {},
        pdf_url: p.pdf_url ?? '',
        sent_at: p.sent_at || '',
        legacy_supabase_id: legacy
      });
      propNew++;
    }
    proposalMap.set(legacy, id);
  }
  console.log(`gc_proposals: ${proposalMap.size}건 반영 (신규 ${propNew}건, 원본 ${proposals.length}건)`);

  let selOk = 0;
  let selSkipDup = 0;
  for (const s of selections) {
    const pid = proposalMap.get(Number(s.proposal_id));
    const svcId = serviceByKey.get(s.service_id);
    if (!pid || !svcId) {
      console.warn(
        `선택 스킵 proposal_id=${s.proposal_id} service_id=${s.service_id} (매핑 없음)`
      );
      continue;
    }
    const leg = Number(s.id);
    const f = encodeURIComponent(`legacy_supabase_id=${leg}`);
    const ex = await pb(`/api/collections/${COL.selections}/records?filter=${f}&perPage=1`);
    if (ex.items?.[0]) {
      selSkipDup++;
      continue;
    }
    await pbCreate(COL.selections, {
      proposal: pid,
      service: svcId,
      selection_type: s.selection_type,
      custom_title: s.custom_title ?? '',
      custom_method: s.custom_method ?? '',
      custom_detail: s.custom_detail ?? '',
      custom_effect: s.custom_effect ?? '',
      legacy_supabase_id: leg
    });
    selOk++;
  }
  console.log(
    `gc_proposal_service_selections: 신규 ${selOk}건, 이미 있음 ${selSkipDup}건, 원본 ${selections.length}건`
  );

  console.log('\n이관 완료.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
