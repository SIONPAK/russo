# 루소 도매 시스템

도매법인 루소를 위한 통합 ERP 시스템입니다.

## 🚀 주요 기능

### 관리자 기능

- **회원 관리**: 도매 고객 승인/관리, 사업자등록증 검증 ✅
- **상품 관리**: 상품 등록, 수정, 삭제
- **재고 관리**: 실시간 재고 추적, 입고/출고 처리
- **주문 관리**: 주문 처리, 출고 명세서, 반품 처리
- **마일리지 관리**: 자동/수동 마일리지 적립/차감
- **송장 관리**: CJ대한통운 연동 송장 출력

### 고객 기능

- **상품 발주**: 도매 상품 주문 및 장바구니
- **발주 내역**: 과거 주문 내역 및 상태 조회
- **마일리지**: 적립/사용 내역 조회
- **운송장 조회**: 실시간 배송 현황 추적
- **서류 조회**: 명세서, 세금계산서 다운로드
- **마이페이지**: 회사정보 및 배송지 관리

## 🛠 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Database**: Supabase
- **Icons**: Lucide React
- **Package Manager**: Yarn

## 📁 프로젝트 구조 (FSD Pattern)

```
src/
├── app/                    # Next.js App Router
│   ├── admin/             # 관리자 페이지
│   ├── auth/              # 인증 페이지
│   ├── customer/          # 고객 페이지
│   └── api/               # API Routes
├── shared/                # 공유 리소스
│   ├── api/               # API 클라이언트
│   ├── lib/               # 유틸리티 함수
│   ├── ui/                # 재사용 가능한 UI 컴포넌트
│   ├── types/             # TypeScript 타입 정의
│   └── constants/         # 상수 정의
├── entities/              # 비즈니스 엔티티
│   ├── auth/              # 인증 관련
│   ├── user/              # 사용자 관련
│   ├── product/           # 상품 관련
│   ├── order/             # 주문 관련
│   └── mileage/           # 마일리지 관련
├── features/              # 기능별 모듈
│   ├── auth/              # 인증 기능
│   ├── admin/             # 관리자 기능
│   └── customer/          # 고객 기능
├── widgets/               # 위젯 컴포넌트
│   ├── header/            # 헤더
│   ├── sidebar/           # 사이드바
│   └── navigation/        # 네비게이션
└── pages/                 # 페이지별 로직
    ├── admin/             # 관리자 페이지 로직
    ├── customer/          # 고객 페이지 로직
    └── auth/              # 인증 페이지 로직
```

## 🚦 시작하기

### 1. 의존성 설치

```bash
yarn install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 내용을 입력하세요:

```bash
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 3. Supabase 데이터베이스 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. `supabase-tables.sql` 파일의 내용을 SQL Editor에서 실행
3. `supabase-rls-policies.sql` 파일의 내용을 SQL Editor에서 실행

### 4. 테스트 데이터 생성

```bash
node scripts/seed-admin.js
```

### 5. 개발 서버 실행

```bash
yarn dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 🔐 로그인 정보

### 관리자

- **아이디**: admin
- **비밀번호**: admin123

### 테스트 고객

- **test1@company.com** / test123 (승인 대기)
- **approved@company.com** / test123 (승인 완료)
- **rejected@company.com** / test123 (반려)
- **inactive@company.com** / test123 (비활성)

## 📝 환경 변수

| 변수명                          | 설명                             | 필수 |
| ------------------------------- | -------------------------------- | ---- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase 프로젝트 URL            | ✅   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anonymous Key           | ✅   |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase Service Role Key        | ✅   |
| `JWT_SECRET`                    | JWT 토큰 시크릿 키               | ❌   |
| `BANK_API_KEY`                  | 은행 API 키 (마일리지 자동 적립) | ❌   |
| `CJ_DELIVERY_API_KEY`           | CJ대한통운 API 키                | ❌   |
| `BUSINESS_VERIFICATION_API_KEY` | 사업자 확인 API 키               | ❌   |

## 🗂 주요 페이지

### 인증

- `/` - 홈페이지
- `/auth/login` - 로그인 (관리자/고객 구분)
- `/auth/register` - 고객 회원가입

### 관리자

- `/admin` - 관리자 대시보드
- `/admin/users` - 회원 관리
- `/admin/products` - 상품 관리
- `/admin/inventory` - 재고 관리
- `/admin/orders` - 주문 관리
- `/admin/mileage` - 마일리지 관리

### 고객

- `/customer` - 고객 대시보드
- `/customer/products` - 상품 발주
- `/customer/orders` - 발주 내역
- `/customer/mileage` - 마일리지 조회
- `/customer/profile` - 마이페이지
- `/customer/shipping` - 운송장 조회
- `/customer/documents` - 서류 조회

## ✅ 구현 완료 기능

### 관리자 회원 관리 (API 연동 완료)

- **사용자 목록 조회**: 검색, 필터링, 정렬, 페이지네이션
- **사용자 승인/반려**: 승인 상태 변경
- **사용자 정보 수정**: 회사정보, 연락처 등 수정
- **계정 활성화/비활성화**: 사용자 계정 상태 관리
- **계정 삭제**: 주문 내역이 없는 계정만 삭제 가능
- **실시간 통계**: 전체/승인대기/승인완료/반려 회원 수 표시

### API Endpoints

- `GET /api/admin/users` - 사용자 목록 조회
- `POST /api/admin/users` - 사용자 생성
- `GET /api/admin/users/[id]` - 특정 사용자 조회
- `PUT /api/admin/users/[id]` - 사용자 정보 수정
- `DELETE /api/admin/users/[id]` - 사용자 삭제
- `POST /api/admin/users/[id]/approve` - 사용자 승인/반려

## 🔧 개발 가이드

### 코드 스타일

- TypeScript 사용
- ESLint + Prettier 적용
- Tailwind CSS 활용
- 컴포넌트명은 PascalCase
- 파일명은 kebab-case

### 상태 관리

- Zustand를 사용한 클라이언트 상태 관리
- 각 도메인별로 스토어 분리
- 인증 상태는 localStorage에 persist

### API 설계

- RESTful API 설계
- `/api/auth/*` - 인증 관련
- `/api/admin/*` - 관리자 전용
- `/api/customer/*` - 고객 전용

## 📋 TODO

- [x] 관리자 회원 관리 API 구현
- [x] Supabase 데이터베이스 스키마 설계
- [ ] 상품 관리 API 구현
- [ ] 재고 관리 API 구현
- [ ] 주문 관리 API 구현
- [ ] 마일리지 관리 API 구현
- [ ] 인증 미들웨어 구현
- [ ] 이미지 업로드 기능
- [ ] 이메일 알림 기능
- [ ] PDF 생성 기능 (명세서, 세금계산서)
- [ ] 모바일 반응형 최적화
- [ ] 테스트 코드 작성

## 📞 문의

프로젝트 관련 문의사항이 있으시면 언제든 연락주세요.

---

**루소 도매 시스템** - 효율적인 도매 업무 관리를 위한 통합 솔루션
