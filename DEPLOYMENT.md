# 🚀 배포 가이드

## 단계별 배포 프로세스

### 1️⃣ Supabase 설정 (10분)

#### Step 1: 프로젝트 생성
```
1. https://supabase.com 접속
2. "Start your project" 클릭
3. 로그인 (GitHub 계정 권장)
4. "New Project" 클릭
5. 입력:
   - Name: gyeongcheong-proposals
   - Database Password: 강력한 비밀번호 생성 (저장 필수!)
   - Region: Northeast Asia (Seoul)
6. "Create new project" 클릭
7. 약 2분 대기 (프로젝트 생성 중)
```

#### Step 2: 데이터베이스 스키마 생성
```
✅ 이미 완료됨!
마이그레이션이 자동으로 실행되었습니다.

확인 방법:
1. Supabase 대시보드 → Table Editor
2. 다음 테이블 확인:
   - proposal_clients
   - proposal_services
   - proposals
   - proposal_service_selections
   - proposal_templates
```

#### Step 3: API 키 가져오기
```
1. Supabase 대시보드 좌측 메뉴
2. Settings (⚙️) 클릭
3. API 탭 클릭
4. 복사할 항목:
   
   📋 Project URL
   https://xxxxx.supabase.co
   
   📋 anon public key
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   
   ⚠️ service_role key는 사용하지 마세요 (보안 위험)
```

---

### 2️⃣ Vercel 배포 (5분)

#### 방법 A: GitHub 연동 (권장)

```bash
# 1. Git 초기화 (아직 안 했다면)
git init
git add .
git commit -m "Initial commit"

# 2. GitHub에 푸시
git remote add origin https://github.com/your-username/gyeongcheong-proposals.git
git branch -M main
git push -u origin main
```

```
# 3. Vercel 설정
1. https://vercel.com 접속
2. "Add New..." → "Project" 클릭
3. GitHub 리포지토리 Import
4. 프로젝트 선택
5. Configure Project:
   - Framework Preset: Other
   - Build Command: npm run build
   - Output Directory: dist
   - Install Command: npm install
6. Environment Variables 추가:
   
   Key: SUPABASE_URL
   Value: https://xxxxx.supabase.co
   
   Key: SUPABASE_ANON_KEY
   Value: eyJhbGciOiJIUz...
   
7. "Deploy" 클릭!
```

#### 방법 B: Vercel CLI

```bash
# 1. Vercel CLI 설치
npm i -g vercel

# 2. 로그인
vercel login

# 3. 배포
vercel

# 질문에 답변:
# - Set up and deploy? Y
# - Which scope? (당신의 계정 선택)
# - Link to existing project? N
# - Project name? gyeongcheong-proposals
# - Directory? ./
# - Override settings? N

# 4. 환경 변수 설정
vercel env add SUPABASE_URL
# 값 입력: https://xxxxx.supabase.co

vercel env add SUPABASE_ANON_KEY
# 값 입력: eyJhbGciOiJIUz...

# 5. 재배포
vercel --prod
```

---

### 3️⃣ 배포 확인 (2분)

```
1. Vercel이 제공한 URL 접속
   예: https://gyeongcheong-proposals.vercel.app

2. 확인 사항:
   ✅ 페이지가 정상적으로 로드됨
   ✅ 우측 상단에 "☁️ Cloud" 표시
   ✅ 서비스 선택 가능
   ✅ 기업명 입력 시 자동완성 작동
   ✅ "수동 저장" 버튼 클릭 시 저장됨

3. 문제 발생 시:
   - 브라우저 콘솔 확인 (F12)
   - Vercel 대시보드 → Deployments → 최신 배포 → Logs 확인
   - Supabase 대시보드 → Logs 확인
```

---

## 🔧 환경 변수 상세 설명

### 필수 환경 변수

| 변수명 | 설명 | 예시 |
|--------|------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL | `https://abcdefgh.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase Public API Key | `eyJhbGciOiJIUzI1NiIs...` |

### 환경 변수 설정 방법

#### Vercel 웹 대시보드
```
1. vercel.com → 프로젝트 선택
2. Settings → Environment Variables
3. Add New:
   - Name: SUPABASE_URL
   - Value: (URL 붙여넣기)
   - Environments: Production, Preview, Development 모두 체크
4. Save
5. 같은 방법으로 SUPABASE_ANON_KEY 추가
6. Deployments → 최신 배포 → ⋯ → Redeploy
```

#### Vercel CLI
```bash
# Production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production

# Preview
vercel env add SUPABASE_URL preview
vercel env add SUPABASE_ANON_KEY preview

# Development
vercel env add SUPABASE_URL development
vercel env add SUPABASE_ANON_KEY development
```

---

## 🐛 문제 해결

### 문제 1: "Supabase 연결 실패"

**원인:**
- 환경 변수가 설정되지 않음
- 잘못된 API 키

**해결:**
```bash
# Vercel 환경 변수 확인
vercel env ls

# 환경 변수 재설정
vercel env rm SUPABASE_URL
vercel env rm SUPABASE_ANON_KEY
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY

# 재배포
vercel --prod
```

### 문제 2: "table 'proposal_services' not found"

**원인:**
- 마이그레이션이 실행되지 않음

**해결:**
```
1. Supabase 대시보드 → SQL Editor
2. 마이그레이션 SQL 다시 실행
3. 서비스 데이터 INSERT 문 실행
```

### 문제 3: "빌드 실패"

**원인:**
- 의존성 설치 오류

**해결:**
```bash
# 로컬에서 테스트
npm install
npm run build

# package-lock.json 삭제 후 재시도
rm -rf node_modules package-lock.json
npm install
```

### 문제 4: "CORS 에러"

**원인:**
- Supabase CORS 설정 문제

**해결:**
```
1. Supabase 대시보드 → Settings → API
2. CORS settings 확인
3. Allowed origins에 Vercel URL 추가
   예: https://gyeongcheong-proposals.vercel.app
```

---

## 📊 배포 후 체크리스트

### 기능 테스트

- [ ] 페이지 로딩 정상
- [ ] ☁️ Cloud 연결 상태 표시
- [ ] 기업명 입력 및 자동완성
- [ ] 서비스 선택
- [ ] 미리보기 표시
- [ ] 편집 모드
- [ ] 수동 저장 (Supabase)
- [ ] PDF 출력

### 성능 확인

- [ ] Lighthouse 점수 확인 (90+ 권장)
- [ ] 모바일 반응형 확인
- [ ] 이미지 최적화
- [ ] 로딩 속도 (3초 이내)

### 보안 확인

- [ ] HTTPS 적용 (Vercel 자동)
- [ ] API 키 노출 여부 확인
- [ ] Supabase RLS 설정 (선택)

---

## 🚀 배포 자동화

### GitHub Actions 설정 (선택사항)

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 📈 모니터링

### Vercel Analytics 활성화

```
1. Vercel 대시보드 → 프로젝트
2. Analytics 탭
3. "Enable Analytics" 클릭
4. 방문자 추적, 성능 모니터링 가능
```

### Supabase 모니터링

```
1. Supabase 대시보드
2. Database → Logs
3. API 요청, 에러 확인
```

---

## 🎯 다음 단계

배포 완료 후:

1. ✅ 커스텀 도메인 연결
2. ✅ 사용자 인증 추가 (Supabase Auth)
3. ✅ 이메일 알림 설정
4. ✅ 백업 자동화
5. ✅ CI/CD 파이프라인 구축

---

**축하합니다! 🎉**

이제 팀원들과 제안서 생성 링크를 공유하세요!

```
🔗 https://your-app.vercel.app
```
