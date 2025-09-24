# 기여 가이드 (Contributing Guide)

루소 도매 시스템에 기여해주셔서 감사합니다! 이 문서는 프로젝트에 기여하는 방법을 안내합니다.

## 📋 목차

1. [기여 방법](#기여-방법)
2. [개발 워크플로우](#개발-워크플로우)
3. [코드 스타일](#코드-스타일)
4. [커밋 컨벤션](#커밋-컨벤션)
5. [Pull Request 가이드](#pull-request-가이드)
6. [이슈 리포팅](#이슈-리포팅)
7. [문서화](#문서화)

## 🤝 기여 방법

### 기여할 수 있는 영역

- 🐛 **버그 수정**: 버그 리포트 및 수정
- ✨ **새 기능**: 새로운 기능 개발
- 📚 **문서화**: README, 가이드 문서 개선
- 🎨 **UI/UX 개선**: 사용자 인터페이스 개선
- ⚡ **성능 최적화**: 성능 개선
- 🧪 **테스트**: 테스트 코드 작성
- 🔧 **리팩토링**: 코드 품질 개선

### 기여 전 확인사항

1. **이슈 확인**: 기존 이슈에서 중복 작업이 있는지 확인
2. **문서 읽기**: README.md와 DEVELOPMENT_GUIDE.md 숙지
3. **환경 설정**: 로컬 개발 환경 구축
4. **코드 스타일**: 프로젝트의 코딩 컨벤션 준수

## 🔄 개발 워크플로우

### 1. 저장소 포크 및 클론

```bash
# 1. GitHub에서 저장소 포크
# 2. 포크된 저장소 클론
git clone https://github.com/YOUR_USERNAME/russo.git
cd russo

# 3. 원본 저장소를 upstream으로 추가
git remote add upstream https://github.com/ORIGINAL_OWNER/russo.git
```

### 2. 브랜치 생성

```bash
# 메인 브랜치에서 최신 코드 가져오기
git checkout main
git pull upstream main

# 기능 브랜치 생성
git checkout -b feature/새기능명
# 또는
git checkout -b fix/버그수정명
# 또는
git checkout -b docs/문서개선명
```

### 3. 개발 및 테스트

```bash
# 의존성 설치
yarn install

# 개발 서버 실행
yarn dev

# 테스트 실행
yarn test

# 린팅 확인
yarn lint
```

### 4. 커밋 및 푸시

```bash
# 변경사항 스테이징
git add .

# 커밋 (커밋 컨벤션 준수)
git commit -m "feat: 새로운 기능 추가"

# 브랜치 푸시
git push origin feature/새기능명
```

### 5. Pull Request 생성

1. GitHub에서 Pull Request 생성
2. 템플릿에 따라 내용 작성
3. 리뷰어 지정
4. 관련 이슈 연결

## 📝 코드 스타일

### TypeScript 컨벤션

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

async function getUserById(id: string): Promise<User | null> {
  try {
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
  } catch (error) {
    console.error("예상치 못한 오류:", error);
    return null;
  }
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
    return <div className="flex justify-center p-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      {users.map((user) => (
        <div
          key={user.id}
          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
            selectedUserId === user.id
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300"
          }`}
          onClick={() => handleUserClick(user)}
        >
          <h3 className="font-semibold text-gray-900">{user.company_name}</h3>
          <p className="text-sm text-gray-600">{user.email}</p>
          <span
            className={`inline-block px-2 py-1 text-xs rounded-full ${
              user.approval_status === "approved"
                ? "bg-green-100 text-green-800"
                : user.approval_status === "pending"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {user.approval_status === "approved"
              ? "승인됨"
              : user.approval_status === "pending"
              ? "승인 대기"
              : "반려됨"}
          </span>
        </div>
      ))}
    </div>
  );
}
```

### API 라우트 컨벤션

```typescript
// ✅ 좋은 예
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";

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
```

## 📝 커밋 컨벤션

### 커밋 메시지 형식

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 종류

- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 수정
- `style`: 코드 포맷팅, 세미콜론 누락 등
- `refactor`: 코드 리팩토링
- `test`: 테스트 코드 추가/수정
- `chore`: 빌드 과정 또는 보조 도구 변경

### Scope 종류

- `auth`: 인증 관련
- `admin`: 관리자 기능
- `user`: 사용자 기능
- `order`: 주문 관련
- `product`: 상품 관련
- `inventory`: 재고 관련
- `api`: API 관련
- `ui`: UI 컴포넌트
- `db`: 데이터베이스 관련

### 예시

```bash
# 새로운 기능
git commit -m "feat(admin): 사용자 승인 기능 추가"

# 버그 수정
git commit -m "fix(inventory): 재고 할당 로직 오류 수정"

# 문서 수정
git commit -m "docs: README 업데이트"

# 리팩토링
git commit -m "refactor(api): 사용자 API 응답 형식 개선"

# 테스트 추가
git commit -m "test(user): 사용자 관리 테스트 케이스 추가"
```

## 🔍 Pull Request 가이드

### PR 템플릿

```markdown
## 📝 변경사항 요약

- 변경사항을 간단히 설명해주세요

## 🔗 관련 이슈

- Closes #이슈번호

## 🧪 테스트

- [ ] 로컬에서 테스트 완료
- [ ] 기존 기능에 영향 없음 확인
- [ ] 새로운 테스트 케이스 추가 (필요시)

## 📸 스크린샷 (UI 변경시)

- 변경 전/후 스크린샷 첨부

## 📋 체크리스트

- [ ] 코드 스타일 가이드 준수
- [ ] TypeScript 타입 정의 완료
- [ ] 에러 처리 구현
- [ ] 로깅 추가 (필요시)
- [ ] 문서 업데이트 (필요시)
```

### PR 리뷰 기준

#### 코드 품질

- [ ] 코드가 읽기 쉽고 이해하기 쉬운가?
- [ ] 적절한 주석이 있는가?
- [ ] 에러 처리가 적절한가?
- [ ] 성능에 문제가 없는가?

#### 기능성

- [ ] 요구사항을 만족하는가?
- [ ] 기존 기능을 깨뜨리지 않는가?
- [ ] 보안상 문제가 없는가?

#### 테스트

- [ ] 테스트가 충분한가?
- [ ] 모든 테스트가 통과하는가?

### PR 머지 조건

1. **리뷰 승인**: 최소 1명의 리뷰어 승인
2. **테스트 통과**: 모든 CI/CD 테스트 통과
3. **충돌 해결**: merge conflict 없음
4. **문서 업데이트**: 필요한 경우 문서 업데이트

## 🐛 이슈 리포팅

### 버그 리포트 템플릿

```markdown
## 🐛 버그 설명

버그에 대한 명확하고 간결한 설명

## 🔄 재현 단계

1. '...'로 이동
2. '...' 클릭
3. '...' 스크롤
4. 오류 확인

## 🎯 예상 결과

예상했던 결과 설명

## 📱 실제 결과

실제로 발생한 결과 설명

## 📸 스크린샷

가능한 경우 스크린샷 첨부

## 💻 환경 정보

- OS: [예: Windows 10, macOS 12.0]
- 브라우저: [예: Chrome 91, Firefox 89]
- 버전: [예: v1.2.3]

## 📋 추가 정보

추가적인 컨텍스트나 정보
```

### 기능 요청 템플릿

```markdown
## ✨ 기능 요청

원하는 기능에 대한 명확하고 간결한 설명

## 💡 동기

이 기능이 왜 필요한지 설명

## 📋 상세 설명

기능의 구체적인 동작 방식 설명

## 🎯 대안

고려했던 다른 해결책이나 대안

## 📋 추가 정보

추가적인 컨텍스트나 정보
```

## 📚 문서화

### 문서 작성 가이드

#### README 업데이트

- 새로운 기능 추가 시 README에 설명 추가
- 설치/설정 방법 변경 시 업데이트
- 새로운 환경 변수 추가 시 문서화

#### 코드 주석

```typescript
/**
 * 사용자 정보를 조회합니다.
 * @param id - 사용자 ID
 * @returns 사용자 정보 또는 null
 * @throws {Error} 사용자 조회 실패 시
 */
async function getUserById(id: string): Promise<User | null> {
  // 구현...
}
```

#### API 문서

```typescript
/**
 * @api {get} /api/admin/users 사용자 목록 조회
 * @apiName GetUsers
 * @apiGroup Admin
 * @apiParam {Number} [page=1] 페이지 번호
 * @apiParam {Number} [limit=10] 페이지당 항목 수
 * @apiParam {String} [search] 검색어
 * @apiSuccess {Boolean} success 성공 여부
 * @apiSuccess {Array} data 사용자 목록
 * @apiSuccess {Object} pagination 페이지네이션 정보
 */
```

### 문서 구조

```
docs/
├── api/              # API 문서
├── deployment/       # 배포 가이드
├── troubleshooting/  # 문제 해결 가이드
└── user-guide/      # 사용자 가이드
```

## 🏷 라벨 시스템

### 이슈 라벨

- `bug`: 버그
- `enhancement`: 기능 개선
- `feature`: 새 기능
- `documentation`: 문서
- `good first issue`: 초보자용
- `help wanted`: 도움 필요
- `priority: high`: 높은 우선순위
- `priority: medium`: 중간 우선순위
- `priority: low`: 낮은 우선순위

### PR 라벨

- `ready for review`: 리뷰 준비 완료
- `needs review`: 리뷰 필요
- `approved`: 승인됨
- `changes requested`: 변경 요청
- `breaking change`: 호환성 깨짐
- `hotfix`: 긴급 수정

## 🤝 커뮤니티 가이드라인

### 행동 강령

1. **존중**: 모든 참여자를 존중하고 친절하게 대하세요
2. **건설적**: 건설적인 피드백과 제안을 제공하세요
3. **협력**: 팀워크를 중시하고 협력적으로 접근하세요
4. **학습**: 서로 배우고 성장하는 환경을 만들어가세요

### 소통 방법

- **GitHub Issues**: 버그 리포트, 기능 요청
- **GitHub Discussions**: 일반적인 질문, 아이디어 공유
- **Pull Request**: 코드 리뷰, 토론
- **이메일**: 민감한 보안 이슈

## 🎉 기여자 인정

### 기여자 목록

프로젝트에 기여해주신 모든 분들께 감사드립니다:

- [기여자 이름](GitHub 프로필 링크) - 기여 내용

### 기여 인정 방법

- GitHub 기여자 목록에 자동 추가
- README에 기여자 섹션 추가
- 릴리즈 노트에 기여자 명시

## 📞 지원 및 문의

### 개발 관련 문의

- **GitHub Issues**: 기술적 문제나 질문
- **GitHub Discussions**: 일반적인 토론
- **이메일**: tech@lusso.com

### 비즈니스 관련 문의

- **이메일**: admin@lusso.com

---

**감사합니다!** 루소 도매 시스템을 더 나은 시스템으로 만들어주셔서 감사합니다. 여러분의 기여가 프로젝트의 성공에 큰 도움이 됩니다.

> 💡 **팁**: 처음 기여하시는 분들은 `good first issue` 라벨이 붙은 이슈부터 시작해보세요!
