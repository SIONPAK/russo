'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, Package, ArrowRight, Download, Home } from 'lucide-react'
import { MainLayout } from '@/widgets/layout/main-layout'
import { Button } from '@/shared/ui/button'
import { useCart } from '@/features/cart/model/use-cart'
import Link from 'next/link'
import { generateReceipt, formatDate, ReceiptData } from '@/shared/lib/receipt-utils'
import { showSuccess, showError } from '@/shared/lib/toast'
import { useAuthStore } from '@/entities/auth/model/auth-store'

export function OrderCompletePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { clearCart } = useCart()
  const { user } = useAuthStore()
  const [mounted, setMounted] = useState(false)
  const [orderData, setOrderData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const orderNumber = searchParams?.get('orderNumber')

  useEffect(() => {
    setMounted(true)
    // 주문 완료 후 장바구니 비우기
    clearCart()
    if (orderNumber) {
      // 주문 정보 가져오기
      fetchOrderData(orderNumber)
    }
  }, [clearCart, orderNumber])

  const fetchOrderData = async (orderNumber: string) => {
    try {
      const response = await fetch(`/api/orders?orderNumber=${orderNumber}`)
      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          setOrderData(result.data)
        }
      }
    } catch (error) {
      console.error('주문 정보 조회 실패:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownloadReceipt = async () => {
    if (!orderData) return

    try {
      const receiptData: ReceiptData = {
        orderNumber: orderData.order_number,
        orderDate: formatDate(new Date(orderData.created_at)),
        customerName: (user as any)?.company_name || orderData.shipping_name,
        customerPhone: orderData.shipping_phone,
        shippingName: orderData.shipping_name,
        shippingPhone: orderData.shipping_phone,
        shippingAddress: orderData.shipping_address,
        shippingPostalCode: orderData.shipping_postal_code,
        items: orderData.order_items?.map((item: any) => ({
          productName: item.product_name,
          productCode: item.product_code || item.product_id,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
          options: item.options
        })) || [],
        subtotal: orderData.total_amount - orderData.shipping_fee,
        shippingFee: orderData.shipping_fee,
        totalAmount: orderData.total_amount,
        notes: orderData.notes
      }

      const success = await generateReceipt(receiptData)
      if (success) {
        showSuccess('영수증이 다운로드되었습니다.')
      } else {
        showError('영수증 다운로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('영수증 다운로드 실패:', error)
      showError('영수증 다운로드에 실패했습니다.')
    }
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

  if (!orderNumber) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              잘못된 접근입니다
            </h1>
            <Button onClick={() => router.push('/')}>
              홈으로 돌아가기
            </Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* 성공 아이콘 및 메시지 */}
            <div className="text-center py-12 px-6">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                주문이 완료되었습니다!
              </h1>
              
              <p className="text-gray-600 mb-8">
                주문해 주셔서 감사합니다. 주문 확인 후 빠르게 처리해드리겠습니다.
              </p>

              {/* 주문번호 */}
              <div className="bg-gray-50 rounded-lg p-6 mb-8">
                <div className="text-sm text-gray-600 mb-1">주문번호</div>
                <div className="text-xl font-mono font-semibold text-gray-900">
                  {orderNumber}
                </div>
              </div>

              {/* 안내 메시지 */}
              <div className="bg-blue-50 rounded-lg p-6 mb-8 text-left">
                <div className="flex items-start space-x-3">
                  <Package className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-2">주문 처리 안내</p>
                    <ul className="space-y-1 text-blue-700">
                      <li>• 주문 확인 후 1-2일 내에 상품을 준비합니다.</li>
                      <li>• 배송은 주문 확인 후 2-3일 소요됩니다.</li>
                      <li>• 배송 시작 시 문자로 송장번호를 안내드립니다.</li>
                      <li>• 주문 관련 문의는 고객센터로 연락해 주세요.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 액션 버튼들 */}
              <div className="space-y-4">
                <button
                  onClick={handleDownloadReceipt}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  <Download className="h-5 w-5 mr-2" />
                  영수증 다운로드
                </button>
                
                <div className="flex space-x-4">
                  <Link href="/mypage/orders">
                    <Button className="w-full bg-black text-white hover:bg-gray-800 h-12 text-lg font-semibold">
                      주문 내역 확인하기
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/products" className="flex-1">
                    <Button variant="outline" className="w-full h-12">
                      쇼핑 계속하기
                    </Button>
                  </Link>
                  <Link href="/" className="flex-1">
                    <Button variant="outline" className="w-full h-12">
                      홈으로 가기
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* 고객센터 정보 */}
            <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
              <div className="text-center text-sm text-gray-600">
                <p className="mb-1">주문 관련 문의</p>
                <p className="font-medium text-gray-900">
                  고객센터: 1588-0000 (평일 09:00-18:00)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
} 