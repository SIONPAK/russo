# 루소 도매 시스템 (Russo Wholesale System)

도매법인 루소를 위한 통합 ERP 시스템입니다. Next.js 15와 Supabase를 기반으로 구축된 현대적인 웹 애플리케이션입니다.

## 🚀 주요 기능

### 관리자 기능

- **회원 관리**: 도매 고객 승인/관리, 사업자등록증 검증
- **상품 관리**: 상품 등록, 수정, 삭제, 카테고리 관리
- **재고 관리**: 실시간 재고 추적, 입고/출고 처리, ADU 분석
- **주문 관리**: 주문 처리, 출고 명세서, 반품 처리, 시간순 할당
- **마일리지 관리**: 자동/수동 마일리지 적립/차감
- **샘플 관리**: 샘플 주문 처리, 반납 관리
- **통계 대시보드**: 실시간 매출, 주문, 재고 통계
- **팝업 관리**: 메인 페이지 팝업 관리
- **공지사항 관리**: 고객 대상 공지사항 관리

### 고객 기능

- **상품 발주**: 도매 상품 주문 및 장바구니
- **발주 내역**: 과거 주문 내역 및 상태 조회
- **마일리지**: 적립/사용 내역 조회
- **운송장 조회**: 실시간 배송 현황 추적
- **서류 조회**: 명세서, 세금계산서 다운로드
- **마이페이지**: 회사정보 및 배송지 관리
- **샘플 주문**: 무료 샘플 주문 신청

## 🛠 기술 스택

### Frontend

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand
- **UI Components**: Custom Components + Lucide React Icons
- **Forms**: React Hook Form
- **HTTP Client**: Axios
- **PDF Generation**: jsPDF + jsPDF-AutoTable
- **Excel Processing**: ExcelJS + XLSX

### Backend

- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **Real-time**: Supabase Realtime
- **Cron Jobs**: Vercel Cron

### Development Tools

- **Package Manager**: Yarn
- **Linting**: ESLint
- **Code Formatting**: Prettier
- **Type Checking**: TypeScript

## 📁 프로젝트 구조 (FSD Pattern)

```
src/
├── app/                    # Next.js App Router
│   ├── admin/             # 관리자 페이지
│   │   ├── adu/          # ADU 분석
│   │   ├── categories/   # 카테고리 관리
│   │   ├── deduction-statements/ # 차감 명세서
│   │   ├── documents/    # 문서 관리
│   │   ├── inventory/    # 재고 관리
│   │   ├── mileage/      # 마일리지 관리
│   │   ├── notices/      # 공지사항 관리
│   │   ├── orders/       # 주문 관리
│   │   ├── pending-shipments/ # 미출고 관리
│   │   ├── popups/       # 팝업 관리
│   │   ├── products/     # 상품 관리
│   │   ├── return-statements/ # 반품 명세서
│   │   ├── samples/      # 샘플 관리
│   │   ├── shipped-orders/ # 출고 주문
│   │   ├── shipping-statements/ # 출고 명세서
│   │   ├── statistics/   # 통계
│   │   ├── tax-invoice/  # 세금계산서
│   │   ├── unshipped-orders/ # 미출고 주문
│   │   ├── unshipped-statements/ # 미출고 명세서
│   │   └── users/        # 회원 관리
│   ├── api/               # API Routes
│   │   ├── admin/        # 관리자 API (112개 파일)
│   │   ├── auth/         # 인증 API
│   │   ├── categories/   # 카테고리 API
│   │   ├── documents/    # 문서 API
│   │   ├── mileage/      # 마일리지 API
│   │   ├── orders/       # 주문 API
│   │   ├── popups/       # 팝업 API
│   │   ├── products/     # 상품 API
│   │   ├── shipping-addresses/ # 배송지 API
│   │   ├── tax-invoice/  # 세금계산서 API
│   │   ├── templates/    # 템플릿 API
│   │   └── upload/       # 파일 업로드 API
│   ├── auth/              # 인증 페이지
│   ├── cart/              # 장바구니
│   ├── community/         # 커뮤니티
│   ├── guide/             # 가이드
│   ├── mypage/            # 마이페이지
│   ├── order/             # 주문
│   ├── order-management/  # 주문 관리
│   ├── products/          # 상품 목록
│   ├── privacy/           # 개인정보처리방침
│   ├── terms/             # 이용약관
│   ├── test/              # 테스트
│   └── wishlist/          # 위시리스트
├── shared/                # 공유 리소스
│   ├── api/               # API 클라이언트
│   ├── constants/         # 상수 정의
│   ├── lib/               # 유틸리티 함수
│   │   ├── supabase/     # Supabase 클라이언트
│   │   ├── admin-auth.ts # 관리자 인증
│   │   ├── batch-utils.ts # 배치 처리
│   │   ├── email-utils.ts # 이메일 유틸
│   │   ├── excel-utils.ts # 엑셀 처리
│   │   ├── receipt-utils.ts # 영수증 처리
│   │   ├── shipping-statement-utils.ts # 출고명세서
│   │   ├── shipping-utils.ts # 배송 유틸
│   │   ├── storage.ts    # 스토리지
│   │   ├── toast.ts      # 토스트
│   │   └── utils.ts      # 일반 유틸
│   ├── templates/         # 엑셀 템플릿
│   ├── types/             # TypeScript 타입 정의
│   ├── ui/                # 재사용 가능한 UI 컴포넌트
│   └── utils/             # 유틸리티
├── entities/              # 비즈니스 엔티티
│   ├── auth/              # 인증 관련
│   ├── inventory/         # 재고 관련
│   ├── mileage/           # 마일리지 관련
│   ├── order/             # 주문 관련
│   ├── product/           # 상품 관련
│   └── user/              # 사용자 관련
├── features/              # 기능별 모듈
│   ├── admin/             # 관리자 기능
│   │   ├── category-management/ # 카테고리 관리
│   │   ├── featured-management/ # 인기상품 관리
│   │   ├── mileage-management/ # 마일리지 관리
│   │   ├── notice-management/ # 공지사항 관리
│   │   ├── order-management/ # 주문 관리
│   │   ├── popup-management/ # 팝업 관리
│   │   ├── product-management/ # 상품 관리
│   │   ├── total-points/ # 총 포인트
│   │   └── user-management/ # 사용자 관리
│   ├── auth/              # 인증 기능
│   ├── cart/              # 장바구니 기능
│   ├── category-menu/     # 카테고리 메뉴
│   ├── community/         # 커뮤니티 기능
│   ├── order/             # 주문 기능
│   ├── popup/             # 팝업 기능
│   ├── product/           # 상품 기능
│   └── user/              # 사용자 기능
├── page-components/       # 페이지별 컴포넌트
│   ├── admin/             # 관리자 페이지 컴포넌트
│   ├── auth/              # 인증 페이지 컴포넌트
│   ├── cart/              # 장바구니 페이지 컴포넌트
│   ├── community/         # 커뮤니티 페이지 컴포넌트
│   ├── guide/             # 가이드 페이지 컴포넌트
│   ├── home/              # 홈 페이지 컴포넌트
│   ├── mypage/            # 마이페이지 컴포넌트
│   ├── order/             # 주문 페이지 컴포넌트
│   ├── order-management/  # 주문 관리 페이지 컴포넌트
│   ├── privacy/           # 개인정보처리방침 페이지 컴포넌트
│   ├── product/           # 상품 페이지 컴포넌트
│   ├── products/          # 상품 목록 페이지 컴포넌트
│   ├── terms/             # 이용약관 페이지 컴포넌트
│   └── wishlist/          # 위시리스트 페이지 컴포넌트
└── widgets/               # 위젯 컴포넌트
    ├── admin/             # 관리자 위젯
    ├── footer/            # 푸터
    ├── header/            # 헤더
    ├── layout/            # 레이아웃
    ├── navigation/        # 네비게이션
    └── sidebar/           # 사이드바
```

## 🚦 시작하기

### 1. 프로젝트 클론 및 의존성 설치

```bash
git clone <repository-url>
cd russo
yarn install
```

### 2. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 내용을 입력하세요:

```bash
# Supabase 설정 (필수)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT 설정 (선택)
JWT_SECRET=your_jwt_secret_key

# 외부 API 키 (선택)
BANK_API_KEY=your_bank_api_key
CJ_DELIVERY_API_KEY=your_cj_delivery_api_key
BUSINESS_VERIFICATION_API_KEY=your_business_verification_api_key

# 이메일 설정 (선택)
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
```

### 3. Supabase 데이터베이스 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. SQL Editor에서 다음 파일들을 순서대로 실행:
   - `create-inventory-functions.sql` - 재고 관리 함수들
   - `add-deallocate-function.sql` - 재고 할당 해제 함수
   - 기타 필요한 테이블 및 함수들

### 4. 테스트 데이터 생성

```bash
yarn seed:admin
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

## 📊 데이터베이스 스키마

### 주요 테이블

#### 사용자 관련

- `users` - 고객 정보
- `admins` - 관리자 정보

#### 상품 관련

- `products` - 상품 정보
- `categories` - 카테고리
- `category_menus` - 카테고리 메뉴

#### 주문 관련

- `orders` - 주문 정보
- `order_items` - 주문 아이템
- `samples` - 샘플 주문

#### 재고 관련

- `stock_movements` - 재고 변동 이력
- `inventory_options` - 옵션별 재고 (JSON)

#### 마일리지 관련

- `mileage` - 마일리지 내역
- `mileage_logs` - 마일리지 로그

#### 명세서 관련

- `statements` - 명세서
- `statement_items` - 명세서 아이템
- `deduction_statements` - 차감 명세서
- `return_statements` - 반품 명세서
- `shipping_statements` - 출고 명세서

### 핵심 함수들

#### 재고 관리 함수

- `add_physical_stock()` - 물리적 재고 추가/차감
- `allocate_stock()` - 재고 할당
- `deallocate_stock()` - 재고 할당 해제
- `adjust_physical_stock()` - 물리적 재고 조정
- `calculate_available_stock()` - 가용재고 계산
- `process_shipment()` - 출고 처리

## 🎯 핵심 비즈니스 로직

### 1. 재고 관리 시스템

#### 이중 재고 구조

```typescript
interface InventoryOption {
  color: string;
  size: string;
  physical_stock: number; // 실제 물리적 재고
  allocated_stock: number; // 할당된 재고
  stock_quantity: number; // 가용재고 (physical - allocated)
}
```

#### 재고 할당 플로우

1. **주문 생성** → `calculate_available_stock` → `allocate_stock`
2. **재고 할당 시**: 물리적재고 차감 + 할당된재고 증가
3. **출고 처리 시**: `process_shipment`로 물리적재고만 차감
4. **재고 조정 시**: `add_physical_stock` + 자동 재할당

### 2. Working Date 시스템

#### 시간 기준

- **금요일 15:00~월요일 14:59**: 월요일로 설정
- **월요일 15:00~화요일 14:59**: 화요일로 설정
- **주말 주문**: 다음 월요일로 설정

#### 자동 크론 작업

- **뱅크다 동기화**: 5분마다 (`/api/admin/bankda/auto-sync`)
- **일일 이월 처리**: 매일 15:05 (`/api/admin/orders/daily-rollover`)

### 3. 마일리지 시스템

#### 적립 기준

- 주문 금액의 1% 자동 적립
- 관리자 수동 적립/차감 가능
- 차감 명세서를 통한 마일리지 차감

## 🔧 개발 가이드

### 코드 스타일

#### 네이밍 컨벤션

- **컴포넌트**: PascalCase (`UserManagement.tsx`)
- **파일명**: kebab-case (`user-management.tsx`)
- **함수/변수**: camelCase (`getUserData`)
- **상수**: UPPER_SNAKE_CASE (`API_BASE_URL`)

#### TypeScript 사용

```typescript
// 타입 정의 예시
interface User {
  id: string;
  email: string;
  company_name: string;
  approval_status: "pending" | "approved" | "rejected";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

#### API 설계 원칙

- RESTful API 설계
- `/api/auth/*` - 인증 관련
- `/api/admin/*` - 관리자 전용
- `/api/orders/*` - 주문 관련
- `/api/products/*` - 상품 관련

### 상태 관리

#### Zustand 스토어 구조

```typescript
interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}
```

### 에러 처리

#### API 에러 처리

```typescript
try {
  const response = await fetch("/api/users");
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data;
} catch (error) {
  console.error("API Error:", error);
  throw error;
}
```

#### 사용자 친화적 에러 메시지

```typescript
const getErrorMessage = (error: any): string => {
  if (error.message.includes("network")) {
    return "네트워크 연결을 확인해주세요.";
  }
  if (error.message.includes("unauthorized")) {
    return "로그인이 필요합니다.";
  }
  return "알 수 없는 오류가 발생했습니다.";
};
```

### 성능 최적화

#### 이미지 최적화

```typescript
import Image from "next/image";

<Image
  src="/images/product.jpg"
  alt="상품 이미지"
  width={300}
  height={300}
  priority={isAboveFold}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
/>;
```

#### 데이터 페칭 최적화

```typescript
// React Query 사용
import { useQuery } from "@tanstack/react-query";

const { data, isLoading, error } = useQuery({
  queryKey: ["users", page, search],
  queryFn: () => fetchUsers({ page, search }),
  staleTime: 5 * 60 * 1000, // 5분
  cacheTime: 10 * 60 * 1000, // 10분
});
```

## 🧪 테스트

### 단위 테스트

```bash
yarn test
```

### E2E 테스트

```bash
yarn test:e2e
```

### 린팅 및 포맷팅

```bash
yarn lint
yarn lint:fix
```

## 🚀 배포

### Vercel 배포

1. GitHub에 코드 푸시
2. Vercel에서 프로젝트 연결
3. 환경 변수 설정
4. 자동 배포 완료

### 환경 변수 설정 (배포)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## 📋 주요 API 엔드포인트

### 인증

- `POST /api/auth/login` - 로그인
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/logout` - 로그아웃

### 관리자

- `GET /api/admin/users` - 사용자 목록
- `POST /api/admin/users/[id]/approve` - 사용자 승인
- `GET /api/admin/orders` - 주문 목록
- `POST /api/admin/orders/allocate-inventory` - 재고 할당
- `GET /api/admin/inventory` - 재고 현황
- `POST /api/admin/inventory/upload` - 재고 엑셀 업로드

### 주문

- `POST /api/orders` - 주문 생성
- `POST /api/orders/purchase` - 발주서 생성
- `POST /api/orders/sample` - 샘플 주문
- `GET /api/orders/[id]` - 주문 상세

### 상품

- `GET /api/products` - 상품 목록
- `GET /api/products/[id]` - 상품 상세
- `POST /api/products` - 상품 생성
- `PUT /api/products/[id]` - 상품 수정

## 🔍 디버깅 가이드

### 일반적인 문제들

#### 1. 재고 할당 오류

```typescript
// 가용재고 확인
const { data: availableStock } = await supabase.rpc(
  "calculate_available_stock",
  {
    p_product_id: productId,
    p_color: color,
    p_size: size,
  }
);
```

#### 2. Working Date 오류

```typescript
// 한국시간 기준 계산 확인
const koreaTime = new Date(
  now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
);
const dayOfWeek = koreaTime.getDay();
const hour = koreaTime.getHours();
```

#### 3. 인증 오류

```typescript
// 토큰 유효성 확인
const {
  data: { user },
  error,
} = await supabase.auth.getUser(token);
if (error || !user) {
  // 인증 실패 처리
}
```

### 로그 확인

- 브라우저 개발자 도구 Console
- Vercel Functions 로그
- Supabase 로그

## 📞 지원 및 문의

### 개발 관련 문의

- 이슈 트래커: GitHub Issues
- 코드 리뷰: Pull Request
- 문서화: README 업데이트

### 비즈니스 관련 문의

- 관리자: admin@lusso.com
- 기술 지원: tech@lusso.com

## 📄 라이선스

이 프로젝트는 루소 도매법인 전용 소프트웨어입니다.

---

**루소 도매 시스템** - 효율적인 도매 업무 관리를 위한 통합 솔루션

> 💡 **팁**: 새로운 기능을 추가할 때는 먼저 이 README를 확인하고, 기존 패턴을 따라 개발하세요. 문제가 발생하면 디버깅 가이드를 참고하세요.
