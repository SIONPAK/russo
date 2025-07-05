// 사용자 관련 타입
export interface User {
  id: string
  email: string
  password_hash?: string
  company_name: string
  business_number: string
  representative_name: string
  phone: string
  address: string
  postal_code: string
  recipient_name: string
  recipient_phone: string
  business_license?: string
  approval_status: 'pending' | 'approved' | 'rejected'
  is_active: boolean
  created_at: string
  updated_at: string
  user_id: string
  priority_level?: number
  user_type?: string
  mileage_balance?: number
  // 새로 추가된 필드들
  last_login_at?: string
  is_dormant: boolean
  dormant_at?: string
  customer_grade: 'premium' | 'general'
  approval_notes?: string
  rejected_reason?: string
  rejected_at?: string
  approved_at?: string
  approved_by?: string
}

// 관리자 타입
export interface Admin {
  id: string
  username: string
  email: string
  role: 'admin' | 'super_admin'
  created_at: string
}

// 카테고리 관련 타입
export interface Category {
  id: string
  key: string
  name: string
  path: string
  order_index: number
  is_active: boolean
  is_special: boolean
  badge?: string
  text_color?: string
  created_at: string
  updated_at: string
}

// 상품 재고 옵션 타입
export interface InventoryOption {
  color: string
  size: string
  stock_quantity: number
}

// 상품 관련 타입
export interface Product {
  id: string
  name: string
  description: string
  detailed_description?: string // 에디터로 작성하는 상세 설명
  category_id: string
  category?: Category
  code: string
  price: number
  sale_price?: number // 세일가
  is_on_sale: boolean // 세일 여부
  is_featured: boolean // 인기상품 여부
  is_active: boolean
  stock_quantity: number
  inventory_options?: InventoryOption[] // 색상/사이즈별 재고 옵션
  unit: string
  images: ProductImage[]
  main_image_id?: string // 대표 이미지 ID
  inventory?: ProductInventory[] // 옵션별 재고 정보 (기존 호환성용)
  sku?: string
  weight?: number
  dimensions?: string
  tags?: string[]
  meta_title?: string
  meta_description?: string
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  image_url: string
  alt_text?: string
  sort_order: number
  is_main: boolean
  created_at: string
}

export interface CreateProductData {
  name: string
  description: string
  detailed_description?: string
  category_id: string
  code: string
  price: number
  sale_price?: number
  is_on_sale: boolean
  is_featured: boolean
  is_active: boolean
  stock_quantity: number
  inventory_options?: InventoryOption[] // 색상/사이즈별 재고 옵션
  unit: string
  sku?: string
  weight?: number
  dimensions?: string
  tags?: string[]
  meta_title?: string
  meta_description?: string
}

export interface UpdateProductData extends Partial<CreateProductData> {
  id: string
}

// 상품 상세 정보 타입
export interface ProductDetail extends Product {
  category: Category
  originalPrice?: number
  isNew: boolean
  tags: string[]
  detailImages: string[]
  specifications: {
    material: string
    care: string
    origin: string
    model: string
  }
  options: ProductOption[]
}

// 상품 옵션 타입
export interface ProductOption {
  id: string
  color: string
  size: string
  stock: number
  additionalPrice: number
}

// 재고 관련 타입
export interface Inventory {
  id: string
  productId: string
  color: string
  size: string
  quantity: number
  reservedQuantity: number
  updatedAt: string
}

// 주문 관련 타입
export interface Order {
  id: string
  user_id: string
  order_number: string
  total_amount: number
  shipping_fee?: number
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  shipping_name?: string
  shipping_phone?: string
  shipping_address: string
  shipping_postal_code?: string
  notes?: string
  tracking_number: string | null
  order_type?: string
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  orderId: string
  productId: string
  productName: string
  color: string
  size: string
  quantity: number
  unitPrice: number
  totalPrice: number
  shipped_quantity?: number
}

// 마일리지 관련 타입
export interface Mileage {
  id: string
  user_id: string
  amount: number
  type: 'earn' | 'spend'
  source: 'manual' | 'auto' | 'order' | 'refund'
  description: string
  status: 'pending' | 'completed' | 'cancelled'
  order_id: string | null
  processed_by: string | null
  created_at: string
  updated_at: string
  user?: {
    id: string
    company_name: string
    representative_name: string
    email: string
  }
}

// 배송지 관련 타입
export interface ShippingAddress {
  id: string
  userId: string
  recipientName: string
  phone: string
  address: string
  postalCode: string
  isDefault: boolean
}

// API 응답 타입
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

// 페이지네이션 타입
export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// 샘플 관련 타입
export interface Sample {
  id: string
  sample_number: string
  customer_id: string
  customer_name: string
  product_id: string
  product_name: string
  product_options: string
  quantity: number
  outgoing_date: string
  status: 'pending' | 'recovered' | 'overdue' | 'charged'
  charge_amount: number
  charge_method: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// 추천상품 관리 타입
export interface FeaturedProduct {
  id: string
  productId: string
  type: 'featured' | 'popular'
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  product?: Product
}

export interface FeaturedProductForm {
  productId: string
  type: 'featured' | 'popular'
  order: number
  isActive: boolean
}

// 메인페이지 카테고리 메뉴 관리 타입
export interface CategoryMenu {
  id: string
  name: string
  key: string
  path: string
  order: number
  isActive: boolean
  isSpecial: boolean
  badge?: string
  textColor?: string
  createdAt: string
  updatedAt: string
}

export interface CategoryMenuForm {
  name: string
  key: string
  path: string
  order: number
  isActive: boolean
  isSpecial: boolean
  badge?: string
  textColor?: string
}

// 장바구니 관련 타입
export interface CartItem {
  id: string
  productId: string
  productName: string
  productImage: string
  color: string
  size: string
  quantity: number
  unitPrice: number
  totalPrice: number
  addedAt: string
}

export interface CartSummary {
  totalItems: number
  totalAmount: number
  discountAmount: number
  finalAmount: number
}

// 폼 데이터 타입들
export interface RegisterData {
  email: string
  password: string
  company_name: string
  business_number: string
  representative_name: string
  phone: string
  address: string
  postal_code: string
  recipient_name: string
  recipient_phone: string
  business_license?: string
}

export interface LoginData {
  email: string
  password: string
}

export interface AdminLoginData {
  username: string
  password: string
}

// 통계 관련 타입들
export interface UserStats {
  total: number
  pending: number
  approved: number
  rejected: number
}

export interface OrderStats {
  total: number
  pending: number
  confirmed: number
  shipped: number
  delivered: number
  cancelled: number
}

// 검색 및 필터 타입들
export interface UserFilters {
  search?: string
  approval_status?: 'all' | 'pending' | 'approved' | 'rejected'
  sort_by?: 'created_at' | 'company_name' | 'representative_name'
  sort_order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface ProductFilters {
  search?: string
  status?: 'all' | 'active' | 'inactive' | 'out_of_stock' | 'low_stock'
  category?: string
  sort_by?: 'created_at' | 'name' | 'price' | 'stock'
  sort_order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// 상품 재고 타입
export interface ProductInventory {
  id: string
  product_id: string
  color: string
  size: string
  stock_quantity: number
  created_at: string
  updated_at: string
}

// 사용자 상태 변경 이력 타입
export interface UserStatusLog {
  id: string
  user_id: string
  previous_status: string
  new_status: string
  action_type: 'approve' | 'reject' | 'activate' | 'deactivate' | 'dormant'
  reason?: string
  changed_by: string
  created_at: string
} 