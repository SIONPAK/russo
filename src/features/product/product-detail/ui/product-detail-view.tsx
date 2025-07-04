'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Minus, ShoppingCart, Package } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { useCart } from '@/features/cart/model/use-cart'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { showSuccess, showError, showInfo } from '@/shared/lib/toast'
import { formatCurrency } from '@/shared/lib/utils'


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

  // 상품 이미지 처리
  const productImages = product.images || []
  const mainImage = productImages.find((img: any) => img.is_main) || productImages[0]
  const allImages = mainImage ? [mainImage, ...productImages.filter((img: any) => !img.is_main)] : productImages

  // 재고 확인
  const getAvailableStock = () => {
    if (!product.inventory_options || !Array.isArray(product.inventory_options)) {
      return product.stock_quantity || 0
    }
    
    if (!selectedOptions.color || !selectedOptions.size) {
      return 0
    }
    
    const option = product.inventory_options.find(
      (opt: any) => opt.color === selectedOptions.color && opt.size === selectedOptions.size
    )
    
    return option ? option.stock_quantity : 0
  }

  const availableStock = getAvailableStock()

  // 옵션 선택 핸들러
  const handleOptionChange = (type: 'color' | 'size', value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [type]: value
    }))
    // 옵션 변경 시 수량을 1로 초기화
    setQuantity(1)
  }

  // 수량 변경
  const handleQuantityChange = (delta: number) => {
    const newQuantity = quantity + delta
    if (newQuantity >= 1 && newQuantity <= availableStock) {
      setQuantity(newQuantity)
    }
  }

  // 장바구니 담기
  const handleAddToCart = () => {
    if (!isAuthenticated) {
      showInfo('로그인이 필요합니다.')
      router.push('/auth/login')
      return
    }

    if (product.inventory_options && (!selectedOptions.color || !selectedOptions.size)) {
      showError('옵션을 선택해주세요.')
      return
    }

    if (availableStock < quantity) {
      showError('재고가 부족합니다.')
      return
    }

    // 할인가가 있으면 할인가 사용, 없으면 정가 사용
    const unitPrice = product.is_on_sale && product.sale_price ? product.sale_price : product.price

    const cartItem = {
      productId: product.id,
      productName: product.name,
      productImage: mainImage?.image_url || '',
      color: selectedOptions.color || '기본',
      size: selectedOptions.size || '기본',
      quantity,
      unitPrice,
      options: selectedOptions
    }

    addToCart(cartItem)
    showSuccess('장바구니에 추가되었습니다.')
  }

  // 바로 주문하기
  const handleDirectOrder = (orderType: 'normal' | 'sample' = 'normal') => {
    if (!isAuthenticated) {
      showInfo('로그인이 필요합니다.')
      router.push('/auth/login')
      return
    }

    if (product.inventory_options && (!selectedOptions.color || !selectedOptions.size)) {
      showError('옵션을 선택해주세요.')
      return
    }

    if (availableStock < quantity) {
      showError('재고가 부족합니다.')
      return
    }

    // 할인가가 있으면 할인가 사용, 없으면 정가 사용
    const price = product.is_on_sale && product.sale_price ? product.sale_price : product.price

    const orderItems = [{
      id: product.id,
      name: product.name,
      code: product.code || '',
      price,
      quantity,
      color: selectedOptions.color || '기본',
      size: selectedOptions.size || '기본',
      options: selectedOptions
    }]

    // 주문 페이지로 이동하면서 상품 정보와 주문 타입 전달
    const orderData = encodeURIComponent(JSON.stringify(orderItems))
    const params = new URLSearchParams({
      items: orderData,
      orderType
    })
    
    router.push(`/order?${params.toString()}`)
  }

  // 샘플 주문하기
  const handleSampleOrder = () => {
    if (!isAuthenticated) {
      showInfo('로그인이 필요합니다.')
      router.push('/auth/login')
      return
    }

    if (product.inventory_options && (!selectedOptions.color || !selectedOptions.size)) {
      showError('옵션을 선택해주세요.')
      return
    }

    if (availableStock < quantity) {
      showError('재고가 부족합니다.')
      return
    }

    // 샘플 주문으로 주문 페이지로 이동
    handleDirectOrder('sample')
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">상품 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 뒤로가기 버튼 */}
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-black mb-6 transition-colors"
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
              <div className="mt-2">
                {product.is_on_sale && product.sale_price ? (
                  <div className="flex items-baseline space-x-3">
                    <span className="text-3xl font-bold text-red-600">
                      {formatCurrency(product.sale_price)}
                    </span>
                    <span className="text-xl text-gray-400 line-through">
                      {formatCurrency(product.price)}
                    </span>
                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-sm font-medium">
                      SALE
                    </span>
                  </div>
                ) : (
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(product.price)}
                  </p>
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
                  onClick={() => handleDirectOrder('normal')}
                  className="flex-1 h-12 bg-black text-white hover:bg-gray-800 text-lg font-semibold"
                  disabled={availableStock < quantity}
                >
                  바로 주문
                </Button>
              </div>
              
              {/* 샘플 주문 버튼 */}
              <div className="space-y-2">
                <Button
                  onClick={handleSampleOrder}
                  variant="outline"
                  className="w-full h-12 text-lg border-blue-500 text-blue-600 hover:bg-blue-50"
                  disabled={availableStock < quantity}
                >
                  <Package className="h-5 w-5 mr-2" />
                  촬영용 샘플 주문 (무료, 21일 반납)
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