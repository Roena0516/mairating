# maimaiDX 사설 레이팅 서비스

maimaiDX 공식 사이트(maimaidx-eng.com)에서 북마클릿을 통해 플레이 전적을 수집하고, 공식 레이팅 시스템과는 다른 사설 레이팅 및 상세 통계를 제공하는 웹 서비스입니다.

## 📚 목차

- [기술 스택](#-기술-스택)
- [프로젝트 구조](#-프로젝트-구조)
- [핵심 기능](#-핵심-기능)
- [데이터베이스 스키마](#-데이터베이스-스키마)
- [개발 환경 설정](#-개발-환경-설정)
- [주요 파일 위치](#-주요-파일-위치)
- [북마클릿 동작 원리](#-북마클릿-동작-원리)
- [향후 계획](#-향후-계획)

## 🛠 기술 스택

- **프레임워크**: Next.js 15+ (App Router)
- **언어**: TypeScript
- **데이터베이스**: Supabase (PostgreSQL)
- **인증**: Supabase Auth (Google OAuth)
- **스타일링**: Tailwind CSS 4
- **상태 관리**: @tanstack/react-query
- **배포**: 미정

## 📁 프로젝트 구조

```
mairating/
├── app/
│   ├── page.tsx                      # 메인 페이지 (로그인 UI 예정)
│   ├── layout.tsx                    # 전역 레이아웃
│   ├── home/[handle]/page.tsx        # 유저 대시보드 (레이팅, 베스트 곡 목록)
│   └── api/
│       ├── bookmakelet/
│       │   └── bookmakelet.js        # maimaiDX 북마클릿 코드
│       ├── user/set-handle/
│       │   └── route.ts              # 유저 핸들 설정 API
│       ├── records/
│       │   └── route.ts              # 전적 수집 API (북마클릿 연동)
│       └── rating/
│           └── route.ts              # 레이팅 계산 API
│
├── lib/
│   ├── supabase.ts                   # Supabase Admin 클라이언트 (RLS 우회)
│   ├── supabase-server.ts            # Supabase SSR 클라이언트 (세션 관리)
│   └── rating.ts                     # 레이팅 계산 로직
│
├── types/                            # (예정) TypeScript 타입 정의
├── public/                           # 정적 파일 (SVG 아이콘 등)
└── .env.local                        # 환경 변수 (Supabase 키)
```

## 🎯 핵심 기능

### 1. 북마클릿 기반 전적 수집

**파일**: `app/api/bookmakelet/bookmakelet.js`

- maimaiDX 영문 사이트(maimaidx-eng.com)에서 실행
- 프로필 정보 + 전적 데이터 크롤링
- 수집 범위:
  - 장르: 6개 (101~105, 199)
  - 난이도: Expert, Master, Re:Master (12.0 이상만)
- 실시간 진행 상황 UI 표시
- `POST /api/records`로 데이터 전송 (CORS 허용)

**수집 데이터**:

- 유저 프로필: 닉네임, 아이콘, 칭호, 단위, 총 스타 수, 플레이 횟수
- 곡별 기록: 곡명, 달성률(achievement), 난이도, 내부 레벨, DX 여부

### 2. 사설 레이팅 시스템

**파일**: `lib/rating.ts`

#### 계산 방식

```typescript
개별 레이팅 = floor(내부 레벨 × 랭크 계수 × min(achievement, 100.5) / 100 * FC계수)
총 레이팅 = 신곡 Best 15 + 구곡 Best 35
```

#### FC 계수표

None: 1.0
FC(Full Combo): 1.0125
FC+(Full Combo+): 1.025
AP(All Perfect): 1.0375
AP+(All Perfect+): 1.05

#### 랭크 계수표

| Achievement | 랭크 | 계수 |
| ----------- | ---- | ---- |
| ≥ 100.5%    | SSS+ | 22.4 |
| ≥ 100.0%    | SSS  | 21.6 |
| ≥ 99.5%     | SS+  | 21.1 |
| ≥ 99.0%     | SS   | 20.8 |
| ≥ 98.0%     | S+   | 20.3 |
| ≥ 97.0%     | S    | 20.0 |
| ≥ 94.0%     | AAA  | 16.8 |
| ≥ 90.0%     | AA   | 15.2 |
| ≥ 80.0%     | A    | 13.6 |
| < 80.0%     | -    | 0    |

#### 신곡/구곡 분류

- **신곡 (New)**: 최신 버전 곡 → 상위 15곡 선정
- **구곡 (Old)**: 이전 버전 곡 → 상위 35곡 선정
- 버전 관리: 향후 어드민 페이지에서 수동 설정 예정

### 3. 유저 핸들 시스템

**파일**: `app/api/user/set-handle/route.ts`

- 고유 핸들(`@username` 형식)로 프로필 접근
- URL: `/home/[handle]`
- 중복 체크 (Unique 제약)
- Supabase Auth 세션 기반 인증

### 4. 대시보드 UI

**파일**: `app/home/[handle]/page.tsx`

**표시 정보**:

- 프로필 헤더: 닉네임, 아이콘, 총 스타 수, 핸들
- 레이팅 카드: 총 레이팅, 신곡 Best 15, 구곡 Best 35
- 평균 레이팅 계산 (신곡 ÷ 15, 구곡 ÷ 35)
- 곡별 카드:
  - 순위, 곡명, 난이도(색상 구분), 내부 레벨
  - DX/STD 구분, 달성률, 개별 레이팅

**난이도 색상**:

```typescript
const DIFFICULTY_COLORS = {
  Basic: "bg-emerald-500",
  Advanced: "bg-orange-400",
  Expert: "bg-rose-500",
  Master: "bg-purple-600",
  "Re:Master": "bg-violet-800",
};
```

### 5. 데이터 처리 (Chunking)

**파일**: `app/api/records/route.ts`

- 대량 데이터를 200개씩 분할 처리
- 단계:
  1. 곡 마스터 데이터 저장 (musics)
  2. 곡 ID 매핑 생성
  3. 난이도별 상세 정보 저장 (music_details)
  4. 유저 전적 저장 (user_records)
- RLS 우회를 위해 Admin 클라이언트 사용

## 🗄 데이터베이스 스키마

### users

| 컬럼               | 타입          | 설명                  |
| ------------------ | ------------- | --------------------- |
| id                 | UUID (PK)     | Supabase Auth 유저 ID |
| handle             | TEXT (Unique) | 고유 핸들 (@username) |
| nickname           | TEXT          | 닉네임                |
| icon_url           | TEXT          | 프로필 이미지 URL     |
| title              | TEXT          | 칭호                  |
| title_image_url    | TEXT          | 칭호 배경             |
| dan_grade_url      | TEXT          | 단위 이미지 URL       |
| friend_rank_url    | TEXT          | 친구 랭크 이미지 URL  |
| total_stars        | INTEGER       | 총 스타 수            |
| play_count_total   | INTEGER       | 총 플레이 횟수        |
| play_count_version | INTEGER       | 현재 버전 플레이 횟수 |
| updated_at         | TIMESTAMP     | 최종 업데이트 시각    |

### musics

| 컬럼    | 타입          | 설명           |
| ------- | ------------- | -------------- |
| id      | SERIAL (PK)   | 곡 ID          |
| title   | TEXT (Unique) | 곡명           |
| version | TEXT          | 버전 (New/Old) |

### music_details

| 컬럼             | 타입         | 설명                                   |
| ---------------- | ------------ | -------------------------------------- |
| id               | SERIAL (PK)  | 상세 ID                                |
| music_id         | INTEGER (FK) | musics.id                              |
| difficulty_type  | TEXT         | Basic/Advanced/Expert/Master/Re:Master |
| is_dx            | BOOLEAN      | DX 곡 여부                             |
| internal_level   | REAL         | 내부 레벨 (소수점)                     |
| difficulty_value | REAL         | 난이도 값                              |
| level            | INTEGER      | 표시 레벨 (정수)                       |

**Unique 제약**: (music_id, difficulty_type, is_dx)

### user_records

| 컬럼            | 타입         | 설명             |
| --------------- | ------------ | ---------------- |
| id              | SERIAL (PK)  | 기록 ID          |
| user_id         | UUID (FK)    | users.id         |
| music_detail_id | INTEGER (FK) | music_details.id |
| achievement     | REAL         | 달성률 (%)       |

**Unique 제약**: (user_id, music_detail_id)

## ⚙️ 개발 환경 설정

### 환경 변수 (.env.local)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 설치 및 실행

```bash
npm install
npm run dev
```

서버는 http://localhost:3000 에서 실행됩니다.

### Supabase 인증 설정

- Google OAuth 제공자가 이미 설정되어 있습니다
- 로그인 페이지 구현 예정 (`app/page.tsx`)

## 📍 주요 파일 위치

| 기능             | 파일 경로                            | 설명                                 |
| ---------------- | ------------------------------------ | ------------------------------------ |
| 레이팅 계산      | `lib/rating.ts:computeBestRating()`  | 신곡/구곡 베스트 추출 및 레이팅 합산 |
| 전적 수집 API    | `app/api/records/route.ts`           | 북마클릿 → 서버 → DB 파이프라인      |
| 대시보드         | `app/home/[handle]/page.tsx`         | 유저별 레이팅 및 베스트 곡 표시      |
| 북마클릿         | `app/api/bookmakelet/bookmakelet.js` | maimaiDX 사이트 크롤링 스크립트      |
| SSR 클라이언트   | `lib/supabase-server.ts`             | Next.js 15 비동기 cookies 대응       |
| Admin 클라이언트 | `lib/supabase.ts`                    | RLS 우회용 service_role 클라이언트   |

## 📖 북마클릿 동작 원리

### 1. 프로필 수집

- URL: `https://maimaidx-eng.com/maimai-mobile/playerData/`
- 파싱:
  - 아이콘: `img.w_112.f_l`
  - 닉네임: `.name_block`
  - 칭호: `.trophy_inner_block.f_13 span`
  - 단위: `img[src*="course_rank_"]`
  - 스타: `.p_l_10.f_l.f_14`
  - 플레이 횟수: `"total play count"` 포함 요소

### 2. 전적 수집

- URL 패턴: `https://maimaidx-eng.com/maimai-mobile/record/musicGenre/search/?genre=${g}&diff=${d}`
- 반복: 장르 6개 × 난이도 3개 = 18회 요청
- 파싱:
  - 곡명: `.music_name_block`
  - 달성률: `.music_score_block` (% 제거 후 파싱)
  - 레벨: `.music_lv_block` (+ 기호 → 0.6 추가)
  - DX 여부: `img[src*="music_kind_icon_dx.png"]` 존재 여부

### 3. 서버 전송

```javascript
fetch("http://localhost:3000/api/records", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include", // 쿠키(세션) 포함
  body: JSON.stringify({ records, userProfile }),
});
```

### 4. CORS 설정

**파일**: `app/api/records/route.ts:8-13`

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://maimaidx-eng.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Credentials": "true",
};
```

## 🚀 향후 계획

### 1. 인증 UI 구현

- `app/page.tsx`에 로그인/회원가입 페이지 추가
- Supabase Google OAuth 연동
- 로그인 후 핸들 설정 플로우

### 2. 어드민 페이지

- 곡 버전(New/Old) 수동 관리
- 악곡 상세 정보 수정 기능
- 권한 관리 시스템

### 3. 레이팅 히스토리

- 일자별 레이팅 변화 추적
- 선 그래프 시각화 (Chart.js 또는 Recharts)
- 레이팅 상승/하락 분석

### 4. 곡별 히스토리

- 개별 곡 달성률 변화 기록
- 스코어 개선 추이 표시
- 베스트 갱신 알림

### 5. 유저 간 랭킹

- 총 레이팅 기준 순위표
- 필터링: 신곡/구곡 분리, 지역별, 친구
- 실시간 랭킹 업데이트

### 6. 타입 정의 분리

- `types/` 폴더 생성
- 공통 타입 정의:
  - `User`, `Music`, `MusicDetail`, `UserRecord`
  - API 요청/응답 타입
  - 레이팅 계산 관련 타입
- 가독성 및 유지보수성 향상

## 🔧 기술적 고려사항

### Next.js 15 비동기 API

- `cookies()`가 Promise 반환 → `await cookies()` 필수
- `params`도 Promise → `await params` 필수

### Supabase RLS 우회

- 일반 사용자는 자신의 데이터만 접근 가능 (RLS 정책)
- Admin 클라이언트로 전역 데이터 읽기/쓰기
- 보안 주의: service_role_key는 절대 클라이언트에 노출 금지

### 성능 최적화

- 청킹(Chunking): 200개 단위 배치 처리
- 북마클릿 요청 간 100ms 지연 (과부하 방지)
- SSR로 초기 데이터 로딩 속도 개선

### 스타일 가이드

- **색상 테마**:
  - 신곡: Blue (blue-500, indigo-600)
  - 구곡: Green (emerald-500)
  - 레이팅 강조: Indigo (indigo-900)
- **폰트**: Geist Sans, Geist Mono
- **레이아웃**: 최대 폭 6xl (max-w-6xl)

## 📝 개발 체크리스트

- [x] 프로젝트 초기 설정
- [x] Supabase 연동
- [x] 북마클릿 개발
- [x] 전적 수집 API
- [x] 레이팅 계산 로직
- [x] 대시보드 UI
- [x] 유저 핸들 시스템
- [ ] 로그인 페이지
- [ ] 타입 정의 분리
- [ ] 어드민 페이지
- [ ] 레이팅 히스토리
- [ ] 곡별 히스토리
- [ ] 유저 랭킹
- [ ] 배포 환경 선정 및 배포

## 📞 문제 해결

### 북마클릿이 작동하지 않을 때

1. maimaidx-eng.com에 로그인되어 있는지 확인
2. 웹사이트에서 먼저 로그인했는지 확인
3. 브라우저 콘솔에서 CORS 에러 확인
4. localhost:3000이 실행 중인지 확인

### 레이팅이 0으로 표시될 때

1. `musics.version` 컬럼이 NULL인지 확인
2. `music_details.internal_level`이 올바르게 저장되었는지 확인
3. 달성률이 80% 미만인 경우 레이팅은 0입니다

### 핸들 중복 에러

- 409 Conflict 응답 → 이미 사용 중인 핸들
- 다른 핸들로 시도하거나 기존 핸들 삭제

---

**프로젝트 버전**: 0.1.0
**최종 업데이트**: 2026-01-07
**문의**: 프로젝트 이슈 트래커 또는 개발자 연락
