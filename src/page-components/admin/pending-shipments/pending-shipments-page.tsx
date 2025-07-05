'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { showSuccess, showError } from '@/shared/lib/toast'
import { 
  Search, 
  Filter, 
  Truck,
  Clock,
  AlertTriangle,
  CheckCircle,
  Star,
  Package,
  Calendar,
  RefreshCw
} from 'lucide-react'

interface PendingShipment {
  id: string
  order_id: string
  order_number: string
  company_name: string
  customer_grade: string
  product_name: string
  color: string
  size: string
  ordered_quantity: number
  shipped_quantity: number
  pending_quantity: number
  unit_price: number
  total_pending_amount: number
  priority_level: number
  auto_ship_enabled: boolean
  created_at: string
  expected_restock_date: string | null
  notes: string | null
}

export default function PendingShipmentsPage() {
  const [shipments, setShipments] = useState<PendingShipment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedShipments, setSelectedShipments] = useState<string[]>([])
  const [filters, setFilters] = useState({
    companyName: '',
    productName: '',
    priority: 'all',
    autoShip: 'all'
  })
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchShipments()
  }, [filters])

  const fetchShipments = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        companyName: filters.companyName,
        productName: filters.productName,
        priority: filters.priority,
        autoShip: filters.autoShip
      })

      const response = await fetch(`/api/admin/orders/pending-shipments?${params}`)
      const result = await response.json()

      if (result.success) {
        setShipments(result.data)
      } else {
        console.error('Failed to fetch pending shipments:', result.error)
      }
    } catch (error) {
      console.error('Error fetching pending shipments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAutoShipToggle = async (shipmentIds: string[], enabled: boolean) => {
    if (shipmentIds.length === 0) {
      alert('설정할 미출고를 선택해주세요.')
      return
    }

    const action = enabled ? '활성화' : '비활성화'
    if (!confirm(`선택된 ${shipmentIds.length}건의 자동 출고를 ${action}하시겠습니까?`)) {
      return
    }

    try {
      setProcessing(true)
      const response = await fetch('/api/admin/orders/pending-shipments/auto-ship', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ shipmentIds, enabled })
      })

      const result = await response.json()

      if (result.success) {
        alert(`자동 출고 ${action} 완료: ${result.data.updated}건`)
        await fetchShipments()
        setSelectedShipments([])
      } else {
        alert(`자동 출고 ${action} 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Auto ship toggle error:', error)
      alert(`자동 출고 ${action} 중 오류가 발생했습니다.`)
    } finally {
      setProcessing(false)
    }
  }

  const handlePriorityUpdate = async (shipmentIds: string[], priority: number) => {
    if (shipmentIds.length === 0) {
      alert('우선순위를 변경할 미출고를 선택해주세요.')
      return
    }

    const priorityText = getPriorityText(priority)
    if (!confirm(`선택된 ${shipmentIds.length}건의 우선순위를 '${priorityText}'로 변경하시겠습니까?`)) {
      return
    }

    try {
      setProcessing(true)
      const response = await fetch('/api/admin/orders/pending-shipments/priority', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ shipmentIds, priority })
      })

      const result = await response.json()

      if (result.success) {
        alert(`우선순위 변경 완료: ${result.data.updated}건`)
        await fetchShipments()
        setSelectedShipments([])
      } else {
        alert(`우선순위 변경 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Priority update error:', error)
      alert('우선순위 변경 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const handleManualShip = async (shipmentId: string) => {
    const shipment = shipments.find(s => s.id === shipmentId)
    if (!shipment) return

    const quantity = prompt(`수동 출고 수량을 입력하세요 (최대 ${shipment.pending_quantity}개):`)
    if (!quantity || isNaN(Number(quantity))) return

    const shipQuantity = Number(quantity)
    if (shipQuantity <= 0 || shipQuantity > shipment.pending_quantity) {
      alert('올바른 수량을 입력해주세요.')
      return
    }

    if (!confirm(`${shipment.product_name} (${shipment.color}/${shipment.size}) ${shipQuantity}개를 수동 출고하시겠습니까?`)) {
      return
    }

    try {
      setProcessing(true)
      const response = await fetch('/api/admin/orders/pending-shipments/manual-ship', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ shipmentId, quantity: shipQuantity })
      })

      const result = await response.json()

      if (result.success) {
        alert(`수동 출고 완료: ${result.data.shipped}개`)
        await fetchShipments()
      } else {
        alert(`수동 출고 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Manual ship error:', error)
      alert('수동 출고 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const toggleShipmentSelection = (shipmentId: string) => {
    setSelectedShipments(prev => 
      prev.includes(shipmentId) 
        ? prev.filter(id => id !== shipmentId)
        : [...prev, shipmentId]
    )
  }

  const toggleAllSelection = () => {
    setSelectedShipments(prev => 
      prev.length === shipments.length ? [] : shipments.map(s => s.id)
    )
  }

  const getPriorityText = (priority: number) => {
    switch (priority) {
      case 3: return '긴급'
      case 2: return '우수업체'
      case 1: return '일반'
      default: return '알 수 없음'
    }
  }

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 3: return 'bg-red-100 text-red-800'
      case 2: return 'bg-purple-100 text-purple-800'
      case 1: return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'premium': return 'text-purple-600 font-bold'
      case 'vip': return 'text-amber-600 font-bold'
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

  // 우선순위별로 정렬
  const sortedShipments = [...shipments].sort((a, b) => {
    if (a.priority_level !== b.priority_level) {
      return b.priority_level - a.priority_level // 높은 우선순위 먼저
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime() // 오래된 것 먼저
  })

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📦 미출고 관리</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleAutoShipToggle(selectedShipments, true)}
            disabled={processing || selectedShipments.length === 0}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            자동출고 활성화
          </button>
          <button
            onClick={() => handleAutoShipToggle(selectedShipments, false)}
            disabled={processing || selectedShipments.length === 0}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:bg-gray-300"
          >
            자동출고 비활성화
          </button>
          <button
            onClick={fetchShipments}
            disabled={loading}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">업체명</label>
            <input
              type="text"
              value={filters.companyName}
              onChange={(e) => setFilters(prev => ({ ...prev, companyName: e.target.value }))}
              placeholder="업체명 검색"
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">상품명</label>
            <input
              type="text"
              value={filters.productName}
              onChange={(e) => setFilters(prev => ({ ...prev, productName: e.target.value }))}
              placeholder="상품명 검색"
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">우선순위</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
              className="w-full p-2 border rounded"
            >
              <option value="all">전체</option>
              <option value="3">긴급</option>
              <option value="2">우수업체</option>
              <option value="1">일반</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">자동 출고</label>
            <select
              value={filters.autoShip}
              onChange={(e) => setFilters(prev => ({ ...prev, autoShip: e.target.value }))}
              className="w-full p-2 border rounded"
            >
              <option value="all">전체</option>
              <option value="enabled">활성화</option>
              <option value="disabled">비활성화</option>
            </select>
          </div>
        </div>
      </div>

      {/* 우선순위 변경 버튼 */}
      {selectedShipments.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h3 className="text-sm font-medium mb-3">선택된 {selectedShipments.length}건의 우선순위 변경</h3>
          <div className="flex gap-2">
            <button
              onClick={() => handlePriorityUpdate(selectedShipments, 3)}
              disabled={processing}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300"
            >
              긴급으로 변경
            </button>
            <button
              onClick={() => handlePriorityUpdate(selectedShipments, 2)}
              disabled={processing}
              className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300"
            >
              우수업체로 변경
            </button>
            <button
              onClick={() => handlePriorityUpdate(selectedShipments, 1)}
              disabled={processing}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:bg-gray-300"
            >
              일반으로 변경
            </button>
          </div>
        </div>
      )}

      {/* 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">총 미출고</h3>
          <p className="text-2xl font-bold text-red-600">{shipments.length}건</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">긴급</h3>
          <p className="text-2xl font-bold text-red-600">
            {shipments.filter(s => s.priority_level === 3).length}건
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">우수업체</h3>
          <p className="text-2xl font-bold text-purple-600">
            {shipments.filter(s => s.priority_level === 2).length}건
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">자동출고 활성화</h3>
          <p className="text-2xl font-bold text-green-600">
            {shipments.filter(s => s.auto_ship_enabled).length}건
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">총 미출고 금액</h3>
          <p className="text-2xl font-bold text-orange-600">
            {shipments.reduce((sum, s) => sum + s.total_pending_amount, 0).toLocaleString()}원
          </p>
        </div>
      </div>

      {/* 미출고 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedShipments.length === shipments.length && shipments.length > 0}
                    onChange={toggleAllSelection}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">우선순위</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">주문번호</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">업체명</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">상품정보</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">수량</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">미출고 금액</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">자동출고</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">등록일</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : sortedShipments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    미출고 상품이 없습니다.
                  </td>
                </tr>
              ) : (
                sortedShipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedShipments.includes(shipment.id)}
                        onChange={() => toggleShipmentSelection(shipment.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(shipment.priority_level)}`}>
                        {getPriorityText(shipment.priority_level)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {shipment.order_number}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm font-medium ${getGradeColor(shipment.customer_grade)}`}>
                        {getGradeBadge(shipment.customer_grade)} {shipment.company_name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        <div className="font-medium">{shipment.product_name}</div>
                        <div className="text-xs text-gray-500">
                          {shipment.color} / {shipment.size}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        <div>주문: {shipment.ordered_quantity}개</div>
                        <div>출고: {shipment.shipped_quantity}개</div>
                        <div className="font-medium text-red-600">
                          미출고: {shipment.pending_quantity}개
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {shipment.total_pending_amount.toLocaleString()}원
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        shipment.auto_ship_enabled 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {shipment.auto_ship_enabled ? '활성화' : '비활성화'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {format(new Date(shipment.created_at), 'yyyy-MM-dd', { locale: ko })}
                      </div>
                      {shipment.expected_restock_date && (
                        <div className="text-xs text-blue-600">
                          예상입고: {format(new Date(shipment.expected_restock_date), 'MM-dd')}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleManualShip(shipment.id)}
                          disabled={processing}
                          className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                        >
                          수동출고
                        </button>
                        <button
                          onClick={() => handleAutoShipToggle([shipment.id], !shipment.auto_ship_enabled)}
                          disabled={processing}
                          className={`px-3 py-1 text-xs rounded disabled:bg-gray-300 ${
                            shipment.auto_ship_enabled
                              ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                              : 'bg-green-500 text-white hover:bg-green-600'
                          }`}
                        >
                          {shipment.auto_ship_enabled ? '비활성화' : '활성화'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
} 