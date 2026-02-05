# 경청 서비스 소개서 생성기 ☁️

> **Supabase + Vercel** 기반 클라우드 제안서 생성 시스템

고객 맞춤형 서비스 제안서를 쉽고 빠르게 생성하는 웹 애플리케이션입니다. 로컬에서도 작동하지만, **Supabase**를 연동하면 클라우드 기반으로 데이터를 관리할 수 있습니다.

---

## 🚀 빠른 시작

### 1️⃣ 로컬에서 실행 (Supabase 없이)

```bash
# 파일 다운로드 후
npx serve
# 또는
python -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속

### 2️⃣ Supabase + Vercel 배포 (권장)

**5분이면 완료!** 🎉

1. **Supabase 설정**
2. **Vercel 배포**
3. **환경 변수 설정**

아래 상세 가이드를 따라하세요 👇

---

## 📦 설치 및 설정

### 필수 요구사항

- Node.js 18+ (로컬 개발 시)
- Supabase 계정 (클라우드 기능 사용 시)
- Vercel 계정 (배포 시)

### 로컬 개발 환경 설정

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

---

## ☁️ Supabase 설정 가이드

### 1단계: Supabase 프로젝트 생성

1. [Supabase](https://supabase.com) 접속
2. "New Project" 클릭
3. 프로젝트 이름 입력 (예: `gyeongcheong-proposals`)
4. 비밀번호 설정 및 리전 선택 (Seoul 권장)
5. 프로젝트 생성 완료!

### 2단계: 데이터베이스 스키마 생성

이미 마이그레이션 파일이 실행되었습니다! ✅

생성된 테이블:
- `proposal_clients` - 고객사 정보
- `proposal_services` - 서비스 마스터 데이터
- `proposals` - 생성된 제안서
- `proposal_service_selections` - 서비스 선택 내역
- `proposal_templates` - 재사용 가능한 템플릿

### 3단계: API 키 가져오기

1. Supabase 대시보드에서 **Settings** → **API** 메뉴로 이동
2. 다음 정보 복사:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6...`

---

## 🌐 Vercel 배포 가이드

### 방법 1: Vercel CLI 사용

```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 배포
vercel
```

### 방법 2: GitHub 연동 (권장)

1. GitHub 리포지토리에 푸시
2. [Vercel](https://vercel.com) 접속
3. **New Project** 클릭
4. GitHub 리포지토리 선택
5. **Deploy** 클릭

### 환경 변수 설정 (Vercel)

배포 후 Vercel 대시보드에서:

1. **Settings** → **Environment Variables** 메뉴
2. 다음 변수 추가:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

3. **Save** 후 **Redeploy** 클릭

---

## 💡 주요 기능

### 🆕 클라우드 기능 (Supabase 연동 시)

- ✅ **고객사 관리**: 고객사 정보 저장 및 자동 완성
- ✅ **제안서 저장**: 모든 제안서를 클라우드에 보관
- ✅ **버전 관리**: 제안서 수정 이력 추적
- ✅ **템플릿 저장**: 자주 사용하는 서비스 조합 저장
- ✅ **협업 기능**: 팀원들과 제안서 공유
- ✅ **통계 대시보드**: 제안서 현황 한눈에 보기

### 💾 로컬 기능 (Supabase 없이도 작동)

- ✅ 서비스 선택 시스템
- ✅ 실시간 미리보기
- ✅ 인라인 편집
- ✅ PDF 출력
- ✅ 로컬스토리지 자동 저장

---

## 📂 프로젝트 구조

```
경청소개서/
├── index.html              # 메인 HTML
├── styles.css              # 스타일시트
├── app.js                  # 메인 로직 (Supabase 연동)
├── lib/
│   └── supabase.js         # Supabase 클라이언트
├── env.js                  # 환경 변수 설정
├── vercel.json             # Vercel 설정
├── vite.config.js          # Vite 빌드 설정
├── package.json            # 의존성
├── services-data.json      # 서비스 데이터 (로컬 백업)
├── images/                 # 이미지
└── README.md               # 이 파일
```

---

## 🔧 사용 방법

### 1. 기본 사용

1. **기업 정보 입력**
   - 고객사명, 담당자명, 업종 입력
   - Supabase 연동 시 자동완성 기능 제공

2. **서비스 선택**
   - "고객 요청 서비스": 고객이 원하는 서비스
   - "경청 추천 서비스": 추가 제안 서비스

3. **미리보기 확인**
   - 실시간으로 문서 확인
   - 편집 모드로 내용 수정 가능

4. **저장 & 출력**
   - 💾 로컬 저장: 브라우저에 자동 저장
   - ☁️ 클라우드 저장: Supabase에 저장
   - 🖨️ PDF 출력: 인쇄 기능으로 PDF 생성

### 2. 클라우드 기능 사용 (Supabase)

#### 고객사 검색

```
1. 기업명 입력 칸에 2글자 이상 입력
2. 자동으로 저장된 고객사 검색
3. 클릭하면 정보 자동 입력
```

#### 제안서 관리

```
1. "수동 저장" 버튼 클릭 → 클라우드 저장
2. 제안서 목록에서 이전 제안서 불러오기
3. 상태 변경 (draft → sent → accepted)
```

#### 템플릿 활용

```
1. 자주 사용하는 서비스 조합 저장
2. 템플릿 이름 지정
3. 다음 제안서 작성 시 템플릿 선택
```

---

## 🎨 커스터마이징

### 1. 서비스 추가/수정

Supabase 대시보드에서:

```sql
INSERT INTO proposal_services (
    service_id, category, title, icon, 
    method, detail, effect, sample
) VALUES (
    'newService', '신규 카테고리', '새 서비스', '🆕',
    '운영 방식', '상세 내용', '기대 효과', '제공 보고서'
);
```

### 2. 색상 변경

`styles.css` 파일 수정:

```css
:root {
    --navy: #1a2e4c;        /* 메인 색상 */
    --accent: #3b7dd8;      /* 강조 색상 */
    --ai-purple: #7c3aed;   /* 추천 색상 */
}
```

### 3. 템플릿 수정

`index.html`에서 문서 템플릿 HTML 수정

---

## 🔐 보안 설정

### Supabase RLS (Row Level Security) 설정

```sql
-- proposals 테이블에 RLS 활성화
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- 누구나 읽기 가능
CREATE POLICY "Anyone can read proposals" ON proposals
    FOR SELECT USING (true);

-- 누구나 생성 가능
CREATE POLICY "Anyone can create proposals" ON proposals
    FOR INSERT WITH CHECK (true);

-- 본인이 생성한 것만 수정 가능 (추후 인증 추가 시)
CREATE POLICY "Users can update own proposals" ON proposals
    FOR UPDATE USING (true);
```

---

## 📊 데이터 구조

### proposal_clients (고객사)

```typescript
{
  id: number;
  company_name: string;       // 회사명
  contact_name?: string;       // 담당자명
  industry_type?: string;      // 업종
  phone?: string;              // 전화번호
  email?: string;              // 이메일
  created_at: timestamp;
  updated_at: timestamp;
}
```

### proposals (제안서)

```typescript
{
  id: number;
  client_id: number;           // 고객사 ID
  title: string;               // 제안서 제목
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  include_existing_staff: boolean;
  include_erp_promo: boolean;
  custom_content: jsonb;       // 커스텀 텍스트
  pdf_url?: string;            // PDF 파일 경로
  created_at: timestamp;
  updated_at: timestamp;
  sent_at?: timestamp;
}
```

### proposal_service_selections (서비스 선택)

```typescript
{
  id: number;
  proposal_id: number;
  service_id: string;
  selection_type: 'requested' | 'recommended';
  custom_title?: string;
  custom_method?: string;
  custom_detail?: string;
  custom_effect?: string;
}
```

---

## 🐛 트러블슈팅

### 문제: "Supabase 연결 실패"

**해결:**
1. 환경 변수 확인: `SUPABASE_URL`, `SUPABASE_ANON_KEY`
2. Supabase 프로젝트 활성 상태 확인
3. API 키가 올바른지 확인

### 문제: "JSON 로드 실패"

**해결:**
- 로컬 서버 사용 (`npx serve` 또는 `python -m http.server`)
- `file://` 프로토콜은 지원 안 됨

### 문제: "PDF 색상 안 나옴"

**해결:**
- 인쇄 대화상자에서 **"배경 그래픽"** 옵션 체크
- Chrome: "더 많은 설정" → "배경 그래픽"

### 문제: "Vercel 배포 후 환경 변수 인식 안 됨"

**해결:**
1. Vercel 대시보드에서 환경 변수 다시 확인
2. **Redeploy** 클릭 (환경 변수 변경 시 필수)

---

## 🚀 향후 개발 계획

- [ ] 사용자 인증 (Supabase Auth)
- [ ] 이메일로 제안서 발송
- [ ] 제안서 버전 관리
- [ ] 통계 대시보드
- [ ] AI 기반 서비스 추천
- [ ] 다국어 지원
- [ ] 모바일 앱 (React Native)
- [ ] PDF 자동 생성 (서버사이드)

---

## 📝 라이선스

© 2024 주식회사 경리업무를잘하는청년들. All rights reserved.

---

## 💬 문의

**주식회사 경리업무를잘하는청년들**
- 대표: 금종석
- 서비스: 원격 경리업무 전문 대행

---

## 🎯 체크리스트

### 로컬 개발

- [ ] `npm install` 실행
- [ ] `npm run dev` 실행
- [ ] 브라우저에서 확인

### Supabase 설정

- [ ] Supabase 프로젝트 생성
- [ ] 마이그레이션 실행 (자동 완료됨)
- [ ] API 키 복사
- [ ] 기본 서비스 데이터 삽입 (자동 완료됨)

### Vercel 배포

- [ ] GitHub에 코드 푸시
- [ ] Vercel 프로젝트 생성
- [ ] 환경 변수 설정
- [ ] 배포 확인

### 테스트

- [ ] 로컬 모드 작동 확인
- [ ] Supabase 연결 확인
- [ ] 고객사 검색 기능
- [ ] 제안서 저장 기능
- [ ] PDF 출력 기능

---

**Made with ❤️ by 경리업무를잘하는청년들**

🚀 **배포 완료 후 이 링크를 팀원들과 공유하세요!**
