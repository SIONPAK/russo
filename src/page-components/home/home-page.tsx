'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { useProducts } from '@/features/product/model/use-products'
import { useCategoryMenu } from '@/features/category-menu/model/use-category-menu'
import { useCart } from '@/features/cart/model/use-cart'
import { MainLayout } from '@/widgets/layout/main-layout'


export function HomePage() {

  const searchParams = useSearchParams()
  const { products, loading: productsLoading, error: productsError } = useProducts()
  

  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const categoryFromUrl = searchParams.get('category')
    if (categoryFromUrl) {
      setSelectedCategory(categoryFromUrl)
    }
  }, [searchParams])


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