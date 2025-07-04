'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '@/widgets/layout/main-layout'
import { ProductDetailView } from '@/features/product/product-detail/ui/product-detail-view'
import { useProductDetail } from '@/features/product/product-detail/model/use-product-detail'
import { useAuthStore } from '@/entities/auth/model/auth-store'

interface ProductDetailPageProps {
  productId: string
}

export function ProductDetailPage({ productId }: ProductDetailPageProps) {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const { product, loading, error } = useProductDetail(productId)

  useEffect(() => {
    console.log('Product Detail - Auth State:', { user, isAuthenticated })
    
    if (!isAuthenticated || !user) {
      console.log('Product Detail - Not authenticated, redirecting to login')
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
            <p className="text-gray-600 mb-4">상품 상세정보를 보시려면 로그인해주세요.</p>
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

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
            <p className="mt-4 text-gray-600">상품 정보를 불러오는 중...</p>
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
            <p className="text-gray-600 mb-4">{error}</p>
            <button 
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              뒤로 가기
            </button>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!product) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">상품을 찾을 수 없습니다</h2>
            <p className="text-gray-600 mb-4">요청하신 상품이 존재하지 않거나 삭제되었습니다.</p>
            <button 
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
            >
              뒤로 가기
            </button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <ProductDetailView product={product} />
    </MainLayout>
  )
} 