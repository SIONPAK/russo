'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/widgets/layout/main-layout'
import { Button } from '@/shared/ui/button'
import { useCart } from '@/features/cart/model/use-cart'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { formatCurrency } from '@/shared/lib/utils'
import { showInfo, showSuccess } from '@/shared/lib/toast'
import { 
  Minus, 
  Plus, 
  Trash2, 
  ShoppingBag,
  ArrowLeft,
  Package
} from 'lucide-react'
import Link from 'next/link'

export function CartPage() {
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()
  const { 
    cartItems, 
    updateQuantity, 
    removeFromCart, 
    clearCart, 
    getCartSummary 
  } = useCart()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      showInfo('로그인이 필요합니다.')
      router.push('/auth/login')
    }
  }, [mounted, isAuthenticated, router])

  const cartSummary = mounted ? getCartSummary() : { 
    totalItems: 0, 
    totalAmount: 0, 
    discountAmount: 0, 
    finalAmount: 0 
  }

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      handleRemoveItem(itemId)
      return
    }
    updateQuantity(itemId, newQuantity)
  }

  const handleRemoveItem = (itemId: string) => {
    removeFromCart(itemId)
    showSuccess('상품이 장바구니에서 제거되었습니다.')
  }

  const handleClearCart = () => {
    if (window.confirm('장바구니를 비우시겠습니까?')) {
      clearCart()
      showSuccess('장바구니가 비워졌습니다.')
    }
  }

  const handleCheckout = () => {
    if (!user?.id) {
      showInfo('로그인이 필요합니다.')
      router.push('/auth/login')
      return
    }
    
    if (cartItems.length === 0) {
      showInfo('장바구니에 상품이 없습니다.')
      return
    }
    
    // 주문 페이지로 이동
    router.push('/order')
  }

  if (!mounted) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      </MainLayout>
    )
  }

  if (!isAuthenticated) {
    return null // useEffect에서 리다이렉트 처리
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 헤더 */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">장바구니</h1>
                  <p className="text-gray-600 mt-1">
                    {cartSummary.totalItems}개 상품
                  </p>
                </div>
              </div>
              
              {cartItems.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleClearCart}
                  className="text-gray-700 border-gray-300 hover:bg-gray-100 hover:text-black"
                >
                  전체 삭제
                </Button>
              )}
            </div>
          </div>

          {cartItems.length === 0 ? (
            /* 빈 장바구니 */
            <div className="text-center py-16">
              <ShoppingBag className="h-24 w-24 text-gray-300 mx-auto mb-6" />
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                장바구니가 비어있습니다
              </h2>
              <p className="text-gray-600 mb-8">
                마음에 드는 상품을 담아보세요
              </p>
              <Link href="/products">
                <Button className="bg-black text-white hover:bg-gray-800">
                  상품 둘러보기
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* 장바구니 아이템 목록 */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">
                      상품 목록
                    </h2>
                  </div>
                  
                  <div className="divide-y divide-gray-100">
                    {cartItems.map((item) => (
                      <div key={item.id} className="p-6">
                        <div className="flex items-start space-x-4">
                          {/* 상품 이미지 */}
                          <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-xl overflow-hidden">
                            <img
                              src={item.productImage}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget
                                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjlGQUZCIi8+CjxwYXRoIGQ9Ik00MCAyNkM0My4zMTM3IDI2IDQ2IDI4LjY4NjMgNDYgMzJDNDYgMzUuMzEzNyA0My4zMTM3IDM4IDQwIDM4QzM2LjY4NjMgMzggMzQgMzUuMzEzNyAzNCAzMkMzNCAyOC42ODYzIDM2LjY4NjMgMjYgNDAgMjZaIiBmaWxsPSIjRDFENURCIi8+CjxwYXRoIGQ9Ik0yOCA0NEg1MkM1My4xMDQ2IDQ0IDU0IDQ0Ljg5NTQgNTQgNDZWNTRDNTQgNTUuMTA0NiA1My4xMDQ2IDU2IDUyIDU2SDI4QzI2Ljg5NTQgNTYgMjYgNTUuMTA0NiAyNiA1NFY0NkMyNiA0NC44OTU0IDI2Ljg5NTQgNDQgMjggNDRaIiBmaWxsPSIjRDFENURCIi8+Cjwvc3ZnPgo='
                              }}
                            />
                          </div>

                          {/* 상품 정보 */}
                          <div className="flex-1 min-w-0">
                            <Link 
                              href={`/products/${item.productId}`}
                              className="block"
                            >
                              <h3 className="text-lg font-medium text-gray-900 hover:text-black transition-colors line-clamp-2">
                                {item.productName}
                              </h3>
                            </Link>
                            
                            {(item.color || item.size) && (
                              <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                                {item.color && <span>색상: {item.color}</span>}
                                {item.size && <span>사이즈: {item.size}</span>}
                              </div>
                            )}
                            
                            <div className="flex items-center justify-between mt-4">
                              {/* 수량 조절 */}
                              <div className="flex items-center border border-gray-200 rounded-lg">
                                <button
                                  onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="px-4 py-2 text-center min-w-[3rem] font-medium">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>

                              {/* 가격 및 삭제 */}
                              <div className="flex items-center space-x-4">
                                <div className="text-right">
                                  <div className="text-lg font-semibold text-gray-900">
                                    {formatCurrency(item.totalPrice)}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    개당 {formatCurrency(item.unitPrice)}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 주문 요약 */}
              <div className="lg:col-span-1">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">
                    주문 요약
                  </h2>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between text-gray-600">
                      <span>상품 금액</span>
                      <span>{formatCurrency(cartSummary.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>배송비</span>
                      <span>₩3,000</span>
                    </div>
                    {cartSummary.discountAmount > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>할인</span>
                        <span>-{formatCurrency(cartSummary.discountAmount)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex justify-between text-lg font-semibold text-gray-900">
                        <span>총 결제 금액</span>
                        <span className="text-blue-600">
                          {formatCurrency(cartSummary.finalAmount + 3000)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 주문 버튼 */}
                  <Button
                    onClick={handleCheckout}
                    className="w-full h-12 bg-black text-white hover:bg-gray-800 rounded-xl text-lg font-semibold"
                  >
                    주문하기
                  </Button>
                  
                  <div className="mt-4 text-center">
                    <Link 
                      href="/products"
                      className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      쇼핑 계속하기
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  )
} 