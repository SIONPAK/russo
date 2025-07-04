import { useState, useEffect } from 'react'
import { showSuccess, showError } from '@/shared/lib/toast'

export interface OrderItem {
  id: string
  product_name: string
  color: string
  size: string
  quantity: number
  unit_price: number
  total_price: number
  products?: {
    name: string
    images: Array<{
      image_url: string
      is_main: boolean
    }>
  }
}

export interface Order {
  id: string
  order_number: string
  user_id: string
  total_amount: number
  shipping_fee: number
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  shipping_postal_code: string
  tracking_number?: string
  notes?: string
  created_at: string
  updated_at: string
  shipped_at?: string
  delivered_at?: string
  users?: {
    company_name: string
    representative_name: string
    phone: string
    email: string
  }
  order_items: OrderItem[]
}

export interface OrderStats {
  pending: number
  confirmed: number
  shipped: number
  delivered: number
  cancelled: number
  total: number
}

export interface OrderFilters {
  search: string
  status: string
  startDate: string
  endDate: string
  page: number
  limit: number
}

export function useOrderManagement() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderStats>({
    pending: 0,
    confirmed: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    total: 0
  })
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false
  })

  const [filters, setFilters] = useState<OrderFilters>({
    search: '',
    status: 'all',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 20
  })

  // 주문 목록 조회
  const fetchOrders = async (newFilters?: Partial<OrderFilters>) => {
    try {
      setLoading(true)
      const currentFilters = { ...filters, ...newFilters }
      
      const params = new URLSearchParams()
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString())
      })

      const response = await fetch(`/api/admin/orders?${params}`)
      const result = await response.json()

      if (result.success) {
        setOrders(result.data.orders)
        setStats(result.data.stats)
        setPagination(result.data.pagination)
        if (newFilters) {
          setFilters(currentFilters)
        }
      } else {
        showError(result.error || '주문 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('주문 목록 조회 실패:', error)
      showError('주문 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 주문 상태 일괄 업데이트
  const updateOrdersStatus = async (
    orderIds: string[], 
    status: Order['status'], 
    trackingNumbers?: string[]
  ) => {
    try {
      setUpdating(true)
      
      const response = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderIds,
          status,
          trackingNumbers
        })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(result.message)
        await fetchOrders() // 목록 새로고침
        setSelectedOrders([]) // 선택 해제
        return true
      } else {
        showError(result.error || '주문 상태 업데이트에 실패했습니다.')
        return false
      }
    } catch (error) {
      console.error('주문 상태 업데이트 실패:', error)
      showError('주문 상태 업데이트에 실패했습니다.')
      return false
    } finally {
      setUpdating(false)
    }
  }

  // 단일 주문 상태 업데이트
  const updateSingleOrder = async (
    orderId: string, 
    status: Order['status'], 
    trackingNumber?: string
  ) => {
    return updateOrdersStatus([orderId], status, trackingNumber ? [trackingNumber] : undefined)
  }

  // 주문 선택/해제
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  // 전체 선택/해제
  const toggleAllSelection = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(orders.map(order => order.id))
    }
  }

  // 필터 업데이트
  const updateFilters = (newFilters: Partial<OrderFilters>) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 }
    fetchOrders(updatedFilters)
  }

  // 페이지 변경
  const changePage = (page: number) => {
    fetchOrders({ page })
  }

  // 필터 초기화
  const resetFilters = () => {
    const resetFilters = {
      search: '',
      status: 'all',
      startDate: '',
      endDate: '',
      page: 1,
      limit: 20
    }
    setFilters(resetFilters)
    fetchOrders(resetFilters)
  }

  // 초기 데이터 로드
  useEffect(() => {
    fetchOrders()
  }, [])

  return {
    // 상태
    orders,
    stats,
    loading,
    updating,
    selectedOrders,
    pagination,
    filters,
    
    // 액션
    fetchOrders,
    updateOrdersStatus,
    updateSingleOrder,
    toggleOrderSelection,
    toggleAllSelection,
    updateFilters,
    changePage,
    resetFilters
  }
} 