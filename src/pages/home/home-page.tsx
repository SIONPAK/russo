'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useProducts } from '@/features/product/model/use-products'
import { useCategoryMenu } from '@/features/category-menu/model/use-category-menu'
import { useCart } from '@/features/cart/model/use-cart'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { formatCurrency } from '@/shared/lib/utils'
import { Category } from '@/shared/types'
import { 
  Search, 
  ShoppingCart, 
  Package
} from "lucide-react"
import { MainLayout } from "@/widgets/layout/main-layout"
import { showInfo, showSuccess } from '@/shared/lib/toast'
import Link from 'next/link'

export function HomePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [mounted, setMounted] = useState(false)
  const { categories, loading: categoriesLoading } = useCategoryMenu()
  const { getCartSummary, addToCart } = useCart()
  const { user, isAuthenticated } = useAuthStore()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  // URL 파라미터에서 카테고리 가져오기
  const selectedCategory = searchParams?.get('category') || 'new'
  
  // 실제 상품 데이터 가져오기
  const { 
    products, 
    loading: productsLoading, 
    error: productsError,
    setFilters
  } = useProducts()
  
  // 클라이언트에서만 장바구니 정보 사용
  useEffect(() => {
    setMounted(true)
  }, [])

  // 첫 번째 카테고리를 기본 선택으로 설정
  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      router.push(`/?category=${categories[0].key}`)
    }
  }, [categories, router, selectedCategory])

  // 카테고리나 검색어 변경 시 필터 업데이트
  useEffect(() => {
    const filter = selectedCategory === 'new' ? 'new' : 
                   selectedCategory === 'sale' ? 'sale' : ''
    const category = ['new', 'sale'].includes(selectedCategory) ? '' : selectedCategory

    setFilters({
      search: searchTerm,
      category,
      filter,
      page: 1
    })
  }, [selectedCategory, searchTerm, setFilters])
  
  const cartSummary = mounted ? getCartSummary() : { totalItems: 0, totalAmount: 0, discountAmount: 0, finalAmount: 0 }

  // 메인 이미지 가져오기 함수
  const getMainImage = (product: any) => {
    if (!product.images || product.images.length === 0) {
      return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTMwQzIxNi41NjkgMTMwIDIzMCAxNDMuNDMxIDIzMCAxNjBDMjMwIDE3Ni41NjkgMjE2LjU2OSAxOTAgMjAwIDE5MEMxODMuNDMxIDE5MCAxNzAgMTc2LjU2OSAxNzAgMTYwQzE3MCAxNDMuNDMxIDE4My40MzEgMTMwIDIwMCAxMzBaIiBmaWxsPSIjOUNBM0FGIi8+CjxwYXRoIGQ9Ik0xNDAgMjIwSDI2MEMyNjUuNTIzIDIyMCAyNzAgMjI0LjQ3NyAyNzAgMjMwVjI3MEMyNzAgMjc1LjUyMyAyNjUuNTIzIDI4MCAyNjAgMjgwSDE0MEMxMzQuNDc3IDI4MCAxMzAgMjc1LjUyMyAxMzAgMjcwVjIzMEMxMzAgMjI0LjQ3NyAxMzQuNDc3IDIyMCAxNDAgMjIwWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K'
    }
    
    // is_main이 true인 이미지 찾기
    const mainImage = product.images.find((img: any) => img.is_main === true)
    if (mainImage && mainImage.image_url) {
      return mainImage.image_url
    }
    
    // 첫 번째 이미지 사용
    const firstImage = product.images[0]
    if (firstImage && firstImage.image_url) {
      return firstImage.image_url
    }
    
    // 기본 플레이스홀더
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTMwQzIxNi41NjkgMTMwIDIzMCAxNDMuNDMxIDIzMCAxNjBDMjMwIDE3Ni41NjkgMjE2LjU2OSAxOTAgMjAwIDE5MEMxODMuNDMxIDE5MCAxNzAgMTc2LjU2OSAxNzAgMTYwQzE3MCAxNDMuNDMxIDE4My40MzEgMTMwIDIwMCAxMzBaIiBmaWxsPSIjOUNBM0FGIi8+CjxwYXRoIGQ9Ik0xNDAgMjIwSDI2MEMyNjUuNTIzIDIyMCAyNzAgMjI0LjQ3NyAyNzAgMjMwVjI3MEMyNzAgMjc1LjUyMyAyNjUuNTIzIDI4MCAyNjAgMjgwSDE0MEMxMzQuNDc3IDI4MCAxMzAgMjc1LjUyMyAxMzAgMjcwVjIzMEMxMzAgMjI0LjQ3NyAxMzQuNDc3IDIyMCAxNDAgMjIwWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K'
  }

  // 해시태그 파싱
  const parseHashtags = (tags: string) => {
    if (!tags) return []
    return tags.split(' ').filter(tag => tag.startsWith('#')).map(tag => tag.substring(1))
  }

  // 필터링된 상품 목록
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = (() => {
      switch (selectedCategory) {
        case 'new': 
          // 최근 30일 내 등록된 상품
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          return new Date(product.created_at) >= thirtyDaysAgo
        case 'sale': 
          return product.is_on_sale
        default: 
          return product.category?.key === selectedCategory || selectedCategory === 'new'
      }
    })()
    
    return matchesSearch && matchesCategory
  })

  // 신상품 여부 확인
  const isNewProduct = (product: any) => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return new Date(product.created_at) >= thirtyDaysAgo
  }

  return (
    <MainLayout>
      {/* 메인 컨텐츠 */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* 페이지 타이틀 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {(() => {
              const currentCategory = categories.find((cat: Category) => cat.key === selectedCategory)
              return currentCategory ? currentCategory.name : 'NEW ITEMS'
            })()}
          </h1>
          <p className="text-gray-600">
            {(() => {
              switch (selectedCategory) {
                case 'new': return '루소 신상품'
                case 'sale': return '특가 상품'
                case 'womans': return '여성 의류'
                case 'denim': return '데님 컬렉션'
                case 'cotton': return '코튼 소재'
                case 'outer': return '아우터 컬렉션'
                case 'tshirt': return '티셔츠 & 셔츠'
                case 'slacks': return '슬랙스 & 바지'
                case 'training': return '트레이닝웨어'
                case 'shorts': return '반바지 기획전'
                case 'shirts': return '셔츠 기획전'
                default: return '루소 상품'
              }
            })()}
          </p>
        </div>

        {/* 검색 및 필터 */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="상품명으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-gray-600">
              총 {filteredProducts.length}개 상품
            </div>
          </div>
        </div>

        {/* 상품 그리드 */}
        {productsLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            <span className="ml-3 text-gray-600">상품을 불러오는 중...</span>
          </div>
        ) : productsError ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">오류가 발생했습니다</h3>
            <p className="text-gray-500">{productsError}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">상품이 없습니다</h3>
            <p className="text-gray-500">해당 카테고리에 상품이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`}>
                <div className="bg-white rounded-lg overflow-hidden group cursor-pointer shadow-sm hover:shadow-lg border border-gray-200 transition-all duration-200">
                  {/* 상품 이미지 */}
                  <div className="relative aspect-square bg-gray-100 overflow-hidden">
                    <img
                      src={getMainImage(product)}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      onError={(e) => {
                        const target = e.currentTarget
                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTMwQzIxNi41NjkgMTMwIDIzMCAxNDMuNDMxIDIzMCAxNjBDMjMwIDE3Ni41NjkgMjE2LjU2OSAxOTAgMjAwIDE5MEMxODMuNDMxIDE5MCAxNzAgMTc2LjU2OSAxNzAgMTYwQzE3MCAxNDMuNDMxIDE4My40MzEgMTMwIDIwMCAxMzBaIiBmaWxsPSIjOUNBM0FGIi8+CjxwYXRoIGQ9Ik0xNDAgMjIwSDI2MEMyNjUuNTIzIDIyMCAyNzAgMjI0LjQ3NyAyNzAgMjMwVjI3MEMyNzAgMjc1LjUyMyAyNjUuNTIzIDI4MCAyNjAgMjgwSDE0MEMxMzQuNDc3IDI4MCAxMzAgMjc1LjUyMyAxMzAgMjcwVjIzMEMxMzAgMjI0LjQ3NyAxMzQuNDc3IDIyMCAxNDAgMjIwWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K'
                      }}
                    />
                    
                    {/* 배지들 */}
                    <div className="absolute top-2 left-2 flex flex-col gap-1">
                      {isNewProduct(product) && (
                        <span className="bg-black text-white text-xs px-2 py-1 font-medium rounded">
                          NEW
                        </span>
                      )}
                      {product.is_on_sale && (
                        <span className="bg-gray-800 text-white text-xs px-2 py-1 font-medium rounded">
                          SALE
                        </span>
                      )}
                      {product.is_featured && (
                        <span className="bg-gray-600 text-white text-xs px-2 py-1 font-medium rounded">
                          HOT
                        </span>
                      )}
                    </div>

                    {/* 장바구니 버튼 */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (!isAuthenticated) {
                            showInfo('로그인이 필요합니다.')
                            return
                          }
                          
                          // 실제 장바구니에 상품 추가
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
                        className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors"
                      >
                        <ShoppingCart className="h-4 w-4 text-gray-700" />
                      </button>
                    </div>
                  </div>
                  
                  {/* 상품 정보 */}
                  <div className="p-3">
                    <h3 className="font-medium text-gray-900 text-sm mb-2 line-clamp-2">
                      {product.name}
                    </h3>
                    
                    {/* 해시태그 */}
                    {product.tags && typeof product.tags === 'string' && (
                      <div className="mb-2">
                        <span className="text-xs text-gray-500">
                          {parseHashtags(product.tags).slice(0, 1).map(tag => `#${tag}`).join(' ')}
                        </span>
                      </div>
                    )}
                    
                    {/* 가격 */}
                    <div className="flex items-baseline gap-2">
                      {isAuthenticated ? (
                        product.is_on_sale && product.sale_price ? (
                          <>
                            <span className="text-sm font-bold text-gray-900">
                              {formatCurrency(product.sale_price)}
                            </span>
                            <span className="text-xs text-gray-400 line-through">
                              {formatCurrency(product.price)}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm font-bold text-gray-900">
                            {formatCurrency(product.price)}
                          </span>
                        )
                      ) : (
                        <div className="h-5"></div>
                      )}
                    </div>

                    {/* 사이즈 정보 */}
                    <div className="mt-2">
                      <span className="text-xs text-gray-500">S,M,L,XL</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  )
} 