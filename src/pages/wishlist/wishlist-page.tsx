'use client'

import { useState } from 'react'
import { Heart, ShoppingCart, X, Package } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { MainLayout } from '@/widgets/layout/main-layout'

interface WishlistItem {
  id: string
  name: string
  price: number
  originalPrice?: number
  image: string
  category: string
  inStock: boolean
  addedDate: string
}

const mockWishlistItems: WishlistItem[] = [
  {
    id: '1',
    name: '[R001] 클래식 데일리 셔츠',
    price: 89000,
    originalPrice: 120000,
    image: '/placeholder-product.jpg',
    category: '상의',
    inStock: true,
    addedDate: '2024-01-15'
  },
  {
    id: '2',
    name: '[R003] 미니멀 블레이저 재킷',
    price: 180000,
    originalPrice: 220000,
    image: '/placeholder-product.jpg',
    category: '아우터',
    inStock: true,
    addedDate: '2024-01-10'
  },
  {
    id: '3',
    name: '[R005] 울 블렌드 코트',
    price: 250000,
    originalPrice: 320000,
    image: '/placeholder-product.jpg',
    category: '아우터',
    inStock: false,
    addedDate: '2024-01-05'
  }
]

export function WishlistPage() {
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>(mockWishlistItems)

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const removeFromWishlist = (itemId: string) => {
    setWishlistItems(items => items.filter(item => item.id !== itemId))
  }

  const addToCart = (item: WishlistItem) => {
    if (!item.inStock) return
    // 장바구니 추가 로직
    alert(`${item.name}이(가) 장바구니에 추가되었습니다.`)
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* 페이지 헤더 */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">관심상품</h1>
            <p className="text-gray-600">
              관심있는 상품들을 모아보고 장바구니에 담아보세요.
            </p>
          </div>

          {/* 관심상품 목록 */}
          {wishlistItems.length > 0 ? (
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    관심상품 ({wishlistItems.length}개)
                  </h2>
                  <Button
                    variant="outline"
                    onClick={() => setWishlistItems([])}
                    className="text-gray-600 hover:text-red-600"
                  >
                    전체 삭제
                  </Button>
                </div>
              </div>

              <div className="divide-y divide-gray-200">
                {wishlistItems.map((item) => (
                  <div key={item.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      {/* 상품 이미지 */}
                      <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Package className="w-12 h-12 text-gray-400" />
                      </div>

                      {/* 상품 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 mb-1">
                              {item.name}
                            </h3>
                            <p className="text-sm text-gray-500 mb-2">
                              {item.category}
                            </p>
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-xl font-bold text-gray-900">
                                {formatPrice(item.price)}원
                              </span>
                              {item.originalPrice && (
                                <span className="text-sm text-gray-500 line-through">
                                  {formatPrice(item.originalPrice)}원
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              관심상품 등록: {formatDate(item.addedDate)}
                            </p>
                          </div>

                          {/* 삭제 버튼 */}
                          <button
                            onClick={() => removeFromWishlist(item.id)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        {/* 액션 버튼들 */}
                        <div className="flex items-center space-x-3 mt-4">
                          <Button
                            onClick={() => addToCart(item)}
                            disabled={!item.inStock}
                            className={`flex items-center ${
                              item.inStock
                                ? 'bg-black text-white hover:bg-gray-800'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            {item.inStock ? '장바구니 담기' : '품절'}
                          </Button>
                          
                          <Button variant="outline">
                            상품 보기
                          </Button>

                          {!item.inStock && (
                            <span className="text-sm text-red-500 font-medium">
                              현재 품절된 상품입니다
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 하단 액션 */}
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    총 {wishlistItems.length}개의 관심상품
                  </div>
                  <div className="flex items-center space-x-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        const inStockItems = wishlistItems.filter(item => item.inStock)
                        if (inStockItems.length > 0) {
                          alert(`${inStockItems.length}개 상품이 장바구니에 추가되었습니다.`)
                        } else {
                          alert('장바구니에 담을 수 있는 상품이 없습니다.')
                        }
                      }}
                    >
                      선택상품 장바구니 담기
                    </Button>
                    <Button
                      className="bg-black text-white hover:bg-gray-800"
                      onClick={() => window.location.href = '/products'}
                    >
                      쇼핑 계속하기
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 빈 상태 */
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                관심상품이 없습니다
              </h3>
              <p className="text-gray-500 mb-6">
                마음에 드는 상품을 관심상품으로 등록해보세요.
              </p>
              <Button
                onClick={() => window.location.href = '/products'}
                className="bg-black text-white hover:bg-gray-800"
              >
                상품 둘러보기
              </Button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
} 