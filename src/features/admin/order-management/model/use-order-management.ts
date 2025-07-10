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
  processing: number
  confirmed: number
  total: number
  allocated: number
  partial: number
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
  // DB에 UTC로 저장되어 있으므로 한국 시간을 UTC로 변환
  const target = new Date(targetDate)
  const dayOfWeek = target.getDay() // 0=일요일, 1=월요일, ..., 6=토요일
  
  let startDay = new Date(target)
  let endDay = new Date(target)
  
  // 월요일인 경우 주말 주문 포함 처리
  if (dayOfWeek === 1) {
    // 월요일이면 금요일 15:00부터 월요일 14:59까지 조회
    // 금요일 15:00 (한국 시간) = UTC 06:00
    startDay.setDate(target.getDate() - 3) // 월요일 - 3일 = 금요일
    const startTimeUTC = new Date(Date.UTC(
      startDay.getFullYear(), 
      startDay.getMonth(), 
      startDay.getDate(), 
      6, 0, 0  // 한국 15:00 = UTC 06:00
    ))
    
    // 월요일 14:59 (한국 시간) = UTC 05:59
    const endTimeUTC = new Date(Date.UTC(
      target.getFullYear(), 
      target.getMonth(), 
      target.getDate(), 
      5, 59, 59  // 한국 14:59 = UTC 05:59
    ))
    
    return {
      startDate: startTimeUTC.toISOString(),
      endDate: endTimeUTC.toISOString()
    }
  } else {
    // 평일의 경우 기존 로직 적용
    // 전날 15:00 (한국 시간) = UTC 06:00
    const prevDay = new Date(target)
    prevDay.setDate(target.getDate() - 1)
    const startTimeUTC = new Date(Date.UTC(
      prevDay.getFullYear(), 
      prevDay.getMonth(), 
      prevDay.getDate(), 
      6, 0, 0  // 한국 15:00 = UTC 06:00
    ))
    
    // 당일 14:59 (한국 시간) = UTC 05:59
    const endTimeUTC = new Date(Date.UTC(
      target.getFullYear(), 
      target.getMonth(), 
      target.getDate(), 
      5, 59, 59  // 한국 14:59 = UTC 05:59
    ))
    
    return {
      startDate: startTimeUTC.toISOString(),
      endDate: endTimeUTC.toISOString()
    }
  }
}

export function useOrderManagement() {
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState<OrderStats>({
    pending: 0,
    processing: 0,
    confirmed: 0,
    total: 0,
    allocated: 0,
    partial: 0,
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
    status: 'not_shipped',  // 기본값을 not_shipped로 설정
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
    // 오후 3시 기준 날짜 계산 (주말 주문 월요일 처리 포함)
    const now = new Date()
    const koreaTimeString = now.toLocaleString("en-US", {timeZone: "Asia/Seoul"})
    const koreaTime = new Date(koreaTimeString)
    const hour = koreaTime.getHours()
    const dayOfWeek = koreaTime.getDay() // 0=일요일, 1=월요일, ..., 6=토요일
    
    // 날짜 계산을 위한 기준 날짜 설정
    const targetDate = new Date(koreaTime)
    
    // 주말 처리 로직
    if (dayOfWeek === 1) { // 월요일인 경우
      // 월요일에는 주말 주문들(토~일)을 모두 표시
      // 특별한 처리 없이 월요일 그대로 사용
    } else if (dayOfWeek === 6) { // 토요일인 경우
      if (hour >= 15) {
        // 토요일 오후 3시 이후는 월요일로 이동
        targetDate.setDate(targetDate.getDate() + 2) // 토요일 + 2일 = 월요일
      }
    } else if (dayOfWeek === 0) { // 일요일인 경우
      // 일요일은 항상 월요일로 이동
      targetDate.setDate(targetDate.getDate() + 1) // 일요일 + 1일 = 월요일
    } else {
      // 평일 (화~금)의 경우 기존 로직 적용
      if (hour >= 15) {
        targetDate.setDate(targetDate.getDate() + 1)
      }
    }
    
    // YYYY-MM-DD 형식으로 변환
    const year = targetDate.getFullYear()
    const month = String(targetDate.getMonth() + 1).padStart(2, '0')
    const day = String(targetDate.getDate()).padStart(2, '0')
    const today = `${year}-${month}-${day}`
    
    updateFilters({ 
      startDate: today,
      is_3pm_based: true,
      status: 'not_shipped'  // shipped 상태 제외하고 조회
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
      status: 'not_shipped',  // 리셋 시에도 not_shipped로 설정
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

  // 강제 새로고침 함수
  const refreshOrders = async () => {
    await fetchOrders()
  }

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
    resetFilters,
    refreshOrders
  }
} 