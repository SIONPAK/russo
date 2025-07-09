'use client'

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { 
  FileText, 
  Download, 
  Search, 
  Calendar,
  Eye,
  Receipt,
  CreditCard,
  RefreshCw
} from 'lucide-react'

interface Statement {
  id: string
  statement_number: string
  statement_type: 'transaction' | 'return' | 'deduction'
  total_amount: number
  reason?: string
  status: 'issued' | 'sent'
  created_at: string
  order_number: string
  items: Array<{
    id?: string
    product_name: string
    color: string
    size: string
    quantity: number
    unit_price: number
    total_price: number
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
    if (!isAuthenticated || !user || !('company_name' in user) || !(user as any).company_name) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        companyName: (user as any).company_name,
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
    if (isAuthenticated) {
      fetchStatements()
    }
  }, [isAuthenticated, currentPage, selectedType, dateRange])

  // 필터 변경 시 첫 페이지로 이동
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  useEffect(() => {
    handleFilterChange()
  }, [selectedType, dateRange])

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
      case 'issued': return '발행완료'
      case 'sent': return '발송완료'
      default: return status
    }
  }

  // 상태 색상 클래스
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'issued': return 'bg-green-100 text-green-800'
      case 'sent': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 명세서 다운로드
  const handleDownload = async (statement: Statement) => {
    if (!user || !('company_name' in user) || !(user as any).company_name) {
      alert('회사 정보를 찾을 수 없습니다.')
      return
    }

    try {
      const params = new URLSearchParams({
        company_name: (user as any).company_name
      })
      
      const response = await fetch(`/api/documents/${statement.id}/download?${params}`, {
        method: 'GET'
      })

      if (response.ok) {
        // 성공 시 바이너리 데이터로 파일 다운로드
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        // Content-Disposition 헤더에서 파일명 추출
        const contentDisposition = response.headers.get('Content-Disposition')
        let filename = `명세서_${statement.statement_number}.xlsx`
        
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/)
          if (filenameMatch) {
            filename = decodeURIComponent(filenameMatch[1])
          }
        }
        
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        alert('명세서가 다운로드되었습니다.')
      } else {
        // 실패 시 JSON으로 에러 메시지 처리
        const errorData = await response.json()
        alert('다운로드에 실패했습니다: ' + errorData.error)
      }
    } catch (error) {
      console.error('다운로드 오류:', error)
      alert('다운로드 중 오류가 발생했습니다.')
    }
  }

  // 페이지 변경
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h1>
          <p className="text-gray-600">명세서 관리를 하려면 로그인해주세요.</p>
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
        <Button onClick={fetchStatements} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
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
              <Receipt className="w-6 h-6 text-orange-600" />
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
              <CreditCard className="w-6 h-6 text-red-600" />
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
      <div className="bg-white rounded-lg border">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">명세서 목록을 불러오는 중...</p>
          </div>
        ) : statements.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>명세서가 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 테이블 헤더 */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-500">
                <div className="col-span-2">명세서 번호</div>
                <div className="col-span-2">타입</div>
                <div className="col-span-2">주문번호</div>
                <div className="col-span-2">금액</div>
                <div className="col-span-2">발행일</div>
                <div className="col-span-1">상태</div>
                <div className="col-span-1">액션</div>
              </div>
            </div>

            {/* 명세서 목록 */}
            <div className="divide-y divide-gray-200">
              {statements.map((statement) => (
                <div key={statement.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-900">
                        {statement.statement_number}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatementTypeClass(statement.statement_type)}`}>
                        {getStatementTypeText(statement.statement_type)}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-gray-900">{statement.order_number}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-gray-900">
                        {statement.total_amount.toLocaleString()}원
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">
                        {format(new Date(statement.created_at), 'yyyy-MM-dd', { locale: ko })}
                      </p>
                    </div>
                    <div className="col-span-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(statement.status)}`}>
                        {getStatusText(statement.status)}
                      </span>
                    </div>
                    <div className="col-span-1">
                      <Button
                        onClick={() => handleDownload(statement)}
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* 사유 표시 (반품/차감명세서) */}
                  {statement.reason && (
                    <div className="mt-2 ml-0">
                      <p className="text-xs text-gray-500">
                        사유: {statement.reason}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    총 {statements.length}건
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      variant="outline"
                      size="sm"
                    >
                      이전
                    </Button>
                    <span className="px-3 py-1 text-sm text-gray-700">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      size="sm"
                    >
                      다음
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
} 