// 앱 설정
export const SITE_CONFIG = {
  name: '루소 도매 시스템',
  version: '1.0.0',
  description: '도매법인 루소 ERP 시스템',
  company: '루소',
  phone: '010-1234-5678',
  email: 'info@lusso.com',
  address: '서울특별시 강남구 테헤란로 123'
}

// API 경로
export const API_ROUTES = {
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout',
    register: '/api/auth/register',
    verify: '/api/auth/verify',
  },
  admin: {
    users: '/api/admin/users',
    products: '/api/admin/products',
    orders: '/api/admin/orders',
    inventory: '/api/admin/inventory',
    mileage: '/api/admin/mileage',
  },
  customer: {
    profile: '/api/customer/profile',
    orders: '/api/customer/orders',
    mileage: '/api/customer/mileage',
    products: '/api/customer/products',
  },
}

// 페이지 경로
export const ROUTES = {
  home: '/',
  
  // 인증
  login: '/auth/login',
  register: '/auth/register',
  
  // 공통
  cart: '/cart',
  
  // 관리자
    admin: {
    dashboard: '/admin',
    users: '/admin/users',
    products: '/admin/products',
    inventory: '/admin/inventory',
    orders: '/admin/orders',
    mileage: '/admin/mileage',
    samples: '/admin/samples',
    featured: '/admin/featured',
  },
  
  // 고객
  customer: {
    dashboard: '/customer',
    products: '/customer/products',
    cart: '/customer/cart',
    orders: '/customer/orders',
    mileage: '/customer/mileage',
    profile: '/customer/profile',
    shipping: '/customer/shipping',
    documents: '/customer/documents',
    tracking: '/customer/tracking',
  },
}

// 승인 상태
export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved', 
  REJECTED: 'rejected',
} as const

// 주문 상태
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const

// 상품 상태
export const PRODUCT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  OUT_OF_STOCK: 'out_of_stock',
} as const

// 마일리지 타입
export const MILEAGE_TYPE = {
  EARN: 'earn',
  SPEND: 'spend',
} as const

// 마일리지 소스
export const MILEAGE_SOURCE = {
  MANUAL: 'manual',
  AUTO: 'auto',
  ORDER: 'order',
  REFUND: 'refund',
} as const

// 샘플 상태
export const SAMPLE_STATUS = {
  PENDING: 'pending',
  RECOVERED: 'recovered',
  OVERDUE: 'overdue',
  CHARGED: 'charged',
} as const

// 샘플 청구 방법
export const SAMPLE_CHARGE_METHOD = {
  MANUAL: 'manual',
  AUTO_MILEAGE: 'auto_mileage',
} as const

// 사용자 역할
export const USER_ROLES = {
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
  CUSTOMER: 'customer',
} as const

// 페이지네이션 기본값
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
}

// 파일 업로드 설정
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp'],
}

// 에러 메시지
export const ERROR_MESSAGES = {
  REQUIRED_FIELD: '필수 입력 항목입니다.',
  INVALID_EMAIL: '유효하지 않은 이메일 주소입니다.',
  INVALID_BUSINESS_NUMBER: '유효하지 않은 사업자등록번호입니다.',
  INVALID_PHONE: '유효하지 않은 전화번호입니다.',
  PASSWORD_TOO_SHORT: '비밀번호는 최소 8자 이상이어야 합니다.',
  PASSWORD_MISMATCH: '비밀번호가 일치하지 않습니다.',
  LOGIN_FAILED: '로그인에 실패했습니다.',
  UNAUTHORIZED: '권한이 없습니다.',
  FORBIDDEN: '접근이 금지되었습니다.',
  NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',
  SERVER_ERROR: '서버 오류가 발생했습니다.',
}

// 성공 메시지
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: '로그인되었습니다.',
  LOGOUT_SUCCESS: '로그아웃되었습니다.',
  REGISTER_SUCCESS: '회원가입이 완료되었습니다.',
  UPDATE_SUCCESS: '정보가 업데이트되었습니다.',
  DELETE_SUCCESS: '삭제되었습니다.',
  CREATE_SUCCESS: '생성되었습니다.',
} 