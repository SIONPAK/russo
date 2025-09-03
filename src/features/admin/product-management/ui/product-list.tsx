'use client'

import { useState } from 'react'
import { Product, Category, ProductFilters } from '@/shared/types'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Filter,
  Star,
  Package,
  TrendingUp,
  AlertCircle,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

interface ProductListProps {
  products: (Product & { 
    total_stock?: number
    stock_status?: string
    base_stock?: number
    inventory_stock?: number
  })[]
  categories: Category[]
  loading: boolean
  error: string | null
  filters: ProductFilters
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  onFiltersChange: (filters: any) => void
  onPageChange: (page: number) => void
  onEdit: (product: Product) => void
  onDelete: (id: string) => void
  onAdd: () => void
  onViewDetail: (product: Product) => void
}

export function ProductList({
  products,
  categories,
  loading,
  error,
  filters,
  pagination,
  onFiltersChange,
  onPageChange,
  onEdit,
  onDelete,
  onAdd,
  onViewDetail
}: ProductListProps) {
  const [searchTerm, setSearchTerm] = useState(filters.search || '')
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onFiltersChange({ ...filters, search: searchTerm, page: 1 })
  }

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({ ...filters, [key]: value, page: 1 })
  }

  const handleSort = (sortBy: string) => {
    const newOrder = filters.sort_by === sortBy && filters.sort_order === 'asc' ? 'desc' : 'asc'
    onFiltersChange({ ...filters, sort_by: sortBy, sort_order: newOrder })
  }

  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([])
    } else {
      setSelectedProducts(products.map(p => p.id))
    }
  }

  const handleSelectProduct = (id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) 
        ? prev.filter(pid => pid !== id)
        : [...prev, id]
    )
  }

  const getStatusBadge = (product: Product) => {
    if (!product.is_active) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          비활성
        </span>
      )
    }
    if (product.stock_quantity === 0) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <Package className="w-3 h-3 mr-1" />
          품절
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <Package className="w-3 h-3 mr-1" />
        판매중
      </span>
    )
  }

  const getMainImage = (product: Product) => {
    // 디버깅을 위해 콘솔에 출력
    console.log('Product images:', product.name, product.images)
    
    if (!product.images || product.images.length === 0) {
      console.log('No images found for product:', product.name)
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik00MCAyNkM0My4zMTM3IDI2IDQ2IDI4LjY4NjMgNDYgMzJDNDYgMzUuMzEzNyA0My4zMTM3IDM4IDQwIDM4QzM2LjY4NjMgMzggMzQgMzUuMzEzNyAzNCAzMkMzNCAyOC42ODYzIDM2LjY4NjMgMjYgNDAgMjZaIiBmaWxsPSIjOUNBM0FGIi8+CjxwYXRoIGQ9Ik0yOCA0NEg1MkM1My4xMDQ2IDQ0IDU0IDQ0Ljg5NTQgNTQgNDZWNTRDNTQgNTUuMTA0NiA1My4xMDQ2IDU2IDUyIDU2SDI4QzI2Ljg5NTQgNTYgMjYgNTUuMTA0NiAyNiA1NFY0NkMyNiA0NC44OTU0IDI2Ljg5NTQgNDQgMjggNDRaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPgo='
    }
    
    // is_main이 true인 이미지 찾기
    const mainImage = product.images.find(img => img.is_main === true)
    if (mainImage && mainImage.image_url) {
      console.log('Found main image:', mainImage.image_url)
      return mainImage.image_url
    }
    
    // 첫 번째 이미지 사용
    const firstImage = product.images[0]
    if (firstImage && firstImage.image_url) {
      console.log('Using first image:', firstImage.image_url)
      return firstImage.image_url
    }
    
    console.log('No valid images found, using placeholder')
    // 기본 플레이스홀더
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik00MCAyNkM0My4zMTM3IDI2IDQ2IDI4LjY4NjMgNDYgMzJDNDYgMzUuMzEzNyA0My4zMTM3IDM4IDQwIDM4QzM2LjY4NjMgMzggMzQgMzUuMzEzNyAzNCAzMkMzNCAyOC42ODYzIDM2LjY4NjMgMjYgNDAgMjZaIiBmaWxsPSIjOUNBM0FGIi8+CjxwYXRoIGQ9Ik0yOCA0NEg1MkM1My4xMDQ2IDQ0IDU0IDQ0Ljg5NTQgNTQgNDZWNTRDNTQgNTUuMTA0NiA1My4xMDQ2IDU2IDUyIDU2SDI4QzI2Ljg5NTQgNTYgMjYgNTUuMTA0NiAyNiA1NFY0NkMyNiA0NC4xMDQ2IDI2Ljg5NTQgNDQgMjggNDRaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPgo='
  }

  const getStockStatusColor = (status: string, stock: number) => {
    if (stock === 0) return 'text-red-600 bg-red-50'
    if (status === '부족') return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  const getStockStatusText = (status: string, stock: number) => {
    if (stock === 0) return '품절'
    return status || '충분'
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">상품 목록을 불러오는 중...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">오류가 발생했습니다</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 및 필터 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">상품 관리</h2>
            <p className="text-gray-600 mt-1">총 {pagination.total}개의 상품</p>
          </div>
          <Button 
            onClick={onAdd}
            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-2 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
          >
            <Plus className="w-5 h-5 mr-2" />
            상품 추가
          </Button>
        </div>

        {/* 검색 및 필터 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="상품명 또는 코드로 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12 rounded-xl border-gray-200 focus:border-blue-500"
            />
          </form>

          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="h-12 px-4 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="all">전체 상태</option>
            <option value="active">판매중</option>
            <option value="inactive">비활성</option>
            <option value="out_of_stock">품절</option>
          </select>

          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="h-12 px-4 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">전체 카테고리</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            value={`${filters.sort_by}_${filters.sort_order}`}
            onChange={(e) => {
              const [sort_by, sort_order] = e.target.value.split('_')
              onFiltersChange({ ...filters, sort_by, sort_order })
            }}
            className="h-12 px-4 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="created_at_desc">최신순</option>
            <option value="created_at_asc">오래된순</option>
            <option value="name_asc">이름순</option>
            <option value="price_desc">가격 높은순</option>
            <option value="price_asc">가격 낮은순</option>
            <option value="stock_desc">재고 많은순</option>
            <option value="stock_asc">재고 적은순</option>
          </select>
        </div>
      </div>

      {/* 상품 목록 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">상품이 없습니다</h3>
            <p className="text-gray-600 mb-6">첫 번째 상품을 등록해보세요.</p>
            <Button 
              onClick={onAdd}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-2 rounded-xl"
            >
              <Plus className="w-5 h-5 mr-2" />
              상품 추가
            </Button>
          </div>
        ) : (
          <>
            {/* 테이블 헤더 */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <div className="grid grid-cols-12 gap-4 items-center text-sm font-semibold text-gray-700">
                <div className="col-span-1">
                  <input
                    type="checkbox"
                    checked={selectedProducts.length === products.length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                <div className="col-span-3">상품 정보</div>
                <div className="col-span-2">카테고리</div>
                <div className="col-span-2">가격</div>
                <div className="col-span-1 text-center">재고</div>
                <div className="col-span-1 text-center">상태</div>
                <div className="col-span-1 text-center">특성</div>
                <div className="col-span-1 text-center">액션</div>
              </div>
            </div>

            {/* 테이블 바디 */}
            <div className="divide-y divide-gray-200">
              {products.map((product) => (
                <div key={product.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    {/* 대표 이미지 */}
                    <div className="col-span-1">
                      <div 
                        className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:shadow-md transition-shadow border border-gray-200"
                        onClick={() => onViewDetail(product)}
                      >
                        <img
                          src={getMainImage(product)}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget
                            console.error('Image load failed:', target.src)
                            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik00MCAyNkM0My4zMTM3IDI2IDQ2IDI4LjY4NjMgNDYgMzJDNDYgMzUuMzEzNyA0My4zMTM3IDM4IDQwIDM4QzM2LjY4NjMgMzggMzQgMzUuMzEzNyAzNCAzMkMzNCAyOC42ODYzIDM2LjY4NjMgMjYgNDAgMjZaIiBmaWxsPSIjOUNBM0FGIi8+CjxwYXRoIGQ9Ik0yOCA0NEg1MkM1My4xMDQ2IDQ0IDU0IDQ0Ljg5NTQgNTQgNDZWNTRDNTQgNTUuMTA0NiA1My4xMDQ2IDU2IDUyIDU2SDI4QzI2Ljg5NTQgNTYgMjYgNTUuMTA0NiAyNiA1NFY0NkMyNiA0NC44OTU0IDI2Ljg5NTQgNDQgMjggNDRaIiBmaWxsPSIjOUNBM0FGIi/+Cjwvc3ZnPgo='
                            target.classList.add('opacity-50')
                          }}
                          onLoad={() => {
                            console.log('Image loaded successfully:', getMainImage(product))
                          }}
                        />
                        {product.images && product.images.length > 1 && (
                          <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-md font-medium">
                            {product.images.length}
                          </div>
                        )}
                        
                      </div>
                    </div>

                    {/* 상품 정보 */}
                    <div className="col-span-3">
                      <div className="flex items-start space-x-3">
                        <div className="flex-1">
                          <h6 className="text-md font-semibold text-gray-900 mb-1 hover:text-blue-600 cursor-pointer" onClick={() => onViewDetail(product)}>
                            {product.name}
                          </h6>
                          <p className="text-sm text-gray-500 mb-1">{product.code}</p>
                          {product.description && (
                            <p className="text-xs text-gray-400 line-clamp-2">{product.description}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 카테고리 */}
                    <div className="col-span-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700">
                        {product.category?.name || '미분류'}
                      </span>
                    </div>

                    {/* 가격 */}
                    <div className="col-span-2">
                      <div className="flex flex-col">
                        {product.is_on_sale && product.sale_price ? (
                          <>
                            <span className="text-sm font-bold text-red-600">
                              {formatPrice(product.sale_price)}원
                            </span>
                            <span className="text-xs text-gray-400 line-through">
                              {formatPrice(product.price)}원
                            </span>
                          </>
                        ) : (
                          <span className="text-sm font-bold text-gray-900">
                            {formatPrice(product.price)}원
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 재고 */}
                    <div className="col-span-1 text-center">
                      <div className="flex flex-col">
                        {/* 총 재고 수량 */}
                        {(() => {
                          let totalStock = 0
                          let stockDetails = ''
                          
                          if (product.inventory_options && Array.isArray(product.inventory_options)) {
                            // inventory_options에서 모든 stock_quantity 합계
                            totalStock = product.inventory_options.reduce((sum, opt) => sum + (opt.stock_quantity || 0), 0)
                            
                            // 옵션별 재고 상세 정보
                            const stockByColor: { [key: string]: number } = {}
                            product.inventory_options.forEach(opt => {
                              if (opt.color && opt.stock_quantity !== undefined) {
                                if (!stockByColor[opt.color]) stockByColor[opt.color] = 0
                                stockByColor[opt.color] += opt.stock_quantity || 0
                              }
                            })
                            
                            stockDetails = Object.entries(stockByColor)
                              .map(([color, stock]) => `${color}:${stock}`)
                              .join(', ')
                          } else {
                            // 기본 재고
                            totalStock = product.stock_quantity || 0
                          }
                          
                          return (
                            <>
                              <span className={`text-sm font-medium ${
                                totalStock === 0 ? 'text-red-600' : 
                                totalStock < 10 ? 'text-orange-600' : 'text-green-600'
                              }`}>
                                {totalStock}개
                              </span>
                              <span className={`text-xs text-gray-500 ${
                                getStockStatusColor(
                                  product.stock_status || '', 
                                  totalStock
                                )
                              }`}>
                                {getStockStatusText(
                                  product.stock_status || '', 
                                  totalStock
                                )}
                              </span>
                              {/* 옵션별 재고 상세 정보 */}
                              {stockDetails && (
                                <div className="text-xs text-gray-400 mt-1 max-w-[80px] truncate" title={stockDetails}>
                                  {stockDetails}
                                </div>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    </div>

                    {/* 상태 */}
                    <div className="col-span-1 text-center">
                      {getStatusBadge(product)}
                    </div>

                    {/* 특성 */}
                    <div className="col-span-1 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {product.is_featured && (
                          <div title="인기상품">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                          </div>
                        )}
                        {product.is_on_sale && (
                          <div title="세일중">
                            <TrendingUp className="w-4 h-4 text-red-500" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 액션 */}
                    <div className="col-span-1 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => handleSelectProduct(product.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewDetail(product)}
                          className="w-8 h-8 p-0 rounded-lg border-gray-200 hover:bg-green-50 hover:border-green-300 text-green-600"
                          title="상세보기"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(product)}
                          className="w-8 h-8 p-0 rounded-lg border-gray-200 hover:bg-blue-50 hover:border-blue-300"
                          title="수정"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDelete(product.id)}
                          className="w-8 h-8 p-0 rounded-lg border-gray-200 hover:bg-red-50 hover:border-red-300 text-red-600"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              총 {pagination.total}개 중 {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}개 표시
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-2 rounded-lg"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const page = i + Math.max(1, pagination.page - 2)
                if (page > pagination.totalPages) return null
                
                return (
                  <Button
                    key={page}
                    variant={page === pagination.page ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(page)}
                    className="px-3 py-2 rounded-lg"
                  >
                    {page}
                  </Button>
                )
              })}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-2 rounded-lg"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 