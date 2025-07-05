import { useState } from 'react'
import { showSuccess, showError } from '@/shared/lib/toast'
import { supabase } from '@/shared/lib/supabase'

export interface OrderItem {
  productId: string
  productName: string
  productCode: string
  quantity: number
  unitPrice: number
  totalPrice: number
  color: string
  size: string
  options?: any
  originalPrice?: number
}

export interface ShippingInfo {
  name: string
  phone: string
  address: string
  postalCode: string
}

export interface CreateOrderData {
  userId: string
  orderType?: 'normal' | 'sample'
  sampleType?: 'photography' | 'sales'
  items: OrderItem[]
  shippingInfo: ShippingInfo
  totalAmount: number
  shippingFee: number
  notes?: string
}

export interface Order {
  id: string
  order_number: string
  user_id: string
  total_amount: number
  shipping_fee: number
  status: string
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  shipping_postal_code: string
  notes?: string
  order_type?: string
  sample_type?: string
  due_date?: string
  created_at: string
  updated_at: string
  order_items: any[]
}

export const useOrder = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null)

  // 주문 생성
  const createOrder = async (orderData: CreateOrderData) => {
    setIsLoading(true)
    try {
      // 현재 사용자 세션에서 토큰 가져오기
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(orderData)
      })

      if (!response.ok) {
        throw new Error('주문 생성에 실패했습니다.')
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '주문 생성에 실패했습니다.')
      }

      const successMessage = '주문이 성공적으로 생성되었습니다.'
      
      showSuccess(result.message || successMessage)
      return result.data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '주문 생성 중 오류가 발생했습니다.'
      showError(errorMessage)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // 주문 목록 조회
  const fetchOrders = async (params?: {
    userId?: string
    page?: number
    limit?: number
    status?: string
    orderType?: string
  }) => {
    setIsLoading(true)
    try {
      const searchParams = new URLSearchParams()
      
      if (params?.userId) searchParams.set('userId', params.userId)
      if (params?.page) searchParams.set('page', params.page.toString())
      if (params?.limit) searchParams.set('limit', params.limit.toString())
      if (params?.status) searchParams.set('status', params.status)
      if (params?.orderType) searchParams.set('orderType', params.orderType)

      const response = await fetch(`/api/orders?${searchParams.toString()}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '주문 목록을 불러오는데 실패했습니다.')
      }

      setOrders(result.data.orders)
      return result.data

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '주문 목록 조회 중 오류가 발생했습니다.'
      showError(errorMessage)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  // 주문 상태별 개수 계산
  const getOrderStatusCounts = (orders: Order[]) => {
    const counts = {
      pending: 0,
      pending_approval: 0,
      confirmed: 0,
      preparing: 0,
      shipped: 0,
      delivered: 0,
      returned: 0,
      overdue: 0,
      charged: 0,
      cancelled: 0,
      rejected: 0
    }

    orders.forEach(order => {
      if (counts.hasOwnProperty(order.status)) {
        counts[order.status as keyof typeof counts]++
      }
    })

    return counts
  }

  // 주문 상태 텍스트 변환
  const getOrderStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      pending: '주문 접수',
      pending_approval: '승인 대기',
      confirmed: '주문 확인',
      preparing: '상품 준비중',
      shipped: '배송중',
      delivered: '배송 완료',
      returned: '반납 완료',
      overdue: '기한 초과',
      charged: '차감 완료',
      cancelled: '주문 취소',
      rejected: '거절됨'
    }
    return statusMap[status] || status
  }

  // 주문 상태 색상
  const getOrderStatusColor = (status: string) => {
    const colorMap: { [key: string]: string } = {
      pending: 'bg-yellow-100 text-yellow-800',
      pending_approval: 'bg-orange-100 text-orange-800',
      confirmed: 'bg-blue-100 text-blue-800',
      preparing: 'bg-indigo-100 text-indigo-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      returned: 'bg-teal-100 text-teal-800',
      overdue: 'bg-red-100 text-red-800',
      charged: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800'
    }
    return colorMap[status] || 'bg-gray-100 text-gray-800'
  }

  return {
    isLoading,
    orders,
    currentOrder,
    setCurrentOrder,
    createOrder,
    fetchOrders,
    getOrderStatusCounts,
    getOrderStatusText,
    getOrderStatusColor
  }
} 