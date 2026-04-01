/**
 * services-data.json → gl-server bulk_create_records용 gc_proposal_services 레코드 배열
 * 실행: node scripts/generate-gl-service-seeds.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'services-data.json'), 'utf8'));

let sort = 0;
const records = [];
for (const [service_id, s] of Object.entries(data)) {
  sort += 1;
  records.push({
    service_id,
    category: s.category,
    title: s.title,
    icon: s.icon ?? '',
    method: s.method,
    detail: s.detail,
    effect: s.effect,
    sample: s.sample ?? '',
    is_active: true,
    sort_order: sort
  });
}

const outDir = path.join(root, 'gl-migration', 'seeds');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'gc_proposal_services.records.json');
fs.writeFileSync(outPath, JSON.stringify(records, null, 2), 'utf8');
console.log(`Wrote ${records.length} records → ${outPath}`);
