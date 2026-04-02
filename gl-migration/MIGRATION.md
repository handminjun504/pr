# gl-server(경청소개서) — PocketBase 스키마·시드

운영 스택은 **PocketBase(gl) + 정적 프론트(Vite `dist/`)** 만 사용합니다.

## 전제

- gl-server MCP에서 `import_schema`, `bulk_create_records`(또는 PocketBase Admin) 사용 가능
- **경청소개서** 프로젝트 ID: MCP `list_projects`로 확인

## 1단계: 컬렉션 생성 (phase1)

1. `schema-phase1.json` 내용을 MCP **`import_schema`** 의 `schema`에 넣고, `projectId`에 경청소개서 프로젝트 ID 지정
2. 실패 시 Admin에서 규칙·필드 조정

## 2단계: 서비스 마스터 시드

```bash
node scripts/generate-gl-service-seeds.mjs
```

생성물: `gl-migration/seeds/gc_proposal_services.records.json`  
→ MCP **`bulk_create_records`** 로 `gc_proposal_services`에 넣기

(필요 시 `illustration` 등 추가 필드는 Admin 또는 MCP `add_field`로 넣은 뒤 시드·업로드.)

## 3단계: relation 컬렉션 (phase2)

1. `list_collections` 등으로 `gc_proposal_clients`, `gc_proposal_services` 등 **내부 ID** 확인
2. `schema-phase2.json` 의  
   `__REPLACE_GC_PROPOSAL_CLIENTS_COLLECTION_ID__`  
   `__REPLACE_GC_PROPOSAL_SERVICES_COLLECTION_ID__`  
   `__REPLACE_GC_PROPOSALS_COLLECTION_ID__`  
   를 실제 ID로 치환
3. **`import_schema`** 로 phase2 적용

## 4단계: 나머지 데이터

클라이언트·제안서·선택 레코드는 Admin, MCP `bulk_create_records`, 또는 앱에서 생성합니다.  
복잡한 관계 매핑이 필요하면 `gl-migration/prepared/`·`replace-placeholders.mjs` 등은 **수동 데이터 이관**용으로만 참고하세요.

## 앱 연동

웹앱은 **`lib/gl-db.js`**, **`VITE_POCKETBASE_URL` → `window.ENV.POCKETBASE_URL`**, UI는 `index.html`·`src/gl-bridge.js`·Vite 번들을 사용합니다.

## 보안

- `POCKETBASE_ADMIN_PASSWORD`, 덤프 JSON, 로컬 비밀 값은 **저장소에 올리지 마세요.**
