'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { showSuccess, showError, showInfo } from '@/shared/lib/toast'
import { generateReceipt, ReceiptData } from '@/shared/lib/receipt-utils'
import { formatCurrency } from '@/shared/lib/utils'
import { User as UserType } from '@/shared/types'
import { 
  Package, 
  Search, 
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  MapPin,
  Phone,
  User,
  ChevronDown,
  ChevronUp,
  Calendar,
  RefreshCw,
  RotateCcw,
  AlertTriangle
} from 'lucide-react'

interface OrderItem {
  id: string
  product_id: string
  product_name: string
  color: string
  size: string
  quantity: number
  unit_price: number
  total_price: number
  shipped_quantity?: number
  options?: any
  products?: {
    name: string
    price: number
    images?: Array<{
      image_url: string
      is_main: boolean
    }>
  }
}

interface Order {
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
  tracking_number?: string
  created_at: string
  updated_at: string
  order_items: OrderItem[]
  order_type: string
}

interface SampleOrder {
  id: string
  sample_number: string
  customer_id: string
  customer_name: string
  product_id: string
  product_name: string
  quantity: number
  sample_type: 'photography' | 'sales'
  charge_amount: number
  status: string
  status_text: string
  status_color: string
  notes?: string
  tracking_number?: string
  created_at: string
  due_date?: string
  return_date?: string
  charge_date?: string
  products?: {
    id: string
    name: string
    price: number
    images: Array<{ image_url: string }>
  }
}

interface OrdersResponse {
  orders: Order[]
  pagination: {
    currentPage: number
    totalPages: number
    totalCount: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

interface SampleOrdersResponse {
  success: boolean
  data: SampleOrder[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  error?: string
}

const statusMap = {
  pending: { label: '주문 접수', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmed: { label: '주문 확인', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  shipped: { label: '배송 중', color: 'bg-purple-100 text-purple-800', icon: Truck },
  delivered: { label: '배송 완료', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: '주문 취소', color: 'bg-red-100 text-red-800', icon: XCircle }
}

export function OrdersPage() {
  const { isAuthenticated, user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'purchase' | 'sample' | 'unshipped'>('purchase')
  
  // 오후 3시 기준 날짜 계산 함수
  const getDateBasedOn3PM = () => {
    const now = new Date()
    const koreaTimeString = now.toLocaleString("en-US", {timeZone: "Asia/Seoul"})
    const koreaTime = new Date(koreaTimeString)
    const hour = koreaTime.getHours()
    
    // 오후 3시 이후면 다음날로 설정
    if (hour >= 15) {
      koreaTime.setDate(koreaTime.getDate() + 1)
    }
    
    const year = koreaTime.getFullYear()
    const month = String(koreaTime.getMonth() + 1).padStart(2, '0')
    const day = String(koreaTime.getDate()).padStart(2, '0')
    
    return `${year}-${month}-${day}`
  }
  
  // 발주 주문 관련 상태 (기존 일반 주문 상태를 발주용으로 변경)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateRange, setDateRange] = useState<'today' | '1month' | '3month' | '6month' | 'all'>('today')
  const [selectedDate, setSelectedDate] = useState(() => getDateBasedOn3PM()) // 오후 3시 기준 날짜로 초기화
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set())

  // 샘플 주문 관련 상태
  const [sampleOrders, setSampleOrders] = useState<SampleOrder[]>([])
  const [sampleLoading, setSampleLoading] = useState(true)
  const [samplePage, setSamplePage] = useState(1)
  const [sampleTotalPages, setSampleTotalPages] = useState(1)
  const [sampleTotal, setSampleTotal] = useState(0)
  
  // 샘플 주문 전용 필터 상태
  const [sampleStatusFilter, setSampleStatusFilter] = useState('')
  const [sampleDateRange, setSampleDateRange] = useState<'today' | '1month' | '3month' | '6month' | 'all'>('today')
  const [sampleSelectedDate, setSampleSelectedDate] = useState(() => getDateBasedOn3PM()) // 샘플 주문도 오후 3시 기준
  const [sampleStartDate, setSampleStartDate] = useState('')
  const [sampleEndDate, setSampleEndDate] = useState('')

  // 미발송 내역 관련 상태
  const [unshippedStatements, setUnshippedStatements] = useState<any[]>([])
  const [unshippedLoading, setUnshippedLoading] = useState(false)

  // 오후 3시 기준 발주 내역 조회 함수
  const fetchPurchaseOrdersBy3PM = async (selectedDate: string) => {
    if (!user) return
    
    try {
      setLoading(true)
      
      // 프론트엔드에서 오후 3시 기준 날짜 범위 계산
      const dateObj = new Date(selectedDate + 'T00:00:00')
      
      // 전날 15:00 (한국) = 전날 06:00 (UTC)
      const startTimeUTC = new Date(Date.UTC(
        dateObj.getFullYear(), 
        dateObj.getMonth(), 
        dateObj.getDate() - 1, 
        6, 0, 0
      ))
      
      // 당일 14:59 (한국) = 당일 05:59 (UTC)
      const endTimeUTC = new Date(Date.UTC(
        dateObj.getFullYear(), 
        dateObj.getMonth(), 
        dateObj.getDate(), 
        5, 59, 59
      ))
      
      // API 엔드포인트를 사용하여 발주 내역 조회
      const params = new URLSearchParams({
        type: 'purchase',
        startDate: startTimeUTC.toISOString(),
        endDate: endTimeUTC.toISOString(),
        userId: user.id,
        is_3pm_based: 'true',
        limit: '100'
      })
      
      const response = await fetch(`/api/orders?${params}`)
      const result = await response.json()
      
      if (response.ok) {
        setOrders(result.orders || [])
        setTotalCount(result.orders?.length || 0)
      } else {
        console.error('발주 내역 조회 실패:', result.error)
        setOrders([])
        setTotalCount(0)
      }
    } catch (error) {
      console.error('발주 내역 조회 오류:', error)
      setOrders([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  // 오후 3시 기준 샘플 주문 조회 함수
  const fetchSampleOrdersBy3PM = async (selectedDate: string) => {
    if (!user) return
    
    try {
      setSampleLoading(true)
      
      // 프론트엔드에서 오후 3시 기준 날짜 범위 계산
      const dateObj = new Date(selectedDate + 'T00:00:00')
      
      // 전날 15:00 (한국) = 전날 06:00 (UTC)
      const startTimeUTC = new Date(Date.UTC(
        dateObj.getFullYear(), 
        dateObj.getMonth(), 
        dateObj.getDate() - 1, 
        6, 0, 0
      ))
      
      // 당일 14:59 (한국) = 당일 05:59 (UTC)
      const endTimeUTC = new Date(Date.UTC(
        dateObj.getFullYear(), 
        dateObj.getMonth(), 
        dateObj.getDate(), 
        5, 59, 59
      ))
      
      // API 엔드포인트를 사용하여 샘플 주문 조회
      const params = new URLSearchParams({
        type: 'sample',
        startDate: startTimeUTC.toISOString(),
        endDate: endTimeUTC.toISOString(),
        userId: user.id,
        is_3pm_based: 'true',
        limit: '100'
      })
      
      const response = await fetch(`/api/orders?${params}`)
      const result = await response.json()
      
      if (response.ok) {
        setSampleOrders(result.orders || [])
        setSampleTotal(result.orders?.length || 0)
      } else {
        console.error('샘플 주문 조회 실패:', result.error)
        setSampleOrders([])
        setSampleTotal(0)
      }
    } catch (error) {
      console.error('샘플 주문 조회 오류:', error)
      setSampleOrders([])
      setSampleTotal(0)
    } finally {
      setSampleLoading(false)
    }
  }

  // 날짜 범위 설정 (일반 주문용) - 오후 3시 기준으로 수정
  const setDateRangeFilter = (range: 'today' | '1month' | '3month' | '6month' | 'all') => {
    setDateRange(range)
    
    if (range === 'today') {
      const todayDate = getDateBasedOn3PM()
      setSelectedDate(todayDate)
      fetchPurchaseOrdersBy3PM(todayDate)
    } else {
      // 기간 범위 선택 시 기존 로직 유지
      const today = new Date()
      const endDateStr = today.toISOString().split('T')[0]
      
      let startDateStr = ''
      if (range !== 'all') {
        const startDateObj = new Date(today)
        const months = range === '1month' ? 1 : range === '3month' ? 3 : 6
        startDateObj.setMonth(startDateObj.getMonth() - months)
        startDateStr = startDateObj.toISOString().split('T')[0]
      }
      
      setStartDate(startDateStr)
      setEndDate(range === 'all' ? '' : endDateStr)
      setCurrentPage(1)
      
      // 기간 범위 조회 시 기존 함수 사용
      setTimeout(() => {
        fetchOrdersWithParams(1, startDateStr, range === 'all' ? '' : endDateStr)
      }, 50)
    }
  }

  // 날짜 범위 설정 (샘플 주문용) - 오후 3시 기준으로 수정
  const setSampleDateRangeFilter = (range: 'today' | '1month' | '3month' | '6month' | 'all') => {
    setSampleDateRange(range)
    
    if (range === 'today') {
      const todayDate = getDateBasedOn3PM()
      setSampleSelectedDate(todayDate)
      fetchSampleOrdersBy3PM(todayDate)
    } else {
      // 기간 범위 선택 시 기존 로직 유지
      const today = new Date()
      const endDateStr = today.toISOString().split('T')[0]
      
      let startDateStr = ''
      if (range !== 'all') {
        const startDateObj = new Date(today)
        const months = range === '1month' ? 1 : range === '3month' ? 3 : 6
        startDateObj.setMonth(startDateObj.getMonth() - months)
        startDateStr = startDateObj.toISOString().split('T')[0]
      }
      
      setSampleStartDate(startDateStr)
      setSampleEndDate(range === 'all' ? '' : endDateStr)
      setSamplePage(1)
      
      // 기간 범위 조회 시 기존 함수 사용
      setTimeout(() => {
        fetchSampleOrdersWithParams(1, startDateStr, range === 'all' ? '' : endDateStr)
      }, 50)
    }
  }

  // 날짜 직접 선택 시 오후 3시 기준 조회
  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    fetchPurchaseOrdersBy3PM(date)
  }

  // 샘플 주문 날짜 직접 선택 시 오후 3시 기준 조회
  const handleSampleDateChange = (date: string) => {
    setSampleSelectedDate(date)
    fetchSampleOrdersBy3PM(date)
  }

  // 검색 실행
  const handleSearch = () => {
    if (dateRange === 'today') {
      fetchPurchaseOrdersBy3PM(selectedDate)
    } else {
      setCurrentPage(1)
      fetchOrders(1)
    }
  }

  // 샘플 주문 검색 실행
  const handleSampleSearch = () => {
    if (sampleDateRange === 'today') {
      fetchSampleOrdersBy3PM(sampleSelectedDate)
    } else {
      setSamplePage(1)
      fetchSampleOrders(1)
    }
  }

  // 초기 데이터 로드
  useEffect(() => {
    if (user?.id) {
      // 현재 활성 탭에 따라 해당 데이터만 로드
      if (activeTab === 'purchase') {
        // 오늘 날짜로 초기화하여 오후 3시 기준 조회
        fetchPurchaseOrdersBy3PM(selectedDate)
      } else if (activeTab === 'sample') {
        // 샘플 주문도 오후 3시 기준 조회
        fetchSampleOrdersBy3PM(sampleSelectedDate)
      }
    }
  }, [user?.id])

  // 탭 변경 시 해당 탭 데이터만 로드
  useEffect(() => {
    if (user?.id && activeTab) {
      if (activeTab === 'purchase') {
        fetchPurchaseOrdersBy3PM(selectedDate)
      } else if (activeTab === 'sample') {
        fetchSampleOrdersBy3PM(sampleSelectedDate)
      }
    }
  }, [activeTab, user?.id])

  // 샘플 주문 상태 필터 변경 시 데이터 다시 로드
  useEffect(() => {
    if (user?.id && activeTab === 'sample') {
      if (sampleDateRange === 'today') {
        fetchSampleOrdersBy3PM(sampleSelectedDate)
      } else {
        fetchSampleOrders(1)
      }
    }
  }, [sampleStatusFilter, user?.id, activeTab])

  // 발주 주문 데이터 가져오기 (기존 fetchOrders 수정)
  const fetchOrders = async (page = 1) => {
    if (!isAuthenticated || !user) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        includeUnshipped: 'true',
        userId: user.id,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(startDate && { startDate }),
        ...(endDate && { endDate })
      })

      const response = await fetch(`/api/orders?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch orders')
      }

      const result = await response.json()
      
      if (response.ok) {
        setOrders(result.orders || [])
        setUnshippedStatements(result.unshippedStatements || [])
        setTotalPages(result.pagination?.totalPages || 1)
        setTotalCount(result.pagination?.totalCount || 0)
      } else {
        showError(result.error || '발주 내역을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('Fetch orders error:', error)
      showError('발주 내역을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const fetchOrdersWithParams = async (page = 1, startDateParam?: string, endDateParam?: string) => {
    if (!isAuthenticated || !user) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        userId: user.id,
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(startDateParam && { startDate: startDateParam }),
        ...(endDateParam && { endDate: endDateParam })
      })

      // 발주 주문만 가져오도록 type 필터 추가
      params.append('type', 'purchase')

      const response = await fetch(`/api/orders?${params}`, {
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error('Failed to fetch orders')
      }

      const result = await response.json()
      
      if (result.success) {
        setOrders(result.data || [])
        setTotalPages(result.pagination?.totalPages || 1)
        setTotalCount(result.pagination?.totalCount || 0)
      } else {
        showError('발주 내역을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('Fetch orders error:', error)
      showError('발주 내역을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 샘플 주문 목록 조회
  const fetchSampleOrders = async (page = 1) => {
    if (!user?.id) return

    setSampleLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        userId: user.id
      })

      if (sampleStatusFilter) {
        params.append('status', sampleStatusFilter)
      }

      if (sampleStartDate) {
        params.append('startDate', sampleStartDate)
      }

      if (sampleEndDate) {
        params.append('endDate', sampleEndDate)
      }

      const response = await fetch(`/api/orders/sample?${params}`)
      const result: SampleOrdersResponse = await response.json()

      if (result.success) {
        setSampleOrders(result.data)
        setSampleTotalPages(result.pagination.totalPages)
        setSampleTotal(result.pagination.total)
        setSamplePage(page)
      } else {
        showError(result.error || '샘플 주문 내역을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('샘플 주문 목록 조회 오류:', error)
      showError('샘플 주문 내역을 불러오는데 실패했습니다.')
    } finally {
      setSampleLoading(false)
    }
  }

  // 샘플 주문 목록 조회 (날짜 파라미터 직접 전달)
  const fetchSampleOrdersWithParams = async (page = 1, startDateParam?: string, endDateParam?: string) => {
    if (!user?.id) return

    setSampleLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        userId: user.id
      })

      if (sampleStatusFilter) {
        params.append('status', sampleStatusFilter)
      }

      if (startDateParam) {
        params.append('startDate', startDateParam)
      }

      if (endDateParam) {
        params.append('endDate', endDateParam)
      }

      const response = await fetch(`/api/orders/sample?${params}`)
      const result: SampleOrdersResponse = await response.json()

      if (result.success) {
        setSampleOrders(result.data)
        setSampleTotalPages(result.pagination.totalPages)
        setSampleTotal(result.pagination.total)
        setSamplePage(page)
      } else {
        showError(result.error || '샘플 주문 내역을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('샘플 주문 목록 조회 오류:', error)
      showError('샘플 주문 내역을 불러오는데 실패했습니다.')
    } finally {
      setSampleLoading(false)
    }
  }

  // 거래명세서 발급 함수 (영수증 폼 사용, 실제 출고 수량만 포함)
  const handleViewStatement = async (orderId: string) => {
    try {
      // 주문 상세 정보 가져오기
      const order = orders.find(o => o.id === orderId)
      if (!order) {
        showError('주문 정보를 찾을 수 없습니다.')
        return
      }

      // 실제 출고된 아이템만 필터링
      const shippedItems = order.order_items.filter(item => item.shipped_quantity && item.shipped_quantity > 0)
      
      if (shippedItems.length === 0) {
        showInfo('아직 출고된 상품이 없습니다.')
        return
      }

      // 거래명세서 다운로드 API 호출
      const response = await fetch(`/api/admin/orders/${orderId}/statement`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('거래명세서 생성 실패')
      }

      // 파일 다운로드 처리
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lusso_receipt_${order.order_number}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      showSuccess('거래명세서가 다운로드되었습니다.')
    } catch (error) {
      console.error('거래명세서 발급 실패:', error)
      showError('거래명세서 발급에 실패했습니다.')
    }
  }

  // 세금계산서 조회
  const handleViewInvoice = async (orderId: string, orderNumber: string) => {
    try {
      const response = await fetch(`/api/documents?userId=${user?.id}&type=invoice&search=${orderNumber}`)
      const result = await response.json()

      if (result.success && result.data.length > 0) {
        const invoice = result.data[0]
        // 세금계산서 파일 다운로드
        const link = document.createElement('a')
        link.href = invoice.file_url
        link.download = `세금계산서_${orderNumber}.xlsx`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        showError('해당 주문의 세금계산서를 찾을 수 없습니다.')
      }
    } catch (error) {
      console.error('세금계산서 조회 오류:', error)
      showError('세금계산서 조회 중 오류가 발생했습니다.')
    }
  }

  // 주문 상세 토글
  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(orderId)) {
        newSet.delete(orderId)
      } else {
        newSet.add(orderId)
      }
      return newSet
    })
  }

  // 샘플 주문 상태 아이콘
  const getSampleStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-orange-500" />
      case 'approved':
      case 'shipped':
        return <Truck className="h-5 w-5 text-blue-500" />
      case 'delivered':
        return <Package className="h-5 w-5 text-green-500" />
      case 'recovered':
        return <RotateCcw className="h-5 w-5 text-gray-500" />
      case 'charged':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Package className="h-5 w-5 text-gray-500" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getDaysUntilDue = (dueDate: string) => {
    const due = new Date(dueDate)
    const now = new Date()
    const diffTime = due.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // 검색된 주문 목록
  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.order_items.some(item => 
                           item.product_name.toLowerCase().includes(searchTerm.toLowerCase())
                         )
    return matchesSearch
  })

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-12">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            로그인이 필요합니다
          </h3>
          <p className="text-gray-500">
            주문 내역을 확인하려면 로그인해주세요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">주문 내역</h1>
      </div>

      {/* 탭 메뉴 */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('purchase')}
              className={`py-3 px-1 border-b-2 font-semibold text-sm ${
                activeTab === 'purchase'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              발주 내역
            </button>
            <button
              onClick={() => setActiveTab('sample')}
              className={`py-3 px-1 border-b-2 font-semibold text-sm ${
                activeTab === 'sample'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              샘플 주문
            </button>
            <button
              onClick={() => setActiveTab('unshipped')}
              className={`py-3 px-1 border-b-2 font-semibold text-sm ${
                activeTab === 'unshipped'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              미발송 내역
              {unshippedStatements.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                  {unshippedStatements.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* 일반 주문 탭 */}
      {activeTab === 'purchase' && (
        <>
          {/* 검색 및 필터 */}
          <div className="mb-8 space-y-6">
            {/* 상태 필터 버튼 */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setStatusFilter('')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === '' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                전체 주문내역상태
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === 'pending' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                주문 접수
              </button>
              <button
                onClick={() => setStatusFilter('confirmed')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === 'confirmed' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                주문 확인
              </button>
              <button
                onClick={() => setStatusFilter('shipped')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === 'shipped' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                배송 중
              </button>
              <button
                onClick={() => setStatusFilter('delivered')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === 'delivered' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                배송 완료
              </button>
              <button
                onClick={() => setStatusFilter('cancelled')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === 'cancelled' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                주문 취소
              </button>
            </div>

            {/* 날짜 범위 필터 */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setDateRangeFilter('today')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  dateRange === 'today' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                오늘
              </button>
              <button
                onClick={() => setDateRangeFilter('1month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  dateRange === '1month' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                1개월
              </button>
              <button
                onClick={() => setDateRangeFilter('3month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  dateRange === '3month' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                3개월
              </button>
              <button
                onClick={() => setDateRangeFilter('6month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  dateRange === '6month' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                6개월
              </button>
            </div>

            {/* 날짜 직접 입력 */}
            <div className="flex items-center gap-4">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
              />
              <Button
                onClick={handleSearch}
                className="bg-black hover:bg-gray-800 text-white px-6 py-2"
              >
                조회
              </Button>
              <div className="text-xs text-gray-500">
                * 오후 3시 기준 조회 (전날 15:00 ~ 당일 14:59)
              </div>
            </div>
          </div>

          {/* 일반 주문 목록 */}
          {loading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
              <p className="mt-4 text-gray-600">주문 목록을 불러오는 중...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                주문 내역이 없습니다
              </h3>
              <p className="text-gray-500 mb-6">
                첫 주문을 시작해보세요.
              </p>
              <Button
                onClick={() => window.location.href = '/products'}
                className="bg-black hover:bg-gray-800 text-white"
              >
                상품 둘러보기
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {orders.map((order) => {
                const statusInfo = statusMap[order.status as keyof typeof statusMap] || statusMap.pending
                const StatusIcon = statusInfo.icon
                const isExpanded = expandedOrders.has(order.id)

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300"
                  >
                    {/* 주문 헤더 */}
                    <div className="p-6 bg-gradient-to-r from-gray-50 to-white">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="p-2 bg-white rounded-lg shadow-sm">
                            <StatusIcon className="h-6 w-6 text-gray-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">
                              {order.order_number}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {formatDate(order.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            order.tracking_number === '미출고' 
                              ? 'bg-gray-100 text-gray-800' 
                              : statusInfo.color
                          }`}>
                            {order.tracking_number === '미출고' ? '미출고' : statusInfo.label}
                          </span>
                          <Button
                            onClick={() => toggleOrderExpand(order.id)}
                            variant="ghost"
                            size="sm"
                            className="p-2"
                          >
                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </Button>
                        </div>
                      </div>

                      {/* 주문 요약 */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-white p-3 rounded-lg">
                          <span className="text-xs text-gray-500 block">실제 출고 금액</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {formatCurrency(
                              order.tracking_number === '미출고' 
                                ? 0 
                                : order.order_items.reduce((sum, item) => 
                                    sum + (item.unit_price * (item.shipped_quantity || 0)), 0
                                  )
                            )}
                          </span>
                        </div>
                        <div className="bg-white p-3 rounded-lg">
                          <span className="text-xs text-gray-500 block">출고 수량</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {order.tracking_number === '미출고' 
                              ? 0 
                              : order.order_items.reduce((sum, item) => sum + (item.shipped_quantity || 0), 0)
                            }개
                          </span>
                        </div>
                        <div className="bg-white p-3 rounded-lg">
                          <span className="text-xs text-gray-500 block">받는 분</span>
                          <span className="text-sm font-semibold text-gray-900">{order.shipping_name}</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg">
                          <span className="text-xs text-gray-500 block">연락처</span>
                          <span className="text-sm font-semibold text-gray-900">{order.shipping_phone}</span>
                        </div>
                      </div>

                      {/* 주문 액션 버튼 */}
                      <div className="flex flex-wrap gap-2 mt-4">
                        {/* 거래명세서 조회 - 배송중 또는 배송완료 상태일 때만 표시 */}
                        {(order.status === 'shipped' || order.status === 'delivered') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewStatement(order.id)}
                            className="text-purple-600 hover:text-purple-700"
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            거래명세서
                          </Button>
                        )}
                        
                        {/* 상태별 안내 메시지 */}
                        {order.status === 'pending' && (
                          <div className="text-xs text-gray-500 italic">
                            거래명세서는 상품 출고 후 다운로드 가능합니다.
                          </div>
                        )}
                        {order.status === 'confirmed' && (
                          <div className="text-xs text-gray-500 italic">
                            상품 준비 중입니다. 출고 후 거래명세서를 다운로드하실 수 있습니다.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 주문 상세 정보 (확장 시) */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 bg-gray-50 p-6">
                        {/* 주문 상품 */}
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                            <Package className="h-4 w-4 mr-2" />
                            주문 상품
                          </h4>
                          <div className="space-y-2">
                            {order.order_items.map((item) => {
                              const shippedQuantity = order.tracking_number === '미출고' ? 0 : (item.shipped_quantity || 0)
                              const shippedAmount = shippedQuantity * item.unit_price
                              
                              return (
                                <div key={item.id} className="flex items-center space-x-3 bg-white p-3 rounded-lg shadow-sm">
                                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                    <Package className="h-6 w-6 text-gray-400" />
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="text-sm font-medium text-gray-900">{item.product_name}</h5>
                                    <p className="text-xs text-gray-500">
                                      {item.color} / {item.size}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      주문: {item.quantity}개 → 출고: {shippedQuantity}개
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(shippedAmount)}</p>
                                    <p className="text-xs text-gray-500">{formatCurrency(item.unit_price)}/개</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* 배송 정보 */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                            <Truck className="h-4 w-4 mr-2" />
                            배송 정보
                          </h4>
                          <div className="bg-white p-3 rounded-lg shadow-sm space-y-2">
                            {/* 주문 상태 표시 */}
                            <div className="flex items-center">
                              <StatusIcon className="h-3 w-3 text-gray-400 mr-2" />
                              <span className="text-sm font-medium mr-2">주문 상태:</span>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                order.tracking_number === '미출고' 
                                  ? 'bg-gray-100 text-gray-800' 
                                  : statusInfo.color
                              }`}>
                                {order.tracking_number === '미출고' ? '미출고' : statusInfo.label}
                              </span>
                            </div>
                            <div className="flex items-center">
                              <User className="h-3 w-3 text-gray-400 mr-2" />
                              <span className="text-sm font-medium">{order.shipping_name}</span>
                            </div>
                            <div className="flex items-center">
                              <Phone className="h-3 w-3 text-gray-400 mr-2" />
                              <span className="text-sm">{order.shipping_phone}</span>
                            </div>
                            <div className="flex items-start">
                              <MapPin className="h-3 w-3 text-gray-400 mr-2 mt-0.5" />
                              <div className="text-sm">
                                <p className="font-medium">{order.shipping_postal_code}</p>
                                <p>{order.shipping_address}</p>
                              </div>
                            </div>
                            {order.tracking_number && (
                              <div className="flex items-center">
                                <Truck className="h-3 w-3 text-gray-400 mr-2" />
                                <span className="text-sm font-medium mr-2">송장번호:</span>
                                {order.tracking_number === '미출고' ? (
                                  <span className="text-sm text-gray-500">-</span>
                                ) : (
                                  <button
                                    onClick={() => window.open(`https://trace.cjlogistics.com/next/tracking.html?wblNo=${order.tracking_number}`, '_blank')}
                                    className="text-sm text-blue-600 hover:text-blue-800 underline font-medium"
                                  >
                                    {order.tracking_number}
                                  </button>
                                )}
                              </div>
                            )}
                            {order.notes && (
                              <div className="flex items-start">
                                <FileText className="h-3 w-3 text-gray-400 mr-2 mt-0.5" />
                                <span className="text-sm">{order.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center space-x-4 mt-12">
                  <Button
                    onClick={() => fetchOrders(currentPage - 1)}
                    disabled={currentPage === 1}
                    variant="outline"
                    className="px-6"
                  >
                    이전
                  </Button>
                  <span className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    onClick={() => fetchOrders(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    variant="outline"
                    className="px-6"
                  >
                    다음
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 샘플 주문 탭 */}
      {activeTab === 'sample' && (
        <>
          {/* 샘플 주문 검색 및 필터 */}
          <div className="mb-8 space-y-6">
            {/* 상태 필터 버튼 */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setSampleStatusFilter('')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sampleStatusFilter === '' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                전체 샘플 주문내역상태
              </button>
              <button
                onClick={() => setSampleStatusFilter('pending')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sampleStatusFilter === 'pending' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                주문 접수
              </button>
              <button
                onClick={() => setSampleStatusFilter('approved')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sampleStatusFilter === 'approved' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                주문 확인
              </button>
              <button
                onClick={() => setSampleStatusFilter('shipped')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sampleStatusFilter === 'shipped' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                배송 중
              </button>
              <button
                onClick={() => setSampleStatusFilter('delivered')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sampleStatusFilter === 'delivered' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                배송 완료
              </button>
              <button
                onClick={() => setSampleStatusFilter('recovered')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sampleStatusFilter === 'recovered' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                반품 완료
              </button>
              <button
                onClick={() => setSampleStatusFilter('charged')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sampleStatusFilter === 'charged' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                결제 완료
              </button>
              <button
                onClick={() => setSampleStatusFilter('rejected')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sampleStatusFilter === 'rejected' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                반려
              </button>
            </div>

            {/* 날짜 범위 버튼 */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setSampleDateRangeFilter('today')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sampleDateRange === 'today' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                오늘
              </button>
              <button
                onClick={() => setSampleDateRangeFilter('1month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sampleDateRange === '1month' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                1개월
              </button>
              <button
                onClick={() => setSampleDateRangeFilter('3month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sampleDateRange === '3month' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                3개월
              </button>
              <button
                onClick={() => setSampleDateRangeFilter('6month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  sampleDateRange === '6month' 
                    ? 'bg-black text-white shadow-lg' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                6개월
              </button>
            </div>

            {/* 날짜 직접 입력 */}
            <div className="flex items-center gap-4">
              <input
                type="date"
                value={sampleSelectedDate}
                onChange={(e) => handleSampleDateChange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black"
              />
              <Button
                onClick={handleSampleSearch}
                className="bg-black hover:bg-gray-800 text-white px-6 py-2"
              >
                조회
              </Button>
            </div>
          </div>

          {sampleLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
              <p className="mt-4 text-gray-600">샘플 주문 목록을 불러오는 중...</p>
            </div>
          ) : sampleOrders.length === 0 ? (
            <div className="text-center py-16">
              <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                샘플 주문 내역이 없습니다
              </h3>
              <p className="text-gray-500 mb-6">
                상품 페이지에서 샘플을 주문해보세요.
              </p>
              <Button
                onClick={() => window.location.href = '/products'}
                className="bg-black hover:bg-gray-800 text-white"
              >
                상품 둘러보기
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {sampleOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        {getSampleStatusIcon(order.status)}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {order.sample_number}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        order.status_color === 'orange' ? 'bg-orange-100 text-orange-800' :
                        order.status_color === 'blue' ? 'bg-blue-100 text-blue-800' :
                        order.status_color === 'green' ? 'bg-green-100 text-green-800' :
                        order.status_color === 'red' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {order.status_text}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="text-xs text-gray-500 block">상품명</span>
                      <span className="text-sm font-medium text-gray-900">{order.product_name}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="text-xs text-gray-500 block">수량</span>
                      <span className="text-sm font-medium text-gray-900">{order.quantity}개</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <span className="text-xs text-gray-500 block">샘플 유형</span>
                      <span className="text-sm font-medium text-gray-900">
                        {order.sample_type === 'photography' ? '촬영용' : '판매용'}
                      </span>
                    </div>
                  </div>

                  {order.due_date && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <AlertTriangle className="h-4 w-4 text-yellow-600 mr-2" />
                        <span className="text-sm text-yellow-800">
                          반납 예정일: {formatDate(order.due_date)}
                          {getDaysUntilDue(order.due_date) > 0 && (
                            <span className="ml-2 font-medium">
                              (D-{getDaysUntilDue(order.due_date)})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {order.tracking_number && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                      <div className="flex items-center">
                        <Truck className="h-4 w-4 text-blue-600 mr-2" />
                        <span className="text-sm text-blue-800 font-medium mr-2">송장번호:</span>
                        {order.tracking_number === '미출고' ? (
                          <span className="text-sm text-gray-500">-</span>
                        ) : (
                          <button
                            onClick={() => window.open(`https://trace.cjlogistics.com/next/tracking.html?wblNo=${order.tracking_number}`, '_blank')}
                            className="text-sm text-blue-600 hover:text-blue-800 underline font-medium"
                          >
                            {order.tracking_number}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {order.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">{order.notes}</p>
                    </div>
                  )}
                </div>
              ))}

              {/* 페이지네이션 */}
              {sampleTotalPages > 1 && (
                <div className="flex justify-center items-center space-x-4 mt-12">
                  <Button
                    onClick={() => fetchSampleOrders(samplePage - 1)}
                    disabled={samplePage === 1}
                    variant="outline"
                    className="px-6"
                  >
                    이전
                  </Button>
                  <span className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg">
                    {samplePage} / {sampleTotalPages}
                  </span>
                  <Button
                    onClick={() => fetchSampleOrders(samplePage + 1)}
                    disabled={samplePage === sampleTotalPages}
                    variant="outline"
                    className="px-6"
                  >
                    다음
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 미발송 내역 탭 */}
      {activeTab === 'unshipped' && (
        <>
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">미발송 내역</h2>
            <p className="text-gray-600">주문하신 상품 중 미발송된 항목들을 확인하실 수 있습니다.</p>
          </div>

          {unshippedStatements.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                미발송 내역이 없습니다
              </h3>
              <p className="text-gray-500">
                모든 주문이 정상적으로 처리되었습니다.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {unshippedStatements.map((statement) => (
                <div
                  key={statement.id}
                  className="bg-white rounded-2xl border border-red-200 overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300"
                >
                  {/* 미발송 명세서 헤더 */}
                  <div className="p-6 bg-gradient-to-r from-red-50 to-white">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-red-100 rounded-lg">
                          <AlertTriangle className="h-6 w-6 text-red-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            미발송 명세서 {statement.statement_number}
                          </h3>
                          <p className="text-sm text-gray-500">
                            원 주문번호: {statement.orders?.order_number}
                          </p>
                          <p className="text-sm text-gray-500">
                            발생일: {formatDate(statement.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                          미발송
                        </span>
                        <p className="text-lg font-bold text-red-600 mt-2">
                          {formatCurrency(statement.total_unshipped_amount)}
                        </p>
                      </div>
                    </div>

                    {statement.reason && (
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                        <div className="flex items-start">
                          <AlertTriangle className="h-4 w-4 text-orange-600 mr-2 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-orange-800">미발송 사유</p>
                            <p className="text-sm text-orange-700">{statement.reason}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 미발송 상품 목록 */}
                  <div className="p-6">
                    <h4 className="text-md font-semibold text-gray-900 mb-4">미발송 상품 목록</h4>
                    <div className="space-y-3">
                      {statement.unshipped_statement_items?.map((item: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                        >
                          <div className="flex-1">
                            <h5 className="font-medium text-gray-900">{item.product_name}</h5>
                            <p className="text-sm text-gray-500">
                              {item.color} / {item.size}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">
                              주문: {item.ordered_quantity}개 / 
                              출고: {item.shipped_quantity}개 / 
                              <span className="text-red-600 font-medium">
                                미발송: {item.unshipped_quantity}개
                              </span>
                            </p>
                            <p className="text-sm font-medium text-gray-900">
                              {formatCurrency(item.total_amount)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 미발송 명세서 액션 */}
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        상태: {statement.status === 'pending' ? '처리 대기' : 
                               statement.status === 'processing' ? '처리 중' : 
                               statement.status === 'completed' ? '처리 완료' : '알 수 없음'}
                      </div>
                      <div className="flex space-x-3">
                        <Button
                          onClick={() => {
                            // 미발송 명세서 다운로드 기능 추가 예정
                            showInfo('미발송 명세서 다운로드 기능은 준비 중입니다.')
                          }}
                          variant="outline"
                          size="sm"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          명세서 다운로드
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}