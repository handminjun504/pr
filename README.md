# 경청 서비스 소개서 생성기

고객 맞춤형 서비스 제안서를 만드는 웹 앱입니다. **데이터·백엔드는 gl-server의 PocketBase(`gc_*` 컬렉션)** 에 두고, 프론트는 Vite로 빌드한 정적 파일(`dist/`)을 gl(또는 임의 정적 호스팅)에 올립니다.

---

## 빠른 시작

### 로컬 개발

```bash
npm install
# PocketBase 공개 URL (끝에 슬래시 없이)
export VITE_POCKETBASE_URL=https://your-pb.example.com
npm run dev
```

PB에 연결하지 않으면 서비스 목록은 `services-data.json` 등 로컬 폴백으로 동작합니다.

### 프로덕션 빌드

```bash
VITE_POCKETBASE_URL=https://your-pb.example.com npm run build
```

`dist/` 를 웹 서버 루트로 배포합니다. 빌드 시점의 `VITE_POCKETBASE_URL` 이 `env.js`에 박혀 브라우저가 PB에 접속합니다.

---

## 구성

| 구분 | 설명 |
|------|------|
| PocketBase | `gc_proposal_services`, `gc_proposal_clients`, `gc_proposals`, `gc_proposal_service_selections`, `gc_proposal_templates` |
| 프론트 | Vite, `lib/gl-db.js`, `app.js`, `index.html` / `src/gl-bridge.js` |
| 환경 변수 | **`VITE_POCKETBASE_URL`** 만 필수(빌드·개발 시). 런타임 `window.ENV`에 반영됨 (`env.js`) |

스키마·시드·(선택) 레거시 이관 절차는 [gl-migration/MIGRATION.md](gl-migration/MIGRATION.md) 를 참고하세요.

---

## 운영 체크리스트

1. **PB URL**: 브라우저에서 접근 가능한 **API 베이스 URL** (Admin/MCP용 포트와 다를 수 있음).
2. **CORS**: PocketBase Admin → Settings → Allowed origins 에 프론트 출처(예: `https://제안서.도메인`) 추가.
3. **인증·규칙**: 운영 환경에 맞게 컬렉션 규칙·계정을 설정.

---

## 선택: 예전 Supabase 데이터 이관

과거 Supabase에만 테이블이 있을 때만 사용합니다.

```bash
cp .env.migrate.example .env.migrate   # 값 입력, 커밋 금지
npm run migrate:legacy-supabase-to-gl
```

신규 구축이면 PB에 스키마·시드만 적용하면 됩니다.

---

## 문서

- [DEPLOYMENT.md](DEPLOYMENT.md) — 배포·환경 변수 요약
- [gl-migration/MIGRATION.md](gl-migration/MIGRATION.md) — PB 스키마·시드·레거시 이관

---

## 라이선스

UNLICENSED (내부용)
