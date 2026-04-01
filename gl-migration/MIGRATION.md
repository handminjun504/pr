# gl-server(경청소개서 프로젝트) — 스키마·데이터 이관

일상 운영은 **PocketBase(gl) + 정적 프론트**만 사용합니다. 이 문서는 **컬렉션 생성·시드**와, **예전 Supabase에만 데이터가 있을 때** 한 번 옮기는 절차입니다.

## 자동 이관 (레거시 Supabase → GL)

1. `.env.migrate.example` 을 복사해 **`.env.migrate`** 로 저장하고 값 입력 (이 파일은 gitignore).
2. **`POCKETBASE_URL`** 은 gl 뒤의 **실제 PocketBase API 주소**여야 합니다(MCP `4000` 포트와 다를 수 있음).
3. 실행:

```bash
npm run migrate:legacy-supabase-to-gl
```

Supabase → `gc_*` 컬렉션으로 순서대로 넣고, `legacy_supabase_id` 기준으로 **재실행 시 중복 생성을 줄입니다**.

---

Supabase에 있던 **경청 소개서** 데이터를 gl-server의 PocketBase 컬렉션(`gc_*`)으로 옮기는 절차입니다.  
기존 `clients`, `bookmarks` 등 **다른 앱 컬렉션과 이름이 겹치지 않도록** `gc_` 접두사를 씁니다.

## 전제

- gl-server MCP에서 `import_schema`, `bulk_create_records`(또는 Admin UI) 사용 가능
- **경청소개서** 프로젝트 ID: Cursor에서 `list_projects`로 확인 후, 아래 `PROJECT_ID`에 넣기

## 1단계: 컬렉션 생성 (의존성 없는 것부터)

1. `schema-phase1.json` 내용을 MCP **`import_schema`** 인자 `schema`에 넣고, `projectId`에 경청소개서 프로젝트 ID 지정
2. 실패 시(규칙 문자열 등) PocketBase Admin에서 규칙을 조정

## 2단계: 서비스 마스터 시드

- **Supabase에 이미 `proposal_services`가 있는 경우:** 3단계 export 후 변환 결과 사용
- **없거나 로컬 JSON이 기준인 경우:**

```bash
node scripts/generate-gl-service-seeds.mjs
```

생성물: `gl-migration/seeds/gc_proposal_services.records.json`  
→ MCP **`bulk_create_records`** 로 `gc_proposal_services`에 넣기

## 3단계: Supabase에서 테이블 덤프

```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="..."   # RLS 우회 권장. 커밋 금지
node scripts/export-supabase-for-gl.mjs
```

결과: `gl-migration/export/*.json` (gitignore 대상)

## 4단계: PB용 레코드 JSON 준비

```bash
node scripts/transform-export-for-gl.mjs
```

- `gl-migration/prepared/gc_proposal_clients.records.json` 등 생성
- 제안서·선택은 relation id가 필요해 **`*.placeholder.json`** 으로 나옵니다.

## 5단계: relation 컬렉션 생성

1. `list_collections` 등으로 다음 컬렉션 **내부 ID** 확인  
   - `gc_proposal_clients`  
   - `gc_proposal_services`  
   - (이후) `gc_proposals`
2. `schema-phase2.json` 안의  
   `__REPLACE_GC_PROPOSAL_CLIENTS_COLLECTION_ID__`  
   `__REPLACE_GC_PROPOSAL_SERVICES_COLLECTION_ID__`  
   `__REPLACE_GC_PROPOSALS_COLLECTION_ID__`  
   를 실제 ID 문자열로 바꿉니다.
3. **`import_schema`** 로 phase2 스키마 적용

## 6단계: 클라이언트·템플릿 bulk 생성

순서 권장:

1. `gc_proposal_clients` ← `prepared/gc_proposal_clients.records.json`
2. `gc_proposal_templates` ← 있으면 `gc_proposal_templates.records.json`
3. 생성된 **각 레코드 id**를 메모하거나, Admin에서 Supabase `legacy_supabase_id`로 검색해 매핑

## 7단계: 제안서·선택 레코드 (플레이스홀더 치환)

1. `prepared/README_REPLACE.txt` 와 플레이스홀더 맵을 참고
2. `prepared/replace-map.json` 작성 예:

```json
{
  "clients": { "12": "pb_record_id_고객" },
  "services": { "accountManagement": "pb_record_id_서비스행" },
  "proposals": { "5": "pb_record_id_제안서" }
}
```

3. 제안서를 넣기 **전**에 `proposals`용 map은 비워 두고, 클라이언트·서비스만 채운 뒤:

```bash
node scripts/replace-placeholders.mjs
```

→ `gc_proposals.records.resolved.json` 생성 후 bulk_create

4. 제안서 bulk_create 후 나온 **PB id**로 `replace-map.json`의 `proposals` 채우고, selections placeholder 다시 치환하거나 selections 파일만 재생성

(선택 레코드는 **제안서·서비스 PB id**가 모두 필요합니다.)

## 앱 코드 연동

웹앱은 **`lib/gl-db.js`**(PocketBase SDK)와 빌드 시 주입되는 **`VITE_POCKETBASE_URL` → `window.ENV.POCKETBASE_URL`** 로 gl의 PB에 붙습니다. 메인 UI는 Vite 번들(`app.js`·`src/gl-bridge.js` 등)을 사용합니다.

## 보안

- `SUPABASE_SERVICE_ROLE_KEY`, export JSON, `replace-map.json`은 **저장소에 올리지 마세요.**
