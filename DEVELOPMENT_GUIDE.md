# 루소 도매 시스템 개발 가이드

이 문서는 루소 도매 시스템의 개발 가이드라인과 모범 사례를 제공합니다.

## 📋 목차

1. [개발 환경 설정](#개발-환경-설정)
2. [코딩 컨벤션](#코딩-컨벤션)
3. [프로젝트 구조 이해](#프로젝트-구조-이해)
4. [API 개발 가이드](#api-개발-가이드)
5. [데이터베이스 작업](#데이터베이스-작업)
6. [재고 관리 시스템](#재고-관리-시스템)
7. [인증 및 권한 관리](#인증-및-권한-관리)
8. [에러 처리](#에러-처리)
9. [성능 최적화](#성능-최적화)
10. [테스트 작성](#테스트-작성)
11. [배포 및 운영](#배포-및-운영)

## 🛠 개발 환경 설정

### 필수 도구

- Node.js 18+
- Yarn 1.22+
- Git
- VS Code (권장)
- Supabase CLI

### VS Code 확장 프로그램

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "supabase.supabase-vscode",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ]
}
```

### 환경 변수 설정

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 📝 코딩 컨벤션

### 파일 명명 규칙

#### 컴포넌트 파일

```typescript
// ✅ 좋은 예
UserManagement.tsx;
ProductList.tsx;
OrderDetailModal.tsx;

// ❌ 나쁜 예
userManagement.tsx;
product_list.tsx;
order - detail - modal.tsx;
```

#### API 라우트 파일

```typescript
// ✅ 좋은 예
route.ts[id] / route.ts[slug] / [id] / route.ts;

// ❌ 나쁜 예
index.ts;
user.ts;
product - detail.ts;
```

#### 유틸리티 파일

```typescript
// ✅ 좋은 예
user - utils.ts;
date - helpers.ts;
validation - schemas.ts;

// ❌ 나쁜 예
userUtils.ts;
dateHelpers.ts;
validationSchemas.ts;
```

### TypeScript 컨벤션

#### 인터페이스 정의

```typescript
// ✅ 좋은 예
interface User {
  id: string;
  email: string;
  company_name: string;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
}

// ❌ 나쁜 예
interface user {
  Id: string;
  Email: string;
  CompanyName: string;
  ApprovalStatus: string;
  CreatedAt: string;
  UpdatedAt: string;
}
```

#### 함수 정의

```typescript
// ✅ 좋은 예
async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("사용자 조회 오류:", error);
    return null;
  }

  return data;
}

// ❌ 나쁜 예
async function getUserById(id) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  return data;
}
```

### React 컴포넌트 컨벤션

#### 컴포넌트 구조

```typescript
// ✅ 좋은 예
import { useState, useEffect } from "react";
import { Button } from "@/shared/ui/button";
import { User } from "@/shared/types";

interface UserListProps {
  users: User[];
  onUserSelect: (user: User) => void;
  isLoading?: boolean;
}

export function UserList({
  users,
  onUserSelect,
  isLoading = false,
}: UserListProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const handleUserClick = (user: User) => {
    setSelectedUserId(user.id);
    onUserSelect(user);
  };

  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      {users.map((user) => (
        <div
          key={user.id}
          className={`p-4 border rounded-lg cursor-pointer ${
            selectedUserId === user.id
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200"
          }`}
          onClick={() => handleUserClick(user)}
        >
          <h3 className="font-semibold">{user.company_name}</h3>
          <p className="text-gray-600">{user.email}</p>
        </div>
      ))}
    </div>
  );
}
```

## 🏗 프로젝트 구조 이해

### FSD (Feature-Sliced Design) 패턴

#### 레이어별 역할

```
src/
├── app/           # Next.js App Router (라우팅, API)
├── shared/        # 공유 리소스 (UI, 유틸, 타입)
├── entities/      # 비즈니스 엔티티 (도메인 모델)
├── features/      # 기능별 모듈 (비즈니스 로직)
├── widgets/       # 위젯 컴포넌트 (복합 UI)
└── page-components/ # 페이지별 컴포넌트
```

#### 의존성 규칙

- `app` → `shared`, `entities`, `features`, `widgets`, `page-components`
- `page-components` → `widgets`, `features`, `entities`, `shared`
- `widgets` → `features`, `entities`, `shared`
- `features` → `entities`, `shared`
- `entities` → `shared`
- `shared` → 외부 라이브러리만

### 폴더 구조 예시

#### Feature 모듈 구조

```
features/admin/user-management/
├── model/
│   ├── use-user-management.ts    # 비즈니스 로직
│   └── types.ts                  # 타입 정의
├── ui/
│   ├── user-list.tsx            # UI 컴포넌트
│   ├── user-form.tsx
│   └── user-detail-modal.tsx
└── index.ts                     # Public API
```

## 🔌 API 개발 가이드

### API 라우트 구조

#### 기본 구조

```typescript
// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase";

// GET - 사용자 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";

    // 데이터 조회 로직
    const { data, error, count } = await supabase
      .from("users")
      .select("*", { count: "exact" })
      .ilike("company_name", `%${search}%`)
      .range((page - 1) * limit, page * limit - 1)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("사용자 조회 오류:", error);
      return NextResponse.json(
        { success: false, error: "사용자 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error("API 오류:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST - 사용자 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();

    // 입력 검증
    if (!body.email || !body.company_name) {
      return NextResponse.json(
        { success: false, error: "필수 정보가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 데이터 생성 로직
    const { data, error } = await supabase
      .from("users")
      .insert(body)
      .select()
      .single();

    if (error) {
      console.error("사용자 생성 오류:", error);
      return NextResponse.json(
        { success: false, error: "사용자 생성에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: "사용자가 성공적으로 생성되었습니다.",
    });
  } catch (error) {
    console.error("API 오류:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
```

#### 동적 라우트

```typescript
// src/app/api/admin/users/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase";

// GET - 특정 사용자 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient();

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { success: false, error: "사용자를 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      console.error("사용자 조회 오류:", error);
      return NextResponse.json(
        { success: false, error: "사용자 조회에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("API 오류:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// PUT - 사용자 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from("users")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("사용자 수정 오류:", error);
      return NextResponse.json(
        { success: false, error: "사용자 수정에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: "사용자 정보가 성공적으로 수정되었습니다.",
    });
  } catch (error) {
    console.error("API 오류:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// DELETE - 사용자 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient();

    // 주문 내역 확인
    const { data: orders } = await supabase
      .from("orders")
      .select("id")
      .eq("user_id", id)
      .limit(1);

    if (orders && orders.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "주문 내역이 있는 사용자는 삭제할 수 없습니다.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("users").delete().eq("id", id);

    if (error) {
      console.error("사용자 삭제 오류:", error);
      return NextResponse.json(
        { success: false, error: "사용자 삭제에 실패했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "사용자가 성공적으로 삭제되었습니다.",
    });
  } catch (error) {
    console.error("API 오류:", error);
    return NextResponse.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
```

### API 응답 형식

#### 성공 응답

```typescript
{
  success: true,
  data: any,
  message?: string,
  pagination?: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```

#### 에러 응답

```typescript
{
  success: false,
  error: string,
  details?: any
}
```

## 🗄 데이터베이스 작업

### Supabase 클라이언트 사용

#### 기본 쿼리

```typescript
import { createClient } from "@/shared/lib/supabase";

const supabase = createClient();

// 단일 데이터 조회
const { data, error } = await supabase
  .from("users")
  .select("*")
  .eq("id", userId)
  .single();

// 목록 조회 (페이지네이션)
const { data, error, count } = await supabase
  .from("users")
  .select("*", { count: "exact" })
  .range(0, 9)
  .order("created_at", { ascending: false });

// 검색
const { data, error } = await supabase
  .from("users")
  .select("*")
  .ilike("company_name", `%${searchTerm}%`);

// 조인 쿼리
const { data, error } = await supabase.from("orders").select(`
    *,
    users!orders_user_id_fkey (
      company_name,
      email
    ),
    order_items (
      product_name,
      quantity,
      unit_price
    )
  `);
```

#### RPC 함수 호출

```typescript
// 재고 할당
const { data, error } = await supabase.rpc("allocate_stock", {
  p_product_id: productId,
  p_quantity: quantity,
  p_color: color,
  p_size: size,
});

// 가용재고 계산
const { data: availableStock, error } = await supabase.rpc(
  "calculate_available_stock",
  {
    p_product_id: productId,
    p_color: color,
    p_size: size,
  }
);
```

### 트랜잭션 처리

#### 배치 작업

```typescript
async function createOrderWithItems(orderData: any, items: any[]) {
  const supabase = createClient();

  try {
    // 1. 주문 생성
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert(orderData)
      .select()
      .single();

    if (orderError) throw orderError;

    // 2. 주문 아이템 생성
    const orderItems = items.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) throw itemsError;

    return { success: true, data: order };
  } catch (error) {
    console.error("주문 생성 오류:", error);
    return { success: false, error: error.message };
  }
}
```

## 📦 재고 관리 시스템

### 재고 구조 이해

#### 이중 재고 시스템

```typescript
interface InventoryOption {
  color: string;
  size: string;
  physical_stock: number; // 실제 물리적 재고
  allocated_stock: number; // 할당된 재고 (주문에 예약된 재고)
  stock_quantity: number; // 가용재고 (physical_stock - allocated_stock)
}
```

### 재고 할당 플로우

#### 1. 주문 생성 시

```typescript
// 1. 가용재고 확인
const { data: availableStock, error: stockError } = await supabase.rpc(
  "calculate_available_stock",
  {
    p_product_id: productId,
    p_color: color,
    p_size: size,
  }
);

if (availableStock < requestedQuantity) {
  throw new Error("재고가 부족합니다.");
}

// 2. 재고 할당
const { data: allocationResult, error: allocationError } = await supabase.rpc(
  "allocate_stock",
  {
    p_product_id: productId,
    p_quantity: requestedQuantity,
    p_color: color,
    p_size: size,
  }
);

if (allocationError) {
  throw new Error("재고 할당에 실패했습니다.");
}
```

#### 2. 출고 처리 시

```typescript
// 출고 처리 (물리적 재고 차감)
const { data: shipmentResult, error: shipmentError } = await supabase.rpc(
  "process_shipment",
  {
    p_product_id: productId,
    p_color: color,
    p_size: size,
    p_shipped_quantity: shippedQuantity,
    p_order_number: orderNumber,
  }
);

if (shipmentError) {
  throw new Error("출고 처리에 실패했습니다.");
}
```

### 재고 조정

#### 관리자 재고 조정

```typescript
// 재고 증가/차감
const { data: adjustResult, error: adjustError } = await supabase.rpc(
  "add_physical_stock",
  {
    p_product_id: productId,
    p_color: color,
    p_size: size,
    p_additional_stock: adjustmentAmount, // 양수: 증가, 음수: 차감
    p_reason: "관리자 재고 조정",
  }
);

// 재고 조정 후 자동 재할당
if (adjustmentAmount < 0) {
  await reallocateAfterStockReduction(productId, color, size);
}
```

### Working Date 시스템

#### 시간 기준 계산

```typescript
function calculateWorkingDate(): string {
  const now = new Date();
  const koreaTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Seoul" })
  );
  let workingDate = new Date(koreaTime);
  const originalDayOfWeek = koreaTime.getDay();

  // 15시 이후면 다음날로 설정
  if (koreaTime.getHours() >= 15) {
    workingDate.setDate(workingDate.getDate() + 1);
  }

  // 주말 처리
  if (originalDayOfWeek === 6) {
    // 토요일
    workingDate.setDate(workingDate.getDate() + 2);
  } else if (originalDayOfWeek === 0) {
    // 일요일
    workingDate.setDate(workingDate.getDate() + 1);
  } else if (originalDayOfWeek === 5 && koreaTime.getHours() >= 15) {
    // 금요일 15시 이후
    workingDate.setDate(workingDate.getDate() + 2);
  }

  return workingDate.toISOString().split("T")[0];
}
```

## 🔐 인증 및 권한 관리

### 관리자 인증

#### 미들웨어

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;

  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!token) {
      return NextResponse.redirect(new URL("/auth/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
```

#### 인증 헬퍼

```typescript
// src/shared/lib/admin-auth.ts
import { createClient } from "@/shared/lib/supabase";
import jwt from "jsonwebtoken";

export async function verifyAdminToken(token: string) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const supabase = createClient();

    const { data: admin, error } = await supabase
      .from("admins")
      .select("*")
      .eq("id", decoded.adminId)
      .single();

    if (error || !admin) {
      return null;
    }

    return admin;
  } catch (error) {
    return null;
  }
}

export async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("admin-token")?.value;

  if (!token) {
    throw new Error("인증이 필요합니다.");
  }

  const admin = await verifyAdminToken(token);
  if (!admin) {
    throw new Error("유효하지 않은 토큰입니다.");
  }

  return admin;
}
```

### 사용자 인증

#### Supabase Auth 사용

```typescript
// 로그인
const { data, error } = await supabase.auth.signInWithPassword({
  email: "user@example.com",
  password: "password",
});

// 회원가입
const { data, error } = await supabase.auth.signUp({
  email: "user@example.com",
  password: "password",
  options: {
    data: {
      company_name: "회사명",
      business_number: "123-45-67890",
    },
  },
});

// 로그아웃
await supabase.auth.signOut();
```

## ⚠️ 에러 처리

### API 에러 처리

#### 표준 에러 응답

```typescript
export function handleApiError(error: any, context: string) {
  console.error(`${context} 오류:`, error);

  if (error.code === "PGRST116") {
    return NextResponse.json(
      { success: false, error: "데이터를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  if (error.code === "23505") {
    return NextResponse.json(
      { success: false, error: "중복된 데이터입니다." },
      { status: 409 }
    );
  }

  if (error.code === "23503") {
    return NextResponse.json(
      { success: false, error: "관련 데이터가 존재하지 않습니다." },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { success: false, error: "서버 오류가 발생했습니다." },
    { status: 500 }
  );
}
```

#### 클라이언트 에러 처리

```typescript
// API 호출 래퍼
async function apiCall<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "API 호출에 실패했습니다.");
    }

    if (!data.success) {
      throw new Error(data.error || "요청 처리에 실패했습니다.");
    }

    return data.data;
  } catch (error) {
    console.error("API 호출 오류:", error);
    throw error;
  }
}

// 사용 예시
try {
  const users = await apiCall<User[]>("/api/admin/users");
  setUsers(users);
} catch (error) {
  toast.error(error.message);
}
```

### 사용자 친화적 에러 메시지

```typescript
const getErrorMessage = (error: any): string => {
  if (error.message.includes("network")) {
    return "네트워크 연결을 확인해주세요.";
  }
  if (error.message.includes("unauthorized")) {
    return "로그인이 필요합니다.";
  }
  if (error.message.includes("forbidden")) {
    return "접근 권한이 없습니다.";
  }
  if (error.message.includes("not found")) {
    return "요청한 데이터를 찾을 수 없습니다.";
  }
  if (error.message.includes("duplicate")) {
    return "이미 존재하는 데이터입니다.";
  }
  return "알 수 없는 오류가 발생했습니다.";
};
```

## 🚀 성능 최적화

### 이미지 최적화

```typescript
import Image from "next/image";

// Next.js Image 컴포넌트 사용
<Image
  src="/images/product.jpg"
  alt="상품 이미지"
  width={300}
  height={300}
  priority={isAboveFold} // 첫 화면에 보이는 이미지
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>;
```

### 데이터 페칭 최적화

#### React Query 사용

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// 데이터 조회
const {
  data: users,
  isLoading,
  error,
} = useQuery({
  queryKey: ["users", page, search],
  queryFn: () => fetchUsers({ page, search }),
  staleTime: 5 * 60 * 1000, // 5분
  cacheTime: 10 * 60 * 1000, // 10분
  refetchOnWindowFocus: false,
});

// 데이터 수정
const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: updateUser,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["users"] });
    toast.success("사용자 정보가 수정되었습니다.");
  },
  onError: (error) => {
    toast.error(error.message);
  },
});
```

### 코드 스플리팅

```typescript
import dynamic from "next/dynamic";

// 동적 임포트로 번들 크기 최적화
const UserManagement = dynamic(() => import("./UserManagement"), {
  loading: () => <div>로딩 중...</div>,
  ssr: false,
});

const ProductModal = dynamic(() => import("./ProductModal"), {
  loading: () => <div>모달 로딩 중...</div>,
});
```

### 메모이제이션

```typescript
import { memo, useMemo, useCallback } from "react";

// 컴포넌트 메모이제이션
const UserCard = memo(({ user, onSelect }: UserCardProps) => {
  const handleClick = useCallback(() => {
    onSelect(user);
  }, [user, onSelect]);

  const formattedDate = useMemo(() => {
    return new Date(user.created_at).toLocaleDateString("ko-KR");
  }, [user.created_at]);

  return (
    <div onClick={handleClick}>
      <h3>{user.company_name}</h3>
      <p>가입일: {formattedDate}</p>
    </div>
  );
});
```

## 🧪 테스트 작성

### 단위 테스트

```typescript
// __tests__/utils.test.ts
import { calculateWorkingDate } from "@/shared/lib/utils";

describe("calculateWorkingDate", () => {
  it("금요일 15시 이후 주문은 월요일로 설정되어야 함", () => {
    // Mock Date
    const mockDate = new Date("2024-01-05T16:00:00+09:00"); // 금요일 16시
    jest.spyOn(global, "Date").mockImplementation(() => mockDate);

    const result = calculateWorkingDate();
    expect(result).toBe("2024-01-08"); // 월요일
  });

  it("월요일 14시 59분 주문은 월요일로 설정되어야 함", () => {
    const mockDate = new Date("2024-01-08T14:59:00+09:00"); // 월요일 14시 59분
    jest.spyOn(global, "Date").mockImplementation(() => mockDate);

    const result = calculateWorkingDate();
    expect(result).toBe("2024-01-08"); // 월요일
  });
});
```

### API 테스트

```typescript
// __tests__/api/users.test.ts
import { GET, POST } from "@/app/api/admin/users/route";
import { NextRequest } from "next/server";

describe("/api/admin/users", () => {
  it("GET 요청 시 사용자 목록을 반환해야 함", async () => {
    const request = new NextRequest("http://localhost:3000/api/admin/users");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it("POST 요청 시 새 사용자를 생성해야 함", async () => {
    const userData = {
      email: "test@example.com",
      company_name: "테스트 회사",
      business_number: "123-45-67890",
    };

    const request = new NextRequest("http://localhost:3000/api/admin/users", {
      method: "POST",
      body: JSON.stringify(userData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.email).toBe(userData.email);
  });
});
```

### 컴포넌트 테스트

```typescript
// __tests__/components/UserList.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { UserList } from "@/features/admin/user-management/ui/user-list";

const mockUsers = [
  {
    id: "1",
    company_name: "테스트 회사",
    email: "test@example.com",
    approval_status: "pending" as const,
    created_at: "2024-01-01T00:00:00Z",
  },
];

describe("UserList", () => {
  it("사용자 목록을 렌더링해야 함", () => {
    const onUserSelect = jest.fn();

    render(<UserList users={mockUsers} onUserSelect={onUserSelect} />);

    expect(screen.getByText("테스트 회사")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("사용자 클릭 시 onUserSelect가 호출되어야 함", () => {
    const onUserSelect = jest.fn();

    render(<UserList users={mockUsers} onUserSelect={onUserSelect} />);

    fireEvent.click(screen.getByText("테스트 회사"));

    expect(onUserSelect).toHaveBeenCalledWith(mockUsers[0]);
  });
});
```

## 🚀 배포 및 운영

### Vercel 배포

#### 환경 변수 설정

```bash
# Vercel CLI로 환경 변수 설정
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
```

#### 배포 스크립트

```json
{
  "scripts": {
    "build": "next build",
    "start": "next start",
    "deploy": "vercel --prod"
  }
}
```

### 모니터링

#### 에러 추적

```typescript
// 에러 로깅
function logError(error: Error, context: string) {
  console.error(`[${context}] ${error.message}`, {
    stack: error.stack,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  });

  // 외부 에러 추적 서비스로 전송 (예: Sentry)
  // Sentry.captureException(error, { tags: { context } })
}
```

#### 성능 모니터링

```typescript
// 성능 측정
function measurePerformance(name: string, fn: () => void) {
  const start = performance.now();
  fn();
  const end = performance.now();

  console.log(`${name} 실행 시간: ${end - start}ms`);

  // 성능 데이터를 외부 서비스로 전송
  // analytics.track('performance', { name, duration: end - start })
}
```

### 백업 및 복구

#### 데이터베이스 백업

```bash
# Supabase CLI로 백업
supabase db dump --file backup.sql

# 특정 테이블만 백업
supabase db dump --table users,orders --file partial_backup.sql
```

#### 파일 백업

```bash
# 이미지 파일 백업
gsutil -m cp -r gs://your-bucket/images/ gs://backup-bucket/images/
```

## 📚 추가 리소스

### 유용한 링크

- [Next.js 공식 문서](https://nextjs.org/docs)
- [Supabase 공식 문서](https://supabase.com/docs)
- [Tailwind CSS 문서](https://tailwindcss.com/docs)
- [TypeScript 핸드북](https://www.typescriptlang.org/docs/)

### 개발 도구

- [Supabase Studio](https://supabase.com/dashboard) - 데이터베이스 관리
- [Vercel Dashboard](https://vercel.com/dashboard) - 배포 관리
- [GitHub Actions](https://github.com/features/actions) - CI/CD

### 커뮤니티

- [Next.js Discord](https://discord.gg/nextjs)
- [Supabase Discord](https://discord.supabase.com)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/next.js)

---

이 가이드를 따라 개발하면 루소 도매 시스템의 일관성 있고 유지보수 가능한 코드를 작성할 수 있습니다. 추가 질문이나 개선 사항이 있으면 언제든 문의해주세요.
