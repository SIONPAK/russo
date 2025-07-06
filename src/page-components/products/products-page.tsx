'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MainLayout } from '@/widgets/layout/main-layout'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { useProducts } from '@/features/product/model/use-products'
import { useCart } from '@/features/cart/model/use-cart'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { formatCurrency } from '@/shared/lib/utils'
import { showInfo, showSuccess } from '@/shared/lib/toast'
import { 
  Search, 
  Filter, 
  SlidersHorizontal,
  Grid3X3,
  List,
  ShoppingCart,
  Heart,
  Star,
  ChevronDown,
  Package
} from 'lucide-react'

export function ProductsPage() {
  const router = useRouter()
  const { user, isAuthenticated, userType } = useAuthStore()
  const { addToCart } = useCart()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  
  const {
    products,
    categories,
    loading,
    error,
    filters,
    pagination,
    setFilters,
    setPage,
    setSortBy
  } = useProducts()

  useEffect(() => {
    console.log('Products Page - Auth State:', { user, isAuthenticated })
    
    if (!isAuthenticated || !user) {
      console.log('Products Page - Not authenticated, redirecting to login')
      alert('로그인이 필요한 서비스입니다.')
      router.push('/auth/login')
      return
    }
  }, [isAuthenticated, user, router])

  // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
  if (!isAuthenticated || !user) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">로그인이 필요합니다</h2>
            <p className="text-gray-600 mb-4">상품을 보시려면 로그인해주세요.</p>
            <button 
              onClick={() => router.push('/auth/login')}
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              로그인하기
            </button>
          </div>
        </div>
      </MainLayout>
    )
  }

  // 해시태그 파싱
  const parseHashtags = (tags: string) => {
    if (!tags) return []
    return tags.split(' ').filter(tag => tag.startsWith('#')).map(tag => tag.substring(1))
  }

  // 메인 이미지 가져오기
  const getMainImage = (product: any) => {
    if (!product.images || product.images.length === 0) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjlGQUZCIi8+CjxwYXRoIGQ9Ik0yMDAgMTMwQzIxNi41NjkgMTMwIDIzMCAxNDMuNDMxIDIzMCAxNjBDMjMwIDE3Ni41NjkgMjE2LjU2OSAxOTAgMjAwIDE5MEMxODMuNDMxIDE5MCAxNzAgMTc2LjU2OSAxNzAgMTYwQzE3MCAxNDMuNDMxIDE4My40MzEgMTMwIDIwMCAxMzBaIiBmaWxsPSIjRDFENURCIi8+CjxwYXRoIGQ9Ik0xNDAgMjIwSDI2MEMyNjUuNTIzIDIyMCAyNzAgMjI0LjQ3NyAyNzAgMjMwVjI3MEMyNzAgMjc1LjUyMyAyNjUuNTIzIDI4MCAyNjAgMjgwSDE0MEMxMzQuNDc3IDI4MCAxMzAgMjc1LjUyMyAxMzAgMjcwVjIzMEMxMzAgMjI0LjQ3NyAxMzQuNDc3IDIyMCAxNDAgMjIwWiIgZmlsbD0iI0QxRDVEQiIvPgo8L3N2Zz4K'
    }
    
    const mainImage = product.images.find((img: any) => img.is_main === true)
    if (mainImage && mainImage.image_url) {
      return mainImage.image_url
    }
    
    const firstImage = product.images[0]
    if (firstImage && firstImage.image_url) {
      return firstImage.image_url
    }
    
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjlGQUZCIi8+CjxwYXRoIGQ9Ik0yMDAgMTMwQzIzMC45IDEzMCAyNTUgMTU0LjEgMjU1IDE4NUMyNTUgMjE1LjkgMjMwLjkgMjQwIDIwMCAyNDBDMTY5LjEgMjQwIDE0NSAyMTUuOSAxNDUgMTg1QzE0NSAxNTQuMSAxNjkuMSAxMzAgMjAwIDEzMFoiIGZpbGw9IiNEMUQ1REIiLz4KPHBhdGggZD0iTTE0MCAyNzBIMjYwQzI3MS4wNDYgMjcwIDI4MCAyNzguOTU0IDI4MCAyOTBWMzMwQzI4MCAzNDEuMDQ2IDI3MS4wNDYgMzUwIDI2MCAzNTBIMTQwQzEyOC45NTQgMzUwIDEyMCAzNDEuMDQ2IDEyMCAzMzBWMjkwQzEyMCAyNzguOTU0IDEyOC45NTQgMjcwIDE0MCAyNzBaIiBmaWxsPSIjRDFENURCIi8+Cjwvc3ZnPgo='
  }

  // 신상품 여부 확인
  const isNewProduct = (createdAt: string) => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return new Date(createdAt) >= thirtyDaysAgo
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // 검색은 이미 debounce로 처리됨
  }

  const handleSortChange = (sortValue: string) => {
    setSortBy(sortValue as any)
  }

  const handleCategoryFilter = (categoryId: string) => {
    setFilters(prev => ({
      ...prev,
      category: categoryId === 'all' ? '' : categoryId
    }))
  }

  const handleSpecialFilter = (filterKey: 'new' | 'sale' | 'featured' | '') => {
    setFilters({ filter: filterKey })
  }

  const handlePageChange = (page: number) => {
    setPage(page)
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
            <p className="mt-4 text-gray-600">상품을 불러오는 중...</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">오류가 발생했습니다</h2>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-white py-12">
        {/* 헤더 */}
        <div className="bg-white border-b border-gray-100">
          <div className="min-h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">전체 상품</h1>
              <p className="text-lg text-gray-600">
                총 {pagination.total}개의 상품이 있습니다
              </p>
            </div>

            {/* 검색 및 필터 */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* 검색바 */}
              <form onSubmit={handleSearch} className="flex-1 max-w-lg">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="상품명을 검색하세요..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="pl-12 h-12 text-base rounded-xl border-2 border-gray-300 focus:border-black"
                  />
                </div>
              </form>

              {/* 정렬 및 뷰 모드 */}
              <div className="flex items-center gap-4">
                {/* 정렬 */}
                <div className="relative">
                  <select
                    value={filters.sortBy}
                    onChange={(e) => handleSortChange(e.target.value)}
                    className="appearance-none bg-white border-2 border-gray-300 rounded-xl px-4 py-3 pr-10 text-sm font-medium focus:border-black focus:outline-none"
                  >
                    <option value="created_at_desc">최신순</option>
                    <option value="created_at_asc">오래된순</option>
                    <option value="price_asc">가격 낮은순</option>
                    <option value="price_desc">가격 높은순</option>
                    <option value="name_asc">이름순</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>

                {/* 뷰 모드 */}
                <div className="flex bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Grid3X3 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <List className="h-5 w-5" />
                  </button>
                </div>

                {/* 필터 토글 */}
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  className="border-2 border-gray-300 rounded-xl px-4 py-3 hover:border-gray-400"
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  필터
                </Button>
              </div>
            </div>

            {/* 카테고리 필터 */}
            {showFilters && (
              <div className="mt-6 p-6 bg-gray-50 rounded-2xl">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">카테고리</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleCategoryFilter('all')}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      !filters.category ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    전체
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => handleCategoryFilter(category.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                        filters.category === category.id ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 상품 목록 */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {products.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-gray-400 text-6xl mb-4">📦</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">상품이 없습니다</h3>
              <p className="text-gray-600">검색 조건을 변경해보세요.</p>
            </div>
          ) : (
            <>
              {viewMode === 'grid' ? (
                /* 그리드 뷰 - 3x3 */
                <div className="grid grid-cols-3 gap-8">
                  {products.map((product) => (
                    <div key={product.id} className="group">
                      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100">
                        {/* 상품 이미지 */}
                        <div className="relative aspect-square bg-gray-50 overflow-hidden">
                          <Link href={`/products/${product.id}`}>
                            <img
                              src={getMainImage(product)}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                const target = e.currentTarget
                                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjlGQUZCIi8+CjxwYXRoIGQ9Ik0yMDAgMTMwQzIxNi41NjkgMTMwIDIzMCAxNDMuNDMxIDIzMCAxNjBDMjMwIDE3Ni41NjkgMjE2LjU2OSAxOTAgMjAwIDE5MEMxODMuNDMxIDE5MCAxNzAgMTc2LjU2OSAxNzAgMTYwQzE3MCAxNDMuNDMxIDE4My40MzEgMTMwIDIwMCAxMzBaIiBmaWxsPSIjRDFENURCIi8+CjxwYXRoIGQ9Ik0xNDAgMjIwSDI2MEMyNjUuNTIzIDIyMCAyNzAgMjI0LjQ3NyAyNzAgMjMwVjI3MEMyNzAgMjc1LjUyMyAyNjUuNTIzIDI4MCAyNjAgMjgwSDE0MEMxMzQuNDc3IDI4MCAxMzAgMjc1LjUyMyAxMzAgMjcwVjIzMEMxMzAgMjI0LjQ3NyAxMzQuNDc3IDIyMCAxNDAgMjIwWiIgZmlsbD0iI0QxRDVEQiIvPgo8L3N2Zz4K'
                              }}
                            />
                          </Link>
                          
                          {/* 배지들 */}
                          <div className="absolute top-3 left-3 flex flex-col gap-1">
                            {isNewProduct(product.created_at) && (
                              <span className="bg-black text-white text-xs px-2 py-1 font-medium rounded-full">
                                NEW
                              </span>
                            )}
                            {product.is_on_sale && (
                              <span className="bg-red-500 text-white text-xs px-2 py-1 font-medium rounded-full">
                                SALE
                              </span>
                            )}
                            {product.is_featured && (
                              <span className="bg-blue-500 text-white text-xs px-2 py-1 font-medium rounded-full">
                                HOT
                              </span>
                            )}
                          </div>

                          {/* 호버 시 상품명과 해시태그 표시 */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 pointer-events-none">
                            <h3 className="text-base font-semibold text-white text-center mb-3 line-clamp-2">
                              {product.name}
                            </h3>
                            {/* 해시태그 */}
                            {product.tags && typeof product.tags === 'string' && (
                              <div className="flex flex-wrap gap-1 justify-center">
                                {parseHashtags(product.tags).slice(0, 3).map((tag, index) => (
                                  <span key={index} className="text-xs text-white bg-white/20 px-2 py-1 rounded-full">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* 액션 버튼들 */}
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {/* 장바구니 버튼 - 어드민이 아닐 때만 표시 */}
                            {userType !== 'admin' && (
                              <button 
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  if (!isAuthenticated) {
                                    showInfo('로그인이 필요합니다.')
                                    return
                                  }
                                  
                                  try {
                                    const unitPrice = product.is_on_sale && product.sale_price ? product.sale_price : product.price
                                    
                                    addToCart({
                                      productId: product.id,
                                      productName: product.name,
                                      productImage: getMainImage(product),
                                      unitPrice,
                                      quantity: 1,
                                      color: '',
                                      size: '',
                                    })
                                    
                                    showSuccess(`${product.name}이(가) 장바구니에 추가되었습니다.`)
                                  } catch (error) {
                                    showInfo('장바구니 추가 중 오류가 발생했습니다.')
                                  }
                                }}
                                className="w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-md transition-colors pointer-events-auto"
                              >
                                <ShoppingCart className="h-4 w-4 text-gray-600" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* 리스트 뷰 */
                <div className="space-y-6">
                  {products.map((product) => (
                    <div key={product.id} className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow border border-gray-100">
                      <div className="flex">
                        {/* 상품 이미지 */}
                        <div className="relative w-48 h-48 bg-gray-50 flex-shrink-0">
                          <Link href={`/products/${product.id}`}>
                            <img
                              src={getMainImage(product)}
                              alt={product.name}
                              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                const target = e.currentTarget
                                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjlGQUZCIi8+CjxwYXRoIGQ9Ik0yMDAgMTMwQzIxNi41NjkgMTMwIDIzMCAxNDMuNDMxIDIzMCAxNjBDMjMwIDE3Ni41NjkgMjE2LjU2OSAxOTAgMjAwIDE5MEMxODMuNDMxIDE5MCAxNzAgMTc2LjU2OSAxNzAgMTYwQzE3MCAxNDMuNDMxIDE4My40MzEgMTMwIDIwMCAxMzBaIiBmaWxsPSIjRDFENURCIi8+CjxwYXRoIGQ9Ik0xNDAgMjIwSDI2MEMyNjUuNTIzIDIyMCAyNzAgMjI0LjQ3NyAyNzAgMjMwVjI3MEMyNzAgMjc1LjUyMyAyNjUuNTIzIDI4MCAyNjAgMjgwSDE0MEMxMzQuNDc3IDI4MCAxMzAgMjc1LjUyMyAxMzAgMjcwVjIzMEMxMzAgMjI0LjQ3NyAxMzQuNDc3IDIyMCAxNDAgMjIwWiIgZmlsbD0iI0QxRDVEQiIvPgo8L3N2Zz4K'
                              }}
                            />
                          </Link>
                          
                          {/* 배지들 */}
                          <div className="absolute top-3 left-3 flex flex-col gap-1">
                            {isNewProduct(product.created_at) && (
                              <span className="bg-black text-white text-xs px-2 py-1 font-medium rounded-full">
                                NEW
                              </span>
                            )}
                            {product.is_on_sale && (
                              <span className="bg-red-500 text-white text-xs px-2 py-1 font-medium rounded-full">
                                SALE
                              </span>
                            )}
                            {product.is_featured && (
                              <span className="bg-blue-500 text-white text-xs px-2 py-1 font-medium rounded-full">
                                HOT
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 상품 정보 */}
                        <div className="flex-1 p-6">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <Link href={`/products/${product.id}`}>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                  {product.name}
                                </h3>
                              </Link>
                              
                              <p className="text-gray-600 mb-3 line-clamp-2">
                                {product.description || '상품 설명이 없습니다.'}
                              </p>
                              
                              {/* 해시태그 */}
                              {product.tags && typeof product.tags === 'string' && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {parseHashtags(product.tags).slice(0, 5).map((tag, index) => (
                                    <span key={index} className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="text-right ml-6">
                              {/* 가격 표시 완전 숨김 */}
                              <div className="mb-4">
                                {/* 가격 대신 빈 공간 */}
                              </div>

                              {/* 액션 버튼들 */}
                              <div className="flex justify-end">
                                {/* 장바구니 버튼 - 어드민이 아닐 때만 표시 */}
                                {userType !== 'admin' && (
                                  <button 
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      if (!isAuthenticated) {
                                        showInfo('로그인이 필요합니다.')
                                        return
                                      }
                                      
                                      try {
                                        const unitPrice = product.is_on_sale && product.sale_price ? product.sale_price : product.price
                                        
                                        addToCart({
                                          productId: product.id,
                                          productName: product.name,
                                          productImage: getMainImage(product),
                                          unitPrice,
                                          quantity: 1,
                                          color: '',
                                          size: '',
                                        })
                                        
                                        showSuccess(`${product.name}이(가) 장바구니에 추가되었습니다.`)
                                      } catch (error) {
                                        showInfo('장바구니 추가 중 오류가 발생했습니다.')
                                      }
                                    }}
                                    className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                                  >
                                    <ShoppingCart className="h-5 w-5 text-gray-600" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 페이지네이션 */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center mt-12">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setPage(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="rounded-xl border-2 border-gray-200"
                    >
                      이전
                    </Button>
                    
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      const pageNum = i + 1
                      return (
                        <Button
                          key={pageNum}
                          variant={pagination.page === pageNum ? 'default' : 'outline'}
                          onClick={() => setPage(pageNum)}
                          className={`w-10 h-10 rounded-xl border-2 ${
                            pagination.page === pageNum 
                              ? 'bg-black text-white border-black' 
                              : 'border-gray-200'
                          }`}
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                    
                    <Button
                      variant="outline"
                      onClick={() => setPage(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                      className="rounded-xl border-2 border-gray-200"
                    >
                      다음
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  )
} 