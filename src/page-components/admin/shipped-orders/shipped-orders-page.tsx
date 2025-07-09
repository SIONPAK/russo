'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { formatCurrency, formatDateTime } from '@/shared/lib/utils'
import { 
  Download,
  FileText,
  Package,
  Calendar,
  Users,
  Search,
  ChevronDown,
  ArrowLeft
} from 'lucide-react'
import { showSuccess, showError, showInfo } from '@/shared/lib/toast'
import { useRouter } from 'next/navigation'

interface ShippedOrder {
  id: string
  order_number: string
  created_at: string
  shipped_at: string
  total_amount: number
  shipping_fee: number
  status: string
  tracking_number: string
  users: {
    id: string
    company_name: string
    representative_name: string
    phone: string
    email: string
  }
  order_items: Array<{
    id: string
    product_name: string
    color: string
    size: string
    quantity: number
    shipped_quantity: number
    unit_price: number
    products: {
      id: string
      name: string
      code: string
    }
  }>
}

export function ShippedOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<ShippedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
    return koreaTime.toISOString().split('T')[0]
  })
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [sortBy, setSortBy] = useState<'company_name' | 'shipped_at' | 'total_amount'>('shipped_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // 출고 완료된 주문 목록 조회
  const fetchShippedOrders = async (date?: string) => {
    try {
      setLoading(true)
      const searchDate = date || selectedDate
      
      const response = await fetch(`/api/admin/orders/shipped?date=${searchDate}`)
      const data = await response.json()
      
      if (data.success) {
        setOrders(data.data.orders || [])
      } else {
        showError(data.error || '출고 내역 조회에 실패했습니다.')
      }
    } catch (error) {
      console.error('출고 내역 조회 오류:', error)
      showError('출고 내역 조회 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 정렬된 주문 목록
  const sortedOrders = [...orders].sort((a, b) => {
    let aValue: any, bValue: any
    
    switch (sortBy) {
      case 'company_name':
        aValue = a.users?.company_name || ''
        bValue = b.users?.company_name || ''
        break
      case 'shipped_at':
        aValue = new Date(a.shipped_at).getTime()
        bValue = new Date(b.shipped_at).getTime()
        break
      case 'total_amount':
        aValue = a.total_amount
        bValue = b.total_amount
        break
      default:
        return 0
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })

  // 정렬 변경 핸들러
  const handleSort = (field: 'company_name' | 'shipped_at' | 'total_amount') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  // 주문 선택 토글
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  // 전체 선택 토글
  const toggleAllSelection = () => {
    if (selectedOrders.length === orders.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(orders.map(order => order.id))
    }
  }

  // 날짜 변경 핸들러
  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    fetchShippedOrders(date)
  }

  // 초기 로딩
  useEffect(() => {
    fetchShippedOrders()
  }, [])

  // 주문 관리로 돌아가기
  const handleBackToOrders = () => {
    router.push('/admin/orders')
  }

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">출고내역조회</h1>
            <p className="text-sm text-gray-600">
              출고 완료된 주문들을 조회하고 관리할 수 있습니다.
            </p>
          </div>
          <Button
            onClick={handleBackToOrders}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            주문관리로 돌아가기
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">총 출고 건수</p>
              <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
            </div>
            <Package className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">총 출고 금액</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(orders.reduce((sum, order) => sum + order.total_amount, 0))}
              </p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">출고 업체수</p>
              <p className="text-2xl font-bold text-purple-600">
                {new Set(orders.map(order => order.users?.company_name)).size}
              </p>
            </div>
            <Users className="w-8 h-8 text-purple-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">선택된 주문</p>
              <p className="text-2xl font-bold text-orange-600">{selectedOrders.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* 조회 날짜 및 액션 버튼 */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <label className="text-sm font-medium text-gray-700">출고 날짜:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-xs text-gray-500">
              * 출고 완료된 주문만 표시됩니다
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={() => {}}
              disabled={selectedOrders.length === 0}
              variant="outline"
            >
              <Download className="w-4 h-4 mr-2" />
              출고내역 엑셀 다운로드 ({selectedOrders.length})
            </Button>
          </div>
        </div>
      </div>

      {/* 출고 내역 테이블 */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selectedOrders.length === orders.length}
                    onChange={toggleAllSelection}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('company_name')}
                >
                  <div className="flex items-center gap-1">
                    업체명
                    {sortBy === 'company_name' && (
                      <span className="text-blue-600">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  발주번호
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('shipped_at')}
                >
                  <div className="flex items-center gap-1">
                    출고시간
                    {sortBy === 'shipped_at' && (
                      <span className="text-blue-600">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  출고 상품
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  운송장번호
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('total_amount')}
                >
                  <div className="flex items-center gap-1">
                    총 금액
                    {sortBy === 'total_amount' && (
                      <span className="text-blue-600">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-gray-500">로딩 중...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    선택한 날짜에 출고된 주문이 없습니다.
                  </td>
                </tr>
              ) : (
                sortedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.users?.company_name || '업체명 없음'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.users?.representative_name || ''}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{order.order_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDateTime(order.shipped_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        {order.order_items?.map((item, index) => (
                          <div key={index} className="text-sm border-b border-gray-100 pb-2 last:border-b-0">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">
                                  {item.products?.code || 'N/A'} | {item.product_name}
                                </div>
                                <div className="text-gray-600">
                                  {item.color} / {item.size}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                                    출고: {item.shipped_quantity}개
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    단가: {formatCurrency(item.unit_price)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {order.tracking_number || '미등록'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(order.total_amount)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 선택된 주문 정보 */}
      {selectedOrders.length > 0 && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-green-900 mb-2">
            선택된 출고 주문 정보 ({selectedOrders.length}건)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-green-700">총 출고 금액:</span>
              <span className="font-medium text-green-900 ml-2">
                {formatCurrency(
                  orders.filter(order => selectedOrders.includes(order.id))
                    .reduce((sum, order) => sum + order.total_amount, 0)
                )}
              </span>
            </div>
            <div>
              <span className="text-green-700">총 출고 수량:</span>
              <span className="font-medium text-green-900 ml-2">
                {orders.filter(order => selectedOrders.includes(order.id))
                  .reduce((sum, order) => 
                    sum + (order.order_items?.reduce((itemSum, item) => itemSum + item.shipped_quantity, 0) || 0), 0
                  )}개
              </span>
            </div>
            <div>
              <span className="text-green-700">업체 수:</span>
              <span className="font-medium text-green-900 ml-2">
                {new Set(orders.filter(order => selectedOrders.includes(order.id))
                  .map(order => order.users?.company_name)).size}개
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 