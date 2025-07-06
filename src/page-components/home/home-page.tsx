'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { useProducts } from '@/features/product/model/use-products'
import { useCategoryMenu } from '@/features/category-menu/model/use-category-menu'
import { useCart } from '@/features/cart/model/use-cart'
import { MainLayout } from '@/widgets/layout/main-layout'

interface PopularProduct {
  id: string
  name: string
  code: string
  price: number
  total_ordered: number
  images?: Array<{
    image_url: string
    is_main: boolean
  }>
}

export function HomePage() {
  const searchParams = useSearchParams()
  const { products, loading: productsLoading, error: productsError } = useProducts()
  const [popularProducts, setPopularProducts] = useState<PopularProduct[]>([])
  const [popularLoading, setPopularLoading] = useState(true)
  const [showAllProducts, setShowAllProducts] = useState(false)
  
  // 비디오 슬라이드 관련 상태
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  
  const videos = [
    '/video/0704_01.mp4',
    '/video/0704_02.mp4',
    '/video/0704_03.mp4'
  ]

  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const categoryFromUrl = searchParams.get('category')
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl)
    }
  }, [searchParams])

  // 인기 상품 데이터 가져오기
  useEffect(() => {
    fetchPopularProducts()
  }, [])

  const fetchPopularProducts = async () => {
    try {
      setPopularLoading(true)
      // 전체 상품을 가져와서 클라이언트에서 정렬
      const response = await fetch('/api/products?limit=100')
      const result = await response.json()
      
      if (result.success) {
        setPopularProducts(result.data || [])
      } else {
        console.error('상품 조회 실패:', result.error)
      }
    } catch (error) {
      console.error('상품 데이터 가져오기 실패:', error)
    } finally {
      setPopularLoading(false)
    }
  }

  // 비디오가 끝났을 때 다음 비디오로 이동
  const handleVideoEnded = () => {
    setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % videos.length)
  }

  // 비디오 인덱스가 변경될 때 새 비디오 로드
  useEffect(() => {
    if (videoRef.current) {
      const video = videoRef.current
      
      // 비디오 로딩 이벤트 리스너
      const handleCanPlay = () => {
        video.play().catch(console.error)
      }
      
      // 로딩 상태 관리
      const handleLoadStart = () => {
        video.style.opacity = '0.5'
      }
      
      const handleLoadedData = () => {
        video.style.opacity = '1'
      }
      
      video.addEventListener('canplay', handleCanPlay)
      video.addEventListener('loadstart', handleLoadStart)
      video.addEventListener('loadeddata', handleLoadedData)
      
      video.load()
      
      // 클린업
      return () => {
        video.removeEventListener('canplay', handleCanPlay)
        video.removeEventListener('loadstart', handleLoadStart)
        video.removeEventListener('loadeddata', handleLoadedData)
      }
    }
  }, [currentVideoIndex])

  return (
    <MainLayout>
      {/* 메인 이미지 섹션 */}
      {/* <section className="relative h-96 bg-gray-900 flex items-center justify-center">
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
        <div className="relative z-10 text-center text-white">
          <h1 className="text-4xl font-paperlogy-extrabold mb-4">LUSSO</h1>
          <p className="text-xl font-paperlogy-medium">Premium Fashion Collection</p>
        </div>
      </section> */}
      
      {/* 회사 소개 섹션 */}
      <section className="bg-black text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <h2 className="text-3xl font-paperlogy-bold mb-8 text-white">회사 소개</h2>
            <div className="max-w-3xl mx-auto space-y-6 text-gray-300 leading-relaxed">
              <p className="text-lg font-paperlogy-medium">안녕하세요. (주) 루소입니다.</p>
              <p className="font-paperlogy-regular">저희는 베트남, 중국, 인도네시아, 방글라데시 등<br />
              현지 대량 생산 기반으로<br />
              시장 최저가 납품을 원칙으로 운영하고 있습니다.</p>
              <p className="font-paperlogy-regular">퀄리티와 가격 경쟁력을 동시에 갖춘 제품만<br />
              안정적으로 공급해드리겠습니다.</p>
              <div className="text-2xl font-paperlogy-extrabold text-white mt-8">
                "미송없는 도매처"<br />
                루소가 앞장서서 만들어가겠습니다.
              </div>
              <p className="text-xl font-paperlogy-semibold mt-6">거래처 대표님들<br />
              많은 관심 부탁드립니다.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 상품 섬네일 섹션 */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-paperlogy-bold mb-4 text-black">Products</h2>
            
          </div>
          
          {/* 상품 그리드 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {popularProducts && popularProducts.length > 0 ? (
              (showAllProducts ? popularProducts : popularProducts.slice(0, 6)).map((product, index) => (
                <div key={product.id} className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow cursor-pointer group">
                  <div className="aspect-square bg-gray-100 overflow-hidden">
                    {product.images && product.images.length > 0 ? (
                      <img
                        src={product.images[0].image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          const target = e.currentTarget
                          target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0xMDAgNjVDMTA4LjI4NCA2NSAxMTUgNzEuNzE2IDExNSA4MEMxMTUgODguMjg0IDEwOC4yODQgOTUgMTAwIDk1QzkxLjcxNiA5NSA4NSA4OC4yODQgODUgODBDODUgNzEuNzE2IDkxLjcxNiA2NSAxMDAgNjVaIiBmaWxsPSIjOUNBM0FGIi8+CjxwYXRoIGQ9Ik03MCA5MEgxMzBDMTMyLjc2MSA5MCAxMzUgOTIuMjM4NiAxMzUgOTVWMTM1QzEzNSAxMzcuNzYxIDEzMi43NjEgMTQwIDEzMCAxNDBINzBDNjcuMjM4NiAxNDAgNjUgMTM3Ljc2MSA2NSAxMzVWOTVDNjUgOTIuMjM4NiA2Ny4yMzg2IDkwIDcwIDkwWiIgZmlsbD0iIzlDQTNBRiIvPgo8L3N2Zz4K'
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  {/* 상품 정보 제거 - 이미지만 표시 */}
                </div>
              ))
            ) : (
              // 로딩 중이거나 상품이 없을 때 플레이스홀더
              Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="bg-white rounded-lg overflow-hidden shadow-md">
                  <div className="aspect-square bg-gray-200 animate-pulse"></div>
                  {/* 플레이스홀더도 이미지만 표시 */}
                </div>
              ))
            )}
          </div>
          
          {/* 더보기/접기 버튼 */}
          {popularProducts && popularProducts.length > 6 && (
            <div className="text-center mt-8">
              <button
                onClick={() => setShowAllProducts(!showAllProducts)}
                className="bg-black text-white px-8 py-3 rounded-lg hover:bg-gray-800 transition-colors font-paperlogy-medium"
              >
                {showAllProducts ? '접기' : `더보기 (+${popularProducts.length - 6}개)`}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* 비디오 슬라이드 섹션 */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <h2 className="text-3xl font-paperlogy-bold mb-8 text-black">주식회사 루소</h2>
            <div className="max-w-4xl mx-auto">
              <div className="bg-black rounded-lg overflow-hidden shadow-lg">
                <video
                  ref={videoRef}
                  className="w-full h-auto"
                  autoPlay
                  muted
                  playsInline
                  onEnded={handleVideoEnded}
                  style={{ maxHeight: '500px' }}
                >
                  <source src={videos[currentVideoIndex]} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                
                {/* 비디오 인디케이터 */}
                <div className="flex justify-center space-x-2 py-4 bg-black">
                  {videos.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentVideoIndex(index)}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        index === currentVideoIndex ? 'bg-white' : 'bg-gray-500'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 주문 & 픽업 안내 섹션 */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <h2 className="text-3xl font-paperlogy-bold mb-8 text-black">주문 & 픽업 안내</h2>
            <div className="max-w-3xl mx-auto bg-gray-50 p-8 rounded-lg">
              <div className="space-y-4 text-gray-700">
                <p className="text-xl font-paperlogy-bold text-black">주문 전용 카카오톡: 010-2131-7540</p>
                <p className="text-lg font-paperlogy-medium">월~금 15:00 이전 주문 시, 당일 출고</p>
                <p className="text-lg font-paperlogy-medium">택배비 3,000원 / 20장 이상 무료배송</p>
                <p className="text-lg font-paperlogy-regular">낱장 거래 가능<br />
                (초기 쇼핑몰 대표님들도 편하게 연락주세요.)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 입금 안내 섹션 */}
      <section className="bg-black text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <h2 className="text-3xl font-paperlogy-bold mb-8 text-white">입금 안내</h2>
            <div className="max-w-3xl mx-auto space-y-6 text-gray-300">
              <p className="text-xl font-paperlogy-bold text-white">"업체 간 거래는 곧 신뢰입니다."</p>
              <p className="text-lg font-paperlogy-medium">입금 지연 시 거래가 제한될 수 있습니다.</p>
              <p className="text-lg font-paperlogy-medium">루소는 납기 지연 없는 '책임 납품'을 약속드립니다.</p>
              <p className="text-lg font-paperlogy-regular">명세서 확인 후, 정확한 금액 입금 부탁드립니다.</p>
              <p className="text-lg font-paperlogy-regular"><strong className='text-red-500'>협의되지 않은 차액 입금 시,
                <br />
              환불은 불가하며 전액 매입 처리됩니다.
                </strong>
                
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 불량/교환/반품 안내 섹션 */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <h2 className="text-3xl font-paperlogy-bold mb-8 text-black">불량 / 교환 / 반품 안내</h2>
            <div className="max-w-3xl mx-auto bg-gray-50 p-8 rounded-lg">
              <div className="space-y-4 text-gray-700">
                <p className="text-lg font-paperlogy-medium">단순 변심 및 시즌 매입 반품 불가</p>
                <p className="text-lg font-paperlogy-medium">사전 협의 없는 반품건은 즉시 반송 처리됩니다</p>
                <p className="text-lg font-paperlogy-regular">오배송 / 불량 제품은 제품 수령 후 확인<br />
                → 교환/매입 처리 가능</p>
                <p className="text-lg font-paperlogy-regular">단, 택배비는 거래처 부담<br />
                (도매 특성상 양해 부탁드립니다)</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 계산서 안내 섹션 */}
      <section className="bg-black text-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <h2 className="text-3xl font-paperlogy-bold mb-8 text-white">계산서 안내</h2>
            <div className="max-w-3xl mx-auto space-y-6 text-gray-300">
              <p className="text-lg font-paperlogy-medium">100% 세금계산서 발행</p>
              <p className="text-lg font-paperlogy-medium">부가세 포함 명세서 제공</p>
              <p className="text-lg font-paperlogy-medium">매월 10일 전까지 계산서 발행됩니다.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 이미지 사용 안내 섹션 */}
      <section className="bg-white py-16">
        <picture className="block w-full max-w-3xl mx-auto rounded-lg">
          
          <img 
                  src="/images/dont_use_image.png" 
                  alt="이미지 사용 안내" 
                  className="block w-full max-w-2xl mx-auto rounded-lg"
                />
                </picture>
      </section>
    </MainLayout>
  )
} 