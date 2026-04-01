/**
 * gl-migration/export/*.json (export-supabase-for-gl.mjs 결과)을
 * gl-server PocketBase 컬렉션 필드명에 맞게 변환합니다.
 *
 * proposals / selections 는 relation 필드에 넣을 PB 레코드 id를 아직 모르므로
 * 플레이스홀더 문자열을 넣습니다. 클라이언트·서비스·제안서를 gl에 만든 뒤
 * gl-migration/prepared/replace-map.json 을 채워 replace-placeholders.mjs 로 치환하세요.
 *
 * 실행: node scripts/transform-export-for-gl.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const expDir = path.join(root, 'gl-migration', 'export');
const outDir = path.join(root, 'gl-migration', 'prepared');
fs.mkdirSync(outDir, { recursive: true });

function read(name) {
  const f = path.join(expDir, name);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

const clients = read('proposal_clients.json');
const services = read('proposal_services.json');
const proposals = read('proposals.json');
const selections = read('proposal_service_selections.json');
const templates = read('proposal_templates.json');

if (!clients && !proposals) {
  console.error('gl-migration/export 에 JSON이 없습니다. 먼저 node scripts/export-supabase-for-gl.mjs 를 실행하세요.');
  process.exit(1);
}

const replaceMap = { clients: {}, services: {}, proposals: {} };

if (clients?.length) {
  const rows = clients.map((c) => ({
    company_name: c.company_name,
    contact_name: c.contact_name ?? '',
    industry_type: c.industry_type ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    legacy_supabase_id: c.id
  }));
  fs.writeFileSync(path.join(outDir, 'gc_proposal_clients.records.json'), JSON.stringify(rows, null, 2), 'utf8');
  for (const c of clients) {
    replaceMap.clients[String(c.id)] = `__GC_CLIENT_${c.id}__`;
  }
  console.log(`gc_proposal_clients: ${rows.length} rows`);
}

if (services?.length) {
  const rows = services.map((s) => ({
    service_id: s.service_id,
    category: s.category,
    title: s.title,
    icon: s.icon ?? '',
    method: s.method,
    detail: s.detail,
    effect: s.effect,
    sample: s.sample ?? '',
    is_active: s.is_active ?? true,
    sort_order: s.sort_order ?? 0
  }));
  fs.writeFileSync(path.join(outDir, 'gc_proposal_services.from-supabase.json'), JSON.stringify(rows, null, 2), 'utf8');
  for (const s of services) {
    replaceMap.services[s.service_id] = `__GC_SVC_${s.service_id}__`;
  }
  console.log(`gc_proposal_services (from Supabase): ${rows.length} rows`);
}

if (templates?.length) {
  const rows = templates.map((t) => ({
    name: t.name,
    payload: t.payload ?? {},
    is_default: t.is_default ?? false,
    usage_count: t.usage_count ?? 0,
    legacy_supabase_id: t.id
  }));
  fs.writeFileSync(path.join(outDir, 'gc_proposal_templates.records.json'), JSON.stringify(rows, null, 2), 'utf8');
  console.log(`gc_proposal_templates: ${rows.length} rows`);
}

if (proposals?.length) {
  const rows = proposals.map((p) => ({
    client: replaceMap.clients[String(p.client_id)] || `__GC_CLIENT_${p.client_id}__`,
    title: p.title,
    status: p.status ?? 'draft',
    include_existing_staff: p.include_existing_staff ?? false,
    include_erp_promo: p.include_erp_promo ?? true,
    custom_content: p.custom_content ?? {},
    pdf_url: p.pdf_url ?? '',
    sent_at: p.sent_at ?? '',
    legacy_supabase_id: p.id
  }));
  fs.writeFileSync(path.join(outDir, 'gc_proposals.records.placeholder.json'), JSON.stringify(rows, null, 2), 'utf8');
  for (const p of proposals) {
    replaceMap.proposals[String(p.id)] = `__GC_PROP_${p.id}__`;
  }
  console.log(`gc_proposals (placeholders): ${rows.length} rows`);
}

if (selections?.length && proposals?.length) {
  const rows = selections.map((s) => ({
    proposal: replaceMap.proposals[String(s.proposal_id)] || `__GC_PROP_${s.proposal_id}__`,
    service: replaceMap.services[s.service_id] || `__GC_SVC_${s.service_id}__`,
    selection_type: s.selection_type,
    custom_title: s.custom_title ?? '',
    custom_method: s.custom_method ?? '',
    custom_detail: s.custom_detail ?? '',
    custom_effect: s.custom_effect ?? '',
    legacy_supabase_id: s.id
  }));
  fs.writeFileSync(
    path.join(outDir, 'gc_proposal_service_selections.records.placeholder.json'),
    JSON.stringify(rows, null, 2),
    'utf8'
  );
  console.log(`gc_proposal_service_selections (placeholders): ${rows.length} rows`);
}

fs.writeFileSync(
  path.join(outDir, 'README_REPLACE.txt'),
  [
    '1) gl에 gc_* 컬렉션 생성 후 bulk_create 로 레코드를 만듭니다.',
    '2) 각 Supabase id / service_id 에 대응하는 PocketBase record id 를 적어 replace-map.json 을 만듭니다.',
    '   형식 예:',
    '   {',
    '     "clients": { "12": "abc123pbid" },',
    '     "services": { "accountManagement": "xyz789pbid" },',
    '     "proposals": { "5": "prop_pb_id" }',
    '   }',
    '3) node scripts/replace-placeholders.mjs',
    '',
    '플레이스홀더:',
    JSON.stringify(replaceMap, null, 2)
  ].join('\n'),
  'utf8'
);

console.log(`\nPrepared → ${outDir}`);
