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
  Download,
  FileText,
  Calendar,
  Package,
  Eye,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react'

interface ReturnStatement {
  id: string
  order_id: string
  order_number: string
  company_name: string
  customer_grade: string
  return_type: 'wrong_delivery' | 'missing_item' | 'defective' | 'customer_change'
  return_reason: string
  created_at: string
  processed_at: string | null
  mileage_compensated: boolean
  mileage_amount: number
  status: 'pending' | 'processing' | 'completed'
  items: {
    product_name: string
    color: string
    size: string
    return_quantity: number
    unit_price: number
    total_price: number
  }[]
  total_amount: number
}

export default function ReturnStatementsPage() {
  const [statements, setStatements] = useState<ReturnStatement[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatements, setSelectedStatements] = useState<string[]>([])
  const [filters, setFilters] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    companyName: '',
    returnType: 'all',
    status: 'all'
  })
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchStatements()
  }, [filters])

  const fetchStatements = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate,
        companyName: filters.companyName,
        returnType: filters.returnType,
        status: filters.status
      })

      const response = await fetch(`/api/admin/orders/return-statement?${params}`)
      const result = await response.json()

      if (result.success) {
        setStatements(Array.isArray(result.data) ? result.data : [])
      } else {
        console.error('Failed to fetch return statements:', result.error)
        setStatements([])
      }
    } catch (error) {
      console.error('Error fetching return statements:', error)
      setStatements([])
    } finally {
      setLoading(false)
    }
  }

  const handleProcessReturn = async (statementIds: string[]) => {
    if (statementIds.length === 0) {
      alert('처리할 반품을 선택해주세요.')
      return
    }

    if (!confirm(`선택된 ${statementIds.length}건의 반품을 처리하시겠습니까?\n(마일리지 보상이 자동으로 지급됩니다)`)) {
      return
    }

    try {
      setProcessing(true)
      const response = await fetch('/api/admin/orders/return-statement/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statementIds })
      })

      const result = await response.json()

      if (result.success) {
        alert(`반품 처리 완료: 성공 ${result.data.processed}건, 총 마일리지 지급 ${result.data.totalMileage.toLocaleString()}P`)
        await fetchStatements()
        setSelectedStatements([])
      } else {
        alert(`반품 처리 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Return process error:', error)
      alert('반품 처리 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const handleStatementDownload = async (statementId: string) => {
    try {
      const response = await fetch(`/api/admin/orders/return-statement/${statementId}/download`)
      const result = await response.json()

      if (result.success) {
        const link = document.createElement('a')
        link.href = result.data.downloadUrl
        link.download = result.data.filename
        link.click()
      } else {
        alert(`다운로드 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('다운로드 중 오류가 발생했습니다.')
    }
  }

  const toggleStatementSelection = (statementId: string) => {
    setSelectedStatements(prev => 
      prev.includes(statementId) 
        ? prev.filter(id => id !== statementId)
        : [...prev, statementId]
    )
  }

  const toggleAllSelection = () => {
    if (!Array.isArray(statements)) return
    setSelectedStatements(prev => 
      prev.length === statements.length ? [] : statements.map(s => s.id)
    )
  }

  const getReturnTypeText = (type: string) => {
    switch (type) {
      case 'wrong_delivery': return '오배송'
      case 'missing_item': return '누락'
      case 'defective': return '불량'
      case 'customer_change': return '고객변심'
      default: return '기타'
    }
  }

  const getReturnTypeColor = (type: string) => {
    switch (type) {
      case 'wrong_delivery': return 'bg-red-100 text-red-800'
      case 'missing_item': return 'bg-orange-100 text-orange-800'
      case 'defective': return 'bg-yellow-100 text-yellow-800'
      case 'customer_change': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기중'
      case 'processing': return '처리중'
      case 'completed': return '완료'
      default: return '알 수 없음'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'processing': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">🔄 반품 명세서 관리</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleProcessReturn(selectedStatements)}
            disabled={processing || selectedStatements.length === 0}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            {processing ? '처리 중...' : `선택 반품 처리 (${selectedStatements.length})`}
          </button>
          <button
            onClick={fetchStatements}
            disabled={loading}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">시작일</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">종료일</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full p-2 border rounded"
            />
          </div>
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
            <label className="block text-sm font-medium mb-1">반품 유형</label>
            <select
              value={filters.returnType}
              onChange={(e) => setFilters(prev => ({ ...prev, returnType: e.target.value }))}
              className="w-full p-2 border rounded"
            >
              <option value="all">전체</option>
              <option value="wrong_delivery">오배송</option>
              <option value="missing_item">누락</option>
              <option value="defective">불량</option>
              <option value="customer_change">고객변심</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">처리 상태</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full p-2 border rounded"
            >
              <option value="all">전체</option>
              <option value="pending">대기중</option>
              <option value="processing">처리중</option>
              <option value="completed">완료</option>
            </select>
          </div>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">총 반품</h3>
          <p className="text-2xl font-bold text-blue-600">{statements.length}건</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">대기중</h3>
          <p className="text-2xl font-bold text-yellow-600">
            {Array.isArray(statements) ? statements.filter(s => s.status === 'pending').length : 0}건
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">처리중</h3>
          <p className="text-2xl font-bold text-blue-600">
            {Array.isArray(statements) ? statements.filter(s => s.status === 'processing').length : 0}건
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">완료</h3>
          <p className="text-2xl font-bold text-green-600">
            {Array.isArray(statements) ? statements.filter(s => s.status === 'completed').length : 0}건
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">총 반품금액</h3>
          <p className="text-2xl font-bold text-red-600">
            {statements.reduce((sum, s) => sum + s.total_amount, 0).toLocaleString()}원
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">마일리지 지급</h3>
          <p className="text-2xl font-bold text-purple-600">
            {Array.isArray(statements) ? statements.reduce((sum, s) => sum + s.mileage_amount, 0).toLocaleString() : 0}P
          </p>
        </div>
      </div>

      {/* 반품 목록 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedStatements.length === statements.length && statements.length > 0}
                    onChange={toggleAllSelection}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">주문번호</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">업체명</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">반품 유형</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">반품 사유</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">반품금액</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">마일리지</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">상태</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : statements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    반품 명세서가 없습니다.
                  </td>
                </tr>
              ) : (
                statements.map((statement) => (
                  <tr key={statement.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedStatements.includes(statement.id)}
                        onChange={() => toggleStatementSelection(statement.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {statement.order_number}
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(statement.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm font-medium ${getGradeColor(statement.customer_grade)}`}>
                        {getGradeBadge(statement.customer_grade)} {statement.company_name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getReturnTypeColor(statement.return_type)}`}>
                        {getReturnTypeText(statement.return_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={statement.return_reason}>
                        {statement.return_reason}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {statement.total_amount.toLocaleString()}원
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${statement.mileage_compensated ? 'text-green-600' : 'text-gray-400'}`}>
                          {statement.mileage_amount.toLocaleString()}P
                        </span>
                        {statement.mileage_compensated && (
                          <span className="text-xs text-green-600">✓</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(statement.status)}`}>
                        {getStatusText(statement.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatementDownload(statement.id)}
                          className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          다운로드
                        </button>
                        {statement.status === 'pending' && (
                          <button
                            onClick={() => handleProcessReturn([statement.id])}
                            disabled={processing}
                            className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
                          >
                            처리
                          </button>
                        )}
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