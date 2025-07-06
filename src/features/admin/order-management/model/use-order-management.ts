import { useState, useEffect } from 'react'
import { showSuccess, showError } from '@/shared/lib/toast'

export interface OrderItem {
  id: string
  product_name: string
  color: string
  size: string
  quantity: number
  shipped_quantity?: number
  unit_price: number
  total_price: number
  available_stock?: number
  allocated_quantity?: number
  allocation_status?: 'pending' | 'allocated' | 'insufficient'
  products?: {
    name: string
    code: string
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
  allocation_status?: 'pending' | 'allocated' | 'partial' | 'insufficient'
  allocation_priority?: number
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
  allocated: number
  insufficient_stock: number
}

export interface OrderFilters {
  search: string
  status: string
  startDate: string
  endDate: string
  page: number
  limit: number
  is_3pm_based?: boolean
  allocation_status?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export function get3PMBasedDateRange(targetDate: string) {
  // 한국 시간 기준으로 계산
  const target = new Date(targetDate + 'T00:00:00+09:00') // 한국 시간대로 파싱
  
  // 전날 오후 3시 (한국 시간)
  const startDate = new Date(target)
  startDate.setDate(startDate.getDate() - 1)
  startDate.setHours(15, 0, 0, 0)
  
  // 당일 오후 2시 59분 59초 (한국 시간)
  const endDate = new Date(target)
  endDate.setHours(14, 59, 59, 999)
  
  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  }
}

export function useOrderManagement() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderStats>({
    pending: 0,
    confirmed: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    total: 0,
    allocated: 0,
    insufficient_stock: 0
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
    limit: 20,
    is_3pm_based: true,
    allocation_status: 'all',
    sort_by: 'company_name',
    sort_order: 'desc'
  })

  const fetchOrders = async (newFilters?: Partial<OrderFilters>) => {
    try {
      setLoading(true)
      const currentFilters = { ...filters, ...newFilters }
      
      if (currentFilters.is_3pm_based && currentFilters.startDate) {
        const dateRange = get3PMBasedDateRange(currentFilters.startDate)
        currentFilters.startDate = dateRange.startDate
        currentFilters.endDate = dateRange.endDate
      }
      
      const params = new URLSearchParams()
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString())
      })

      const response = await fetch(`/api/admin/orders?${params}`)
      const result = await response.json()

      if (result.success) {
        let ordersData = result.data.orders
        
        // 클라이언트 사이드에서 업체명 정렬 처리
        if (currentFilters.sort_by === 'company_name') {
          ordersData = ordersData.sort((a: Order, b: Order) => {
            const companyA = a.users?.company_name || ''
            const companyB = b.users?.company_name || ''
            
            if (currentFilters.sort_order === 'asc') {
              return companyA.localeCompare(companyB)
            } else {
              return companyB.localeCompare(companyA)
            }
          })
        }
        
        setOrders(ordersData)
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

  const allocateInventory = async (orderIds: string[]) => {
    try {
      setUpdating(true)
      
      const response = await fetch('/api/admin/orders/allocate-inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderIds })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(`${result.data.allocated}건의 주문에 재고가 할당되었습니다.`)
        await fetchOrders()
        return true
      } else {
        showError(result.error || '재고 할당에 실패했습니다.')
        return false
      }
    } catch (error) {
      console.error('재고 할당 실패:', error)
      showError('재고 할당에 실패했습니다.')
      return false
    } finally {
      setUpdating(false)
    }
  }

  const fetchTodayOrders = () => {
    // 한국 시간 기준으로 오늘 날짜 구하기
    const now = new Date()
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
    const today = koreaTime.toISOString().split('T')[0]
    
    updateFilters({ 
      startDate: today,
      is_3pm_based: true
    })
  }

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
        showSuccess(`${result.data.updatedOrders}건의 주문이 업데이트되었습니다.`)
        await fetchOrders()
        setSelectedOrders([])
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

  const updateSingleOrder = async (
    orderId: string, 
    status: Order['status'], 
    trackingNumber?: string
  ) => {
    return updateOrdersStatus([orderId], status, trackingNumber ? [trackingNumber] : undefined)
  }

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  const toggleAllSelection = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(orders.map(order => order.id))
    }
  }

  const updateFilters = (newFilters: Partial<OrderFilters>) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 }
    fetchOrders(updatedFilters)
  }

  const changePage = (page: number) => {
    fetchOrders({ page })
  }

  const resetFilters = () => {
    const resetFilters = {
      search: '',
      status: 'all',
      startDate: '',
      endDate: '',
      page: 1,
      limit: 20,
      is_3pm_based: true,
      allocation_status: 'all',
      sort_by: 'company_name',
      sort_order: 'desc' as const
    }
    setFilters(resetFilters)
    fetchOrders(resetFilters)
  }

  // 초기 로딩은 페이지 컴포넌트에서 처리

  return {
    orders,
    stats,
    loading,
    updating,
    selectedOrders,
    pagination,
    filters,
    
    fetchOrders,
    fetchTodayOrders,
    allocateInventory,
    updateOrdersStatus,
    updateSingleOrder,
    toggleOrderSelection,
    toggleAllSelection,
    updateFilters,
    changePage,
    resetFilters
  }
} 