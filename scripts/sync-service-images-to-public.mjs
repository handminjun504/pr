/**
 * images/service-image-map.json 기준으로 원본 이미지를
 * public/images/{serviceId}.확장자 형태로 복사합니다.
 *
 * DB(PocketBase) 업로드 없이 정적 이미지로 서비스 상세 이미지를 보여줄 때 사용.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const sourceDir = path.join(root, 'images');
const publicImagesDir = path.join(root, 'public', 'images');
const mapPath = path.join(sourceDir, 'service-image-map.json');

function resolveImageFile(dir, wantedName) {
  const exact = path.join(dir, wantedName);
  if (fs.existsSync(exact)) return exact;

  const wantedNfc = wantedName.normalize('NFC');
  const wantedNfd = wantedName.normalize('NFD');

  for (const entry of fs.readdirSync(dir)) {
    if (entry.startsWith('._') || entry === 'service-image-map.json') continue;
    if (entry === wantedName) return path.join(dir, entry);
    if (entry.normalize('NFC') === wantedNfc) return path.join(dir, entry);
    if (entry.normalize('NFD') === wantedNfd) return path.join(dir, entry);
  }
  return null;
}

function main() {
  if (!fs.existsSync(mapPath)) {
    console.error('없음:', mapPath);
    process.exit(1);
  }

  const mapping = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  fs.mkdirSync(publicImagesDir, { recursive: true });

  let copied = 0;
  let skipped = 0;

  for (const [serviceId, sourceName] of Object.entries(mapping)) {
    if (typeof sourceName !== 'string' || !sourceName.trim()) {
      skipped++;
      continue;
    }

    const src = resolveImageFile(sourceDir, sourceName.trim());
    if (!src) {
      console.warn(`[skip] 파일 없음: ${sourceName} (${serviceId})`);
      skipped++;
      continue;
    }

    const ext = path.extname(src) || '.png';
    const dest = path.join(publicImagesDir, `${serviceId}${ext}`);
    fs.copyFileSync(src, dest);
    console.log(`[ok] ${serviceId} -> public/images/${serviceId}${ext}`);
    copied++;
  }

  console.log(`\n완료: 복사 ${copied}, 스킵 ${skipped}`);
}

main();
