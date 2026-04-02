# 배포 가이드 (GL / PocketBase)

프론트는 **정적 파일**, API는 **PocketBase(gl)** 입니다. 별도 BaaS·호스팅 벤더에 묶이지 않습니다.

---

## 1. PocketBase 준비

1. gl-server(또는 본인 인프라)에서 PocketBase 실행.
2. [gl-migration/MIGRATION.md](gl-migration/MIGRATION.md) 에 따라 `gc_*` 컬렉션 생성 및 시드.
3. **Allowed origins** 에 실제 사용자가 접속하는 **프론트 URL** 을 등록.

---

## 2. 프론트 빌드

리포지토리 루트에서:

```bash
npm ci
VITE_POCKETBASE_URL=https://pb.example.com npm run build
```

- `VITE_POCKETBASE_URL` 은 **클라이언트(브라우저)가 호출하는 PB 주소**와 같아야 합니다.
- 결과물은 `dist/` (HTML·JS·CSS·에셋).

로컬 확인:

```bash
npm run preview
```

---

## 3. 정적 호스팅

`dist/` 내용을 웹 서버 Document root에 복사합니다.

- Nginx, Caddy, gl 정적 경로 등 아무 정적 호스팅이면 됩니다.
- SPA가 아니므로 별도 rewrite 규칙은 보통 필요 없습니다. `index.html` 이 진입점입니다.

**환경을 바꿀 때**(PB URL 변경)마다 위 빌드 명령으로 다시 빌드해야 `env.js`에 새 URL이 들어갑니다.

---

## 4. 문제 해결

| 증상 | 확인 |
|------|------|
| PB 연결 실패 | `VITE_POCKETBASE_URL` 오타, HTTPS 혼합 콘텐츠, PB 방화벽 |
| CORS 오류 | PB Allowed origins 에 정확한 스킴+호스트+포트 |
| 빌드 후에도 옛 URL | 캐시 무시 후 재배포, 재빌드 여부 |

---

## 서비스 이미지 (선택)

`npm run upload:service-images` — 로컬 `images/` + `service-image-map.json` 기준으로 PB `gc_proposal_services.illustration` 에 올립니다.  
`.env.migrate.example` 참고해 `POCKETBASE_*` 만 설정하면 됩니다.
