'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { formatCurrency } from '@/shared/lib/utils'
import { showInfo } from '@/shared/lib/toast'

interface ProductDetailViewProps {
  product: any
}

export function ProductDetailView({ product }: ProductDetailViewProps) {
  const router = useRouter()
  const { isAuthenticated, userType } = useAuthStore()
  
  const [selectedOptions, setSelectedOptions] = useState({
    color: '',
    size: ''
  })
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  // 모든 이미지 배열 (메인 이미지 + 추가 이미지들)
  const allImages = product.images || []

  // HTML 내용 처리 함수
  const processHtmlContent = (htmlContent: string) => {
    if (!htmlContent) return ''
    
    // 상대 경로 이미지를 절대 경로로 변환
    let processedHtml = htmlContent.replace(
      /src="(?!https?:\/\/)([^"]*?)"/g,
      'src="https://xcelsthkvtihudxvkzgz.supabase.co/storage/v1/object/public/product-images/$1"'
    )

    // 이미지 스타일 개선
    processedHtml = processedHtml.replace(
      /<img([^>]*?)>/g,
      '<img$1 style="max-width: 100%; height: auto; margin: 20px auto; display: block; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">'
    )

    // 텍스트 정렬 스타일 개선
    processedHtml = processedHtml.replace(
      /style="text-align:\s*center;"/g,
      'style="text-align: center; margin: 20px 0;"'
    )

    return processedHtml
  }

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

            {/* 옵션 표시 (선택 불가능) */}
            {product.inventory_options && Array.isArray(product.inventory_options) && (
              <div className="space-y-4">
                {/* 색상 표시 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">색상</h3>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(product.inventory_options.map((opt: any) => opt.color))].map((color) => (
                      <div
                        key={color as string}
                        className="px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-700"
                      >
                        {color as string}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 사이즈 표시 */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">사이즈</h3>
                  <div className="flex flex-wrap gap-2">
                    {[...new Set(product.inventory_options.map((opt: any) => opt.size))].map((size) => {
                      // 해당 사이즈의 추가 가격 찾기
                      const optionWithSize = product.inventory_options.find((opt: any) => opt.size === size)
                      const additionalPrice = optionWithSize?.additional_price || 0
                      
                      return (
                        <div
                          key={size as string}
                          className="px-4 py-2 rounded-lg border border-gray-300 bg-gray-50 text-gray-700"
                        >
                          <div className="flex flex-col items-center">
                            <span>{size as string}</span>
                            {additionalPrice > 0 && (
                              <span className="text-xs text-red-600 font-medium">
                                +{additionalPrice.toLocaleString()}원
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 재고 정보 - 관리자만 표시 */}
            {userType === 'admin' && (
              <div className="text-sm text-gray-600">
                재고: {product.stock_quantity || 0}개
              </div>
            )}

            {/* 발주 안내 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">발주 안내</h3>
              <p className="text-sm text-blue-800">
                상품 발주는 <strong>발주관리</strong> 페이지에서 진행해주세요.
              </p>
              <Button
                onClick={() => {
                  showInfo(`${product.name} 상품을 발주서에 추가합니다.`)
                  router.push(`/order-management?product=${product.id}`)
                }}
                className="mt-3 bg-blue-600 hover:bg-blue-700 text-white"
              >
                발주관리 페이지로 이동
              </Button>
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
                    className="prose prose-lg max-w-none text-gray-700 leading-relaxed [&_img]:max-w-full [&_img]:h-auto [&_img]:mx-auto [&_img]:my-5 [&_img]:rounded-lg [&_img]:shadow-md [&_p]:text-center [&_p]:my-4"
                    dangerouslySetInnerHTML={{ __html: processHtmlContent(product.detailed_description) }}
                  />
                ) : (
                  <div 
                    className="text-gray-700 leading-relaxed text-lg whitespace-pre-wrap [&_img]:max-w-full [&_img]:h-auto [&_img]:mx-auto [&_img]:my-5 [&_img]:rounded-lg [&_img]:shadow-md"
                    dangerouslySetInnerHTML={{ __html: processHtmlContent(product.description) }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 