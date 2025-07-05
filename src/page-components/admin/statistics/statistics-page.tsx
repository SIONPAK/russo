'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { formatDateTime } from '@/shared/lib/utils'
import { showError } from '@/shared/lib/toast'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users,
  Package,
  ShoppingCart,
  DollarSign,
  Calendar,
  Star,
  Truck,
  RefreshCw,
  Download,
  Eye,
  AlertTriangle
} from 'lucide-react'

interface StatisticsData {
  overview: {
    totalOrders: number
    totalRevenue: number
    totalCustomers: number
    totalProducts: number
    pendingShipments: number
    returnStatements: number
  }
  orderStats: {
    pending: number
    confirmed: number
    shipped: number
    delivered: number
    cancelled: number
  }
  customerGradeStats: {
    premium: {
      count: number
      orders: number
      revenue: number
    }
    vip: {
      count: number
      orders: number
      revenue: number
    }
    general: {
      count: number
      orders: number
      revenue: number
    }
  }
  dailyStats: {
    date: string
    orders: number
    revenue: number
    newCustomers: number
  }[]
  topProducts: {
    id: string
    name: string
    orders: number
    revenue: number
    stock: number
  }[]
  topCustomers: {
    id: string
    companyName: string
    grade: string
    orders: number
    revenue: number
    lastOrderDate: string
  }[]
}

export default function StatisticsPage() {
  const [stats, setStats] = useState<StatisticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    startDate: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  })

  useEffect(() => {
    fetchStatistics()
  }, [dateRange])

  const fetchStatistics = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      })

      const response = await fetch(`/api/admin/statistics?${params}`)
      const result = await response.json()

      if (result.success) {
        setStats(result.data)
      } else {
        console.error('Failed to fetch statistics:', result.error)
      }
    } catch (error) {
      console.error('Error fetching statistics:', error)
    } finally {
      setLoading(false)
    }
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'premium': return 'text-purple-600'
      case 'vip': return 'text-amber-600'
      case 'general': return 'text-gray-600'
      default: return 'text-gray-600'
    }
  }

  const getGradeBadge = (grade: string) => {
    switch (grade) {
      case 'premium': return '⭐'
      case 'vip': return '👑'
      case 'general': return ''
      default: return ''
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">통계 데이터를 불러오는 중...</span>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">
          통계 데이터를 불러올 수 없습니다.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📊 통계 대시보드</h1>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">시작일</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              className="p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">종료일</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              className="p-2 border rounded"
            />
          </div>
          <button
            onClick={fetchStatistics}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 mt-6"
          >
            조회
          </button>
        </div>
      </div>

      {/* 전체 현황 */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">총 주문</h3>
          <p className="text-2xl font-bold text-blue-600">{stats.overview.totalOrders.toLocaleString()}건</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">총 매출</h3>
          <p className="text-2xl font-bold text-green-600">{stats.overview.totalRevenue.toLocaleString()}원</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">총 고객</h3>
          <p className="text-2xl font-bold text-purple-600">{stats.overview.totalCustomers.toLocaleString()}명</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">총 상품</h3>
          <p className="text-2xl font-bold text-indigo-600">{stats.overview.totalProducts.toLocaleString()}개</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">미출고</h3>
          <p className="text-2xl font-bold text-red-600">{stats.overview.pendingShipments.toLocaleString()}건</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">반품</h3>
          <p className="text-2xl font-bold text-orange-600">{stats.overview.returnStatements.toLocaleString()}건</p>
        </div>
      </div>

      {/* 주문 상태별 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">주문 상태별 현황</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">접수</span>
              <span className="font-medium text-yellow-600">{stats.orderStats.pending.toLocaleString()}건</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">확인</span>
              <span className="font-medium text-blue-600">{stats.orderStats.confirmed.toLocaleString()}건</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">배송중</span>
              <span className="font-medium text-purple-600">{stats.orderStats.shipped.toLocaleString()}건</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">배송완료</span>
              <span className="font-medium text-green-600">{stats.orderStats.delivered.toLocaleString()}건</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">취소</span>
              <span className="font-medium text-red-600">{stats.orderStats.cancelled.toLocaleString()}건</span>
            </div>
          </div>
        </div>

        {/* 고객 등급별 통계 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">고객 등급별 현황</h2>
          <div className="space-y-4">
            <div className="border-l-4 border-purple-500 pl-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-purple-600 font-medium">⭐ 우수업체</span>
                <span className="text-sm text-gray-500">{stats.customerGradeStats.premium.count}명</span>
              </div>
              <div className="text-sm text-gray-600">
                주문: {stats.customerGradeStats.premium.orders.toLocaleString()}건 / 
                매출: {stats.customerGradeStats.premium.revenue.toLocaleString()}원
              </div>
            </div>
            <div className="border-l-4 border-amber-500 pl-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-amber-600 font-medium">👑 VIP 고객</span>
                <span className="text-sm text-gray-500">{stats.customerGradeStats.vip.count}명</span>
              </div>
              <div className="text-sm text-gray-600">
                주문: {stats.customerGradeStats.vip.orders.toLocaleString()}건 / 
                매출: {stats.customerGradeStats.vip.revenue.toLocaleString()}원
              </div>
            </div>
            <div className="border-l-4 border-gray-500 pl-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-600 font-medium">일반 고객</span>
                <span className="text-sm text-gray-500">{stats.customerGradeStats.general.count}명</span>
              </div>
              <div className="text-sm text-gray-600">
                주문: {stats.customerGradeStats.general.orders.toLocaleString()}건 / 
                매출: {stats.customerGradeStats.general.revenue.toLocaleString()}원
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 일별 통계 */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-lg font-semibold mb-4">일별 통계 (최근 7일)</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">날짜</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">주문수</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">매출</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">신규고객</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.dailyStats.slice(-7).map((day) => (
                <tr key={day.date}>
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {format(new Date(day.date), 'yyyy-MM-dd (E)', { locale: ko })}
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-blue-600">
                    {day.orders.toLocaleString()}건
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-green-600">
                    {day.revenue.toLocaleString()}원
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-purple-600">
                    {day.newCustomers.toLocaleString()}명
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 인기 상품 & 주요 고객 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 인기 상품 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">인기 상품 TOP 10</h2>
          <div className="space-y-3">
            {stats.topProducts.map((product, index) => (
              <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div>
                    <div className="font-medium text-gray-900">{product.name}</div>
                    <div className="text-sm text-gray-500">재고: {product.stock.toLocaleString()}개</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-blue-600">{product.orders.toLocaleString()}건</div>
                  <div className="text-xs text-gray-500">{product.revenue.toLocaleString()}원</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 주요 고객 */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">주요 고객 TOP 10</h2>
          <div className="space-y-3">
            {stats.topCustomers.map((customer, index) => (
              <div key={customer.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-purple-500 text-white text-xs rounded-full flex items-center justify-center">
                    {index + 1}
                  </span>
                  <div>
                    <div className={`font-medium ${getGradeColor(customer.grade)}`}>
                      {getGradeBadge(customer.grade)} {customer.companyName}
                    </div>
                    <div className="text-sm text-gray-500">
                      최근주문: {format(new Date(customer.lastOrderDate), 'yyyy-MM-dd', { locale: ko })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-purple-600">{customer.orders.toLocaleString()}건</div>
                  <div className="text-xs text-gray-500">{customer.revenue.toLocaleString()}원</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 