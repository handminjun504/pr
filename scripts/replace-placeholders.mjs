/**
 * gl-migration/prepared/replace-map.json 을 읽어
 * gc_proposals.records.placeholder.json 등의 __GC_*__ 를 실제 PB id로 치환합니다.
 *
 * replace-map.json 예:
 * {
 *   "clients": { "12": "pbc_xxx" },
 *   "services": { "accountManagement": "pbc_yyy" },
 *   "proposals": { "5": "pbc_zzz" }
 * }
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const prep = path.join(root, 'gl-migration', 'prepared');
const mapPath = path.join(prep, 'replace-map.json');

if (!fs.existsSync(mapPath)) {
  console.error('replace-map.json 이 없습니다. prepared/README_REPLACE.txt 를 참고해 만드세요.');
  process.exit(1);
}

const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

function apply(str) {
  if (typeof str !== 'string') return str;
  let out = str;
  for (const [sid, pid] of Object.entries(map.clients || {})) {
    out = out.split(`__GC_CLIENT_${sid}__`).join(pid);
  }
  for (const [key, pid] of Object.entries(map.services || {})) {
    out = out.split(`__GC_SVC_${key}__`).join(pid);
  }
  for (const [pid, rid] of Object.entries(map.proposals || {})) {
    out = out.split(`__GC_PROP_${pid}__`).join(rid);
  }
  return out;
}

function walk(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return apply(obj);
  if (Array.isArray(obj)) return obj.map(walk);
  if (typeof obj === 'object') {
    const n = {};
    for (const [k, v] of Object.entries(obj)) n[k] = walk(v);
    return n;
  }
  return obj;
}

for (const file of ['gc_proposals.records.placeholder.json', 'gc_proposal_service_selections.records.placeholder.json']) {
  const p = path.join(prep, file);
  if (!fs.existsSync(p)) continue;
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  const done = walk(data);
  const out = p.replace('.placeholder.json', '.resolved.json');
  fs.writeFileSync(out, JSON.stringify(done, null, 2), 'utf8');
  console.log('Wrote', out);
}
