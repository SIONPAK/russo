'use client'

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { formatDateTime } from '@/shared/lib/utils'
import { 
  FileText, 
  Download, 
  Search, 
  Calendar,
  Eye,
  Receipt,
  CreditCard
} from 'lucide-react'

interface Statement {
  id: string
  statement_number: string
  statement_type: 'transaction' | 'return' | 'deduction'
  total_amount: number
  reason?: string
  notes?: string
  status: 'draft' | 'issued' | 'sent'
  created_at: string
  orders?: {
    order_number: string
    created_at: string
  }
  statement_items: Array<{
    id: string
    product_name: string
    product_code: string
    color: string
    size: string
    quantity: number
    unit_price: number
    supply_amount: number
    vat_amount: number
  }>
}

interface Statistics {
  transaction: { count: number; total: number }
  return: { count: number; total: number }
  deduction: { count: number; total: number }
}

export function DocumentsPage() {
  const { isAuthenticated, user } = useAuthStore()
  const [statements, setStatements] = useState<Statement[]>([])
  const [statistics, setStatistics] = useState<Statistics>({
    transaction: { count: 0, total: 0 },
    return: { count: 0, total: 0 },
    deduction: { count: 0, total: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // 명세서 목록 조회
  const fetchStatements = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        userId: user.id,
        page: currentPage.toString(),
        limit: '20',
        type: selectedType,
        startDate: dateRange.start,
        endDate: dateRange.end
      })

      const response = await fetch(`/api/documents?${params}`)
      const data = await response.json()

      if (data.success) {
        setStatements(data.data.statements)
        setStatistics(data.data.statistics)
        setTotalPages(data.data.pagination.totalPages)
      } else {
        console.error('명세서 조회 실패:', data.error)
      }
    } catch (error) {
      console.error('명세서 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.id) {
      fetchStatements()
    }
  }, [user?.id, currentPage, selectedType, dateRange])

  // 명세서 타입 텍스트 변환
  const getStatementTypeText = (type: string) => {
    switch (type) {
      case 'transaction': return '거래명세서'
      case 'return': return '반품명세서'
      case 'deduction': return '차감명세서'
      default: return type
    }
  }

  // 명세서 타입 색상 클래스
  const getStatementTypeClass = (type: string) => {
    switch (type) {
      case 'transaction': return 'bg-blue-100 text-blue-800'
      case 'return': return 'bg-orange-100 text-orange-800'
      case 'deduction': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 상태 텍스트 변환
  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return '임시저장'
      case 'issued': return '발행완료'
      case 'sent': return '발송완료'
      default: return status
    }
  }

  // 상태 색상 클래스
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'issued': return 'bg-green-100 text-green-800'
      case 'sent': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 명세서 다운로드
  const handleDownload = async (statement: Statement) => {
    try {
      const response = await fetch(`/api/documents/${statement.id}/download`, {
        method: 'GET'
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${getStatementTypeText(statement.statement_type)}_${statement.statement_number}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const errorData = await response.json()
        alert('다운로드에 실패했습니다: ' + errorData.error)
      }
    } catch (error) {
      console.error('다운로드 오류:', error)
      alert('다운로드 중 오류가 발생했습니다.')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h1>
          <p className="text-gray-600">문서 관리를 하려면 로그인해주세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">명세서 관리</h1>
          <p className="text-gray-600">거래명세서, 반품명세서, 차감명세서를 확인할 수 있습니다.</p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">거래명세서</p>
              <p className="text-2xl font-bold text-blue-600">{statistics.transaction.count}건</p>
              <p className="text-sm text-gray-500">총 {statistics.transaction.total.toLocaleString()}원</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">반품명세서</p>
              <p className="text-2xl font-bold text-orange-600">{statistics.return.count}건</p>
              <p className="text-sm text-gray-500">총 {statistics.return.total.toLocaleString()}원</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-full">
              <FileText className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">차감명세서</p>
              <p className="text-2xl font-bold text-red-600">{statistics.deduction.count}건</p>
              <p className="text-sm text-gray-500">총 {statistics.deduction.total.toLocaleString()}원</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <FileText className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              명세서 타입
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              <option value="transaction">거래명세서</option>
              <option value="return">반품명세서</option>
              <option value="deduction">차감명세서</option>
            </select>
          </div>

          <div className="flex items-end space-x-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시작일
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료일
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 명세서 목록 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  명세서 번호
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  타입
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  주문번호
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  금액
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  발행일
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : statements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    명세서가 없습니다.
                  </td>
                </tr>
              ) : (
                statements.map((statement) => (
                  <tr key={statement.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {statement.statement_number}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatementTypeClass(statement.statement_type)}`}>
                        {getStatementTypeText(statement.statement_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {statement.orders?.order_number || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">
                      <span className={statement.statement_type === 'deduction' ? 'text-red-600' : 'text-gray-900'}>
                        {statement.total_amount.toLocaleString()}원
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(statement.status)}`}>
                        {getStatusText(statement.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(statement.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(statement)}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        다운로드
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            이전
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? 'default' : 'outline'}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </Button>
          ))}
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            다음
          </Button>
        </div>
      )}
    </div>
  )
} 