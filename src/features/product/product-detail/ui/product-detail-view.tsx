'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, ShoppingCart, Minus, Plus } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { useCart } from '@/features/cart/model/use-cart'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { formatCurrency } from '@/shared/lib/utils'
import { showSuccess, showInfo } from '@/shared/lib/toast'

interface ProductDetailViewProps {
  product: any
}

export function ProductDetailView({ product }: ProductDetailViewProps) {
  const router = useRouter()
  const { addToCart } = useCart()
  const { isAuthenticated } = useAuthStore()
  
  const [selectedOptions, setSelectedOptions] = useState({
    color: '',
    size: ''
  })
  const [quantity, setQuantity] = useState(1)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // 모든 이미지 배열 (메인 이미지 + 추가 이미지들)
  const allImages = product.images || []

  useEffect(() => {
    if (!isAuthenticated) {
      showInfo('로그인이 필요한 서비스입니다.')
      router.push('/auth/login')
    }
  }, [isAuthenticated, router])

  // 재고 확인
  const getAvailableStock = () => {
    if (!product.inventory_options || !Array.isArray(product.inventory_options)) {
      return product.stock_quantity || 0
    }

    if (!selectedOptions.color || !selectedOptions.size) {
      return 0
    }

    const matchingOption = product.inventory_options.find(
      (opt: any) => opt.color === selectedOptions.color && opt.size === selectedOptions.size
    )

    return matchingOption ? matchingOption.stock_quantity || 0 : 0
  }

  const availableStock = getAvailableStock()

  const handleOptionChange = (type: 'color' | 'size', value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [type]: value
    }))
    // 옵션 변경 시 수량 초기화
    setQuantity(1)
  }

  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta
    if (newQuantity >= 1 && newQuantity <= availableStock) {
      setQuantity(newQuantity)
    }
  }

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      showInfo('로그인이 필요합니다.')
      router.push('/auth/login')
      return
    }

    if (product.inventory_options && (!selectedOptions.color || !selectedOptions.size)) {
      showInfo('색상과 사이즈를 선택해주세요.')
      return
    }

    if (availableStock < quantity) {
      showInfo('재고가 부족합니다.')
      return
    }

    try {
      const unitPrice = product.is_on_sale && product.sale_price ? product.sale_price : product.price
      
      addToCart({
        productId: product.id,
        productName: product.name,
        productImage: allImages[0]?.image_url || '',
        unitPrice,
        quantity,
        color: selectedOptions.color,
        size: selectedOptions.size,
      })
      
      showSuccess(`${product.name}이(가) 장바구니에 추가되었습니다.`)
    } catch (error) {
      showInfo('장바구니 추가 중 오류가 발생했습니다.')
    }
  }

  const handleDirectOrder = () => {
    if (!isAuthenticated) {
      showInfo('로그인이 필요합니다.')
      router.push('/auth/login')
      return
    }

    if (product.inventory_options && (!selectedOptions.color || !selectedOptions.size)) {
      showInfo('색상과 사이즈를 선택해주세요.')
      return
    }

    if (availableStock < quantity) {
      showInfo('재고가 부족합니다.')
      return
    }

    // 상품 정보를 URL 파라미터로 전달
    const orderItems = [{
      id: product.id,
      name: product.name,
      code: product.code || '',
      price: product.is_on_sale && product.sale_price ? product.sale_price : product.price,
      quantity,
      color: selectedOptions.color,
      size: selectedOptions.size,
      options: {
        color: selectedOptions.color,
        size: selectedOptions.size
      }
    }]

    const encodedItems = encodeURIComponent(JSON.stringify(orderItems))
    router.push(`/order?items=${encodedItems}`)
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-8"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          뒤로가기
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 상품 이미지 */}
          <div className="space-y-4">
            <div className="aspect-square bg-white rounded-lg overflow-hidden border border-gray-200 shadow-sm">
              {allImages.length > 0 ? (
                <img
                  src={allImages[selectedImageIndex]?.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <Package className="h-16 w-16" />
                </div>
              )}
            </div>
            
            {/* 썸네일 이미지들 */}
            {allImages.length > 1 && (
              <div className="flex space-x-2 overflow-x-auto">
                {allImages.map((image: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${
                      selectedImageIndex === index ? 'border-black' : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={image.image_url}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 상품 정보 */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
              {/* 가격 표시 - 로그인한 회원에게만 */}
              <div className="mt-4">
                {isAuthenticated ? (
                  <div className="flex items-baseline space-x-3">
                    {product.is_on_sale && product.sale_price ? (
                      <>
                        <span className="text-3xl font-bold text-gray-900">
                          {formatCurrency(product.sale_price)}
                        </span>
                        <span className="text-xl text-gray-500 line-through">
                          {formatCurrency(product.price)}
                        </span>
                        <span className="text-sm bg-red-500 text-white px-2 py-1 rounded-full">
                          SALE
                        </span>
                      </>
                    ) : (
                      <span className="text-3xl font-bold text-gray-900">
                        {formatCurrency(product.price)}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-lg text-gray-500">
                    로그인 후 가격 확인
                  </div>
                )}
              </div>
            </div>

            {/* 옵션 선택 */}
            {product.inventory_options && Array.isArray(product.inventory_options) && (
              <div className="space-y-4">
                {/* 색상 선택 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">색상</h3>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(product.inventory_options.map((opt: any) => opt.color))].map((color) => (
                      <button
                        key={color as string}
                        onClick={() => {
                          // 색상 변경 시 사이즈 초기화
                          setSelectedOptions(prev => ({
                            ...prev,
                            color: color as string,
                            size: ''
                          }))
                          // 옵션 변경 시 수량도 초기화
                          setQuantity(1)
                        }}
                        className={`px-4 py-2 rounded-lg border ${
                          selectedOptions.color === color
                            ? 'border-black bg-black text-white'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {color as string}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 사이즈 선택 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">사이즈</h3>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(
                      product.inventory_options
                        .filter((opt: any) => selectedOptions.color ? opt.color === selectedOptions.color : true)
                        .map((opt: any) => opt.size)
                    )].map((size) => (
                      <button
                        key={size as string}
                        onClick={() => handleOptionChange('size', size as string)}
                        disabled={!selectedOptions.color}
                        className={`px-4 py-2 rounded-lg border ${
                          selectedOptions.size === size
                            ? 'border-black bg-black text-white'
                            : !selectedOptions.color
                            ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {size as string}
                      </button>
                    ))}
                  </div>
                  {!selectedOptions.color && (
                    <p className="text-sm text-gray-500 mt-2">색상을 먼저 선택해주세요.</p>
                  )}
                </div>
              </div>
            )}

            {/* 수량 선택 */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">수량</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1}
                  className="p-2 rounded-lg border border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="px-4 py-2 border border-gray-300 rounded-lg text-center min-w-[60px]">
                  {quantity}
                </span>
                <button
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= availableStock}
                  className="p-2 rounded-lg border border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 구매 버튼들 */}
            <div className="space-y-3">
              <div className="flex space-x-3">
                <Button
                  onClick={handleAddToCart}
                  variant="outline"
                  className="flex-1 h-12 text-lg"
                  disabled={availableStock < quantity}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  장바구니
                </Button>
                <Button
                  onClick={handleDirectOrder}
                  className="flex-1 h-12 bg-black text-white hover:bg-gray-800 text-lg font-semibold"
                  disabled={availableStock < quantity}
                >
                  바로 주문
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* 상품 상세 설명 섹션 */}
        {(product.description || product.detailed_description) && (
          <div className="mt-16 border-t border-gray-200 pt-16">
            <div className="">
              <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">상품 상세정보</h2>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                {product.detailed_description ? (
                  <div 
                    className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: product.detailed_description }}
                  />
                ) : (
                  <div className="text-gray-700 leading-relaxed text-lg whitespace-pre-wrap">
                    {product.description}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 