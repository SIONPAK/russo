'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { formatCurrency, formatDateTime } from '@/shared/lib/utils'
import { showSuccess, showError } from '@/shared/lib/toast'
import { Search, Calendar, Filter } from 'lucide-react'

interface UnshippedItem {
  id: string
  product_name: string
  color: string
  size: string
  ordered_quantity: number
  shipped_quantity: number
  unshipped_quantity: number
  unit_price: number
  total_amount: number
}

interface UnshippedOrder {
  id: string
  statement_number: string
  order_id: string
  user_id: string
  total_unshipped_amount: number
  status: string
  reason: string
  created_at: string
  updated_at: string
  orders: {
    order_number: string
    created_at: string
  }
  users: {
    company_name: string
    representative_name: string
    email: string
    phone: string
  }
  unshipped_statement_items: UnshippedItem[]
}

export function UnshippedOrdersPage() {
  const [unshippedOrders, setUnshippedOrders] = useState<UnshippedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrders, setSelectedOrders] = useState<string[]>([])
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 10000 // 모든 데이터를 가져오기 위해 큰 값으로 설정
  })
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false
  })

  // 미출고 내역 조회
  const fetchUnshippedOrders = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString())
      })

      const response = await fetch(`/api/admin/unshipped-orders?${params}`)
      const result = await response.json()

      if (result.success) {
        setUnshippedOrders(result.data.unshippedOrders)
        setPagination(result.data.pagination)
      } else {
        showError(result.error || '미출고 내역을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('미출고 내역 조회 실패:', error)
      showError('미출고 내역을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 필터 업데이트
  const updateFilters = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }))
  }

  // 페이지 변경
  const changePage = (page: number) => {
    setFilters(prev => ({ ...prev, page }))
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
    if (selectedOrders.length === unshippedOrders.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(unshippedOrders.map(order => order.id))
    }
  }



  // 상태 텍스트 반환
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기중'
      case 'notified': return '통보완료'
      case 'resolved': return '해결완료'
      case 'cancelled': return '취소됨'
      default: return status
    }
  }

  // 상태 색상 반환
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'notified': return 'text-blue-600 bg-blue-100'
      case 'resolved': return 'text-green-600 bg-green-100'
      case 'cancelled': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  useEffect(() => {
    fetchUnshippedOrders()
  }, [filters])

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">미출고 내역 조회</h1>
        <p className="text-sm text-gray-600">
          재고 부족 등으로 출고되지 못한 주문들을 관리합니다.
        </p>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="업체명 또는 주문번호로 검색..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.status}
              onChange={(e) => updateFilters({ status: e.target.value })}
            >
              <option value="all">전체 상태</option>
              <option value="pending">대기중</option>
              <option value="notified">통보완료</option>
              <option value="resolved">해결완료</option>
              <option value="cancelled">취소됨</option>
            </select>
            
            <input
              type="date"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.startDate}
              onChange={(e) => updateFilters({ startDate: e.target.value })}
            />
            
            <input
              type="date"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={filters.endDate}
              onChange={(e) => updateFilters({ endDate: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            총 {pagination.totalCount}건의 미출고 명세서
          </span>
          {selectedOrders.length > 0 && (
            <span className="text-sm text-blue-600">
              {selectedOrders.length}건 선택됨
            </span>
          )}
        </div>
        
        <div className="flex gap-2">
          {/* 이메일 발송 기능 제거됨 */}
        </div>
      </div>

      {/* 미출고 내역 테이블 */}
      <div className="bg-white rounded-lg shadow border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedOrders.length === unshippedOrders.length && unshippedOrders.length > 0}
                    onChange={toggleAllSelection}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  업체정보
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  주문번호
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  미출고 상품
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  미출고 금액
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  생성일시
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
              ) : unshippedOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    미출고 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                unshippedOrders.map((order) => (
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
                        {order.users.company_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.users.representative_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.users.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {order.orders.order_number}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDateTime(order.orders.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {order.unshipped_statement_items.map((item, index) => (
                          <div key={index} className="text-sm">
                            <div className="font-medium text-gray-900">
                              {item.product_name}
                            </div>
                            <div className="text-gray-600">
                              {item.color} / {item.size} - {item.unshipped_quantity}개
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(order.total_unshipped_amount)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDateTime(order.created_at)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <div className="text-sm text-gray-700">
            {pagination.totalCount}개 중 {(pagination.currentPage - 1) * filters.limit + 1}-{Math.min(pagination.currentPage * filters.limit, pagination.totalCount)}개 표시
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasPrevPage}
              onClick={() => changePage(pagination.currentPage - 1)}
            >
              이전
            </Button>
            
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === pagination.currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => changePage(page)}
              >
                {page}
              </Button>
            ))}
            
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.hasNextPage}
              onClick={() => changePage(pagination.currentPage + 1)}
            >
              다음
            </Button>
          </div>
        </div>
      )}
    </div>
  )
} 