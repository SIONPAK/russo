'use client'

import { useState } from 'react'
import { Product } from '@/shared/types'
import { Button } from '@/shared/ui/button'
import { 
  X, 
  Package, 
  Star, 
  TrendingUp, 
  Calendar,
  DollarSign,
  Tag,
  Palette,
  Ruler,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Edit
} from 'lucide-react'

interface ProductDetailModalProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (product: Product) => void
}

export function ProductDetailModal({
  product,
  isOpen,
  onClose,
  onEdit
}: ProductDetailModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  if (!isOpen || !product) return null

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

  const getMainImage = () => {
    const mainImage = product.images?.find(img => img.is_main)
    return mainImage?.image_url || product.images?.[0]?.image_url || '/placeholder-product.jpg'
  }

  const getAllImages = () => {
    return product.images?.map(img => img.image_url) || ['/placeholder-product.jpg']
  }

  const getStockStatus = () => {
    if (product.stock_quantity === 0) return { text: '품절', color: 'text-red-600 bg-red-50' }
    if (product.stock_quantity < 10) return { text: '부족', color: 'text-yellow-600 bg-yellow-50' }
    return { text: '충분', color: 'text-green-600 bg-green-50' }
  }

  const images = getAllImages()
  const stockStatus = getStockStatus()

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />
        
        <div className="inline-block w-full max-w-7xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-xl">
          {/* 모달 헤더 */}
          <div className="flex items-center justify-between p-8 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-6">
              <h2 className="text-3xl font-bold text-gray-900">상품 상세 정보</h2>
              <div className="flex items-center space-x-3">
                {product.is_featured && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    <Star className="w-4 h-4 mr-1.5" />
                    인기상품
                  </span>
                )}
                {product.is_on_sale && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    <TrendingUp className="w-4 h-4 mr-1.5" />
                    세일중
                  </span>
                )}
                <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${stockStatus.color}`}>
                  <Package className="w-4 h-4 mr-1.5" />
                  {stockStatus.text}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {onEdit && (
                <Button
                  onClick={() => onEdit(product)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
                >
                  <Edit className="w-5 h-5 mr-2" />
                  수정
                </Button>
              )}
              <Button
                onClick={onClose}
                variant="outline"
                className="p-3 rounded-lg border-gray-300"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>

          {/* 모달 내용 */}
          <div className="p-8">
            <div className="grid grid-cols-2 gap-12">
              {/* 이미지 갤러리 */}
              <div className="space-y-6">
                <div className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                  <img
                    src={images[currentImageIndex]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget
                      target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTMwQzIxNi41NjkgMTMwIDIzMCAxNDMuNDMxIDIzMCAxNjBDMjMwIDE3Ni41NjkgMjE2LjU2OSAxOTAgMjAwIDE5MEMxODMuNDMxIDE5MCAxNzAgMTc2LjU2OSAxNzAgMTYwQzE3MCAxNDMuNDMxIDE4My40MzEgMTMwIDIwMCAxMzBaIiBmaWxsPSIjOUNBM0FGIi8+CjxwYXRoIGQ9Ik0xNDAgMjIwSDI2MEM0NzEuMDQ2IDIyMCAyNzAgMjI0Ljg5NTQgMjcwIDIzMFYyNzBDMjcwIDI3NS4xMDQ2IDI2NS4xMDQ2IDI4MCAyNjAgMjgwSDE0MEMxMzQuODk1NCAyODAgMTMwIDI3NS4xMDQ2IDEzMCAyNzBWMjMwQzEzMCAyMjQuODk1NCAxMzQuODk1NCAyMjAgMTQwIDIyMFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+Cg=='
                      target.classList.add('opacity-50')
                    }}
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-60 text-white p-3 rounded-full hover:bg-opacity-80 transition-opacity"
                      >
                        <ChevronLeft className="w-6 h-6" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-60 text-white p-3 rounded-full hover:bg-opacity-80 transition-opacity"
                      >
                        <ChevronRight className="w-6 h-6" />
                      </button>
                      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full text-sm font-medium">
                        {currentImageIndex + 1} / {images.length}
                      </div>
                    </>
                  )}
                </div>
                
                {/* 썸네일 이미지들 */}
                {images.length > 1 && (
                  <div className="grid grid-cols-6 gap-3">
                    {images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 transition-colors ${
                          index === currentImageIndex ? 'border-blue-500' : 'border-gray-200'
                        }`}
                      >
                        <img
                          src={image}
                          alt={`${product.name} ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget
                            target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik00MCAyNkM0My4zMTM3IDI2IDQ2IDI4LjY4NjMgNDYgMzJDNDYgMzUuMzEzNyA0My4zMTM3IDM4IDQwIDM4QzM2LjY4NjMgMzggMzQgMzUuMzEzNyAzNCAzMkMzNCAyOC42ODYzIDM2LjY4NjMgMjYgNDAgMjZaIiBmaWxsPSIjOUNBM0FGIi8+CjxwYXRoIGQ9Ik0yOCA0NEg1MkM1My4xMDQ2IDQ0IDU0IDQ0Ljg5NTQgNTQgNDZWNTRDNTQgNTUuMTA0NiA1My4xMDQ2IDU2IDUyIDU2SDI4QzI2Ljg5NTQgNTYgMjYgNTUuMTA0NiAyNiA1NFY0NkMyNiA0NC44OTU0IDI2Ljg5NTQgNDQgMjggNDRaIiBmaWxsPSIjOUNBM0FGIi8+Cjwvc3ZnPgo='
                            target.classList.add('opacity-50')
                          }}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 상품 정보 */}
              <div className="space-y-8">
                {/* 기본 정보 */}
                <div>
                  <h1 className="text-4xl font-bold text-gray-900 mb-3">{product.name}</h1>
                  <p className="text-xl text-gray-600 mb-6">상품코드: {product.code}</p>
                  
                  <div className="flex items-center space-x-6 mb-8">
                    <div className="flex items-center space-x-3">
                      <Tag className="w-6 h-6 text-gray-400" />
                      <span className="text-base text-gray-600">카테고리</span>
                      <span className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-base font-medium">
                        {product.category?.name || '미분류'}
                      </span>
                    </div>
                  </div>

                  {/* 가격 정보 */}
                  <div className="bg-gray-50 rounded-xl p-6 mb-8">
                    <div className="flex items-center space-x-3 mb-4">
                      <DollarSign className="w-6 h-6 text-gray-400" />
                      <span className="text-lg font-semibold text-gray-700">가격 정보</span>
                    </div>
                    <div className="space-y-3">
                      {product.is_on_sale && product.sale_price ? (
                        <>
                          <div className="flex items-center space-x-3">
                            <span className="text-3xl font-bold text-red-600">
                              {formatPrice(product.sale_price)}원
                            </span>
                            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                              세일가
                            </span>
                          </div>
                          <div className="text-xl text-gray-400 line-through">
                            정가: {formatPrice(product.price)}원
                          </div>
                        </>
                      ) : (
                        <div className="text-3xl font-bold text-gray-900">
                          {formatPrice(product.price)}원
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 재고 정보 */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <Package className="w-6 h-6 text-gray-400" />
                      <span className="text-lg font-semibold text-gray-700">재고 정보</span>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-base text-gray-600">현재 재고</span>
                        <span className={`text-2xl font-bold ${
                          product.stock_quantity === 0 ? 'text-red-600' : 
                          product.stock_quantity < 10 ? 'text-orange-600' : 'text-green-600'
                        }`}>
                          {product.stock_quantity}개
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-base text-gray-600">상태</span>
                        <span className={`px-3 py-2 rounded-lg text-sm font-medium ${stockStatus.color}`}>
                          {stockStatus.text}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 상품 설명 */}
                {product.description && (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">상품 설명</h3>
                    <div 
                      className="prose prose-base max-w-none text-gray-600 bg-white p-6 rounded-xl border border-gray-200"
                      dangerouslySetInnerHTML={{ __html: product.description }}
                    />
                  </div>
                )}

                {/* 등록 정보 */}
                <div className="border-t border-gray-200 pt-8">
                  <div className="grid grid-cols-2 gap-6 text-base">
                    <div>
                      <span className="text-gray-500">등록일</span>
                      <p className="font-semibold text-gray-900 mt-1">
                        {formatDate(product.created_at)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">수정일</span>
                      <p className="font-semibold text-gray-900 mt-1">
                        {formatDate(product.updated_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 