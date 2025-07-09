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
  Mail,
  Archive,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'

interface UnshippedStatement {
  id: string
  statement_number: string
  order_id: string
  user_id: string
  total_unshipped_amount: number
  status: 'pending' | 'notified' | 'resolved' | 'cancelled'
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
  unshipped_statement_items: {
    id: string
    product_name: string
    color: string
    size: string
    ordered_quantity: number
    shipped_quantity: number
    unshipped_quantity: number
    unit_price: number
    total_amount: number
  }[]
}

export default function UnshippedStatementsPage() {
  const [statements, setStatements] = useState<UnshippedStatement[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatements, setSelectedStatements] = useState<string[]>([])
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    startDate: '',
    endDate: ''
  })
  const [emailSending, setEmailSending] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    fetchStatements()
  }, [filters, currentPage])

  const fetchStatements = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        search: filters.search,
        status: filters.status,
        startDate: filters.startDate,
        endDate: filters.endDate
      })

      const response = await fetch(`/api/admin/unshipped-statements?${params}`)
      const result = await response.json()

      if (result.success) {
        setStatements(result.data.statements || [])
        setTotalPages(result.data.pagination?.totalPages || 1)
        setTotalCount(result.data.pagination?.totalCount || 0)
      } else {
        console.error('Failed to fetch statements:', result.error)
        setStatements([])
      }
    } catch (error) {
      console.error('Error fetching statements:', error)
      setStatements([])
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSend = async (statementIds: string[]) => {
    if (statementIds.length === 0) {
      showError('발송할 명세서를 선택해주세요.')
      return
    }

    if (!confirm(`선택된 ${statementIds.length}건의 미출고 명세서를 이메일로 발송하시겠습니까?`)) {
      return
    }

    try {
      setEmailSending(true)
      
      const response = await fetch('/api/admin/unshipped-statements/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statementIds })
      })

      const result = await response.json()

      if (result.success) {
        const { successCount, failCount } = result.data
        
        if (successCount > 0 && failCount === 0) {
          showSuccess(`✅ 이메일 발송 완료: ${successCount}건 성공`)
        } else if (successCount === 0 && failCount > 0) {
          showError(`❌ 이메일 발송 실패: ${failCount}건 실패`)
        } else if (successCount > 0 && failCount > 0) {
          showSuccess(`⚠️ 이메일 발송 부분 완료: 성공 ${successCount}건, 실패 ${failCount}건`)
        } else {
          showError('이메일 발송할 대상이 없습니다.')
        }
        
        await fetchStatements()
        setSelectedStatements([])
      } else {
        showError(`❌ 이메일 발송 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Email send error:', error)
      showError('이메일 발송 중 오류가 발생했습니다.')
    } finally {
      setEmailSending(false)
    }
  }

  const handleStatusUpdate = async (statementIds: string[], newStatus: string) => {
    if (statementIds.length === 0) {
      showError('상태를 변경할 명세서를 선택해주세요.')
      return
    }

    const statusText = getStatusText(newStatus)
    if (!confirm(`선택된 ${statementIds.length}건의 명세서 상태를 '${statusText}'로 변경하시겠습니까?`)) {
      return
    }

    try {
      setStatusUpdating(true)
      
      const response = await fetch('/api/admin/unshipped-statements/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statementIds, status: newStatus })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(`상태가 '${statusText}'로 변경되었습니다.`)
        await fetchStatements()
        setSelectedStatements([])
      } else {
        showError(`상태 변경 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Status update error:', error)
      showError('상태 변경 중 오류가 발생했습니다.')
    } finally {
      setStatusUpdating(false)
    }
  }

  const handleStatementDownload = async (statementId: string) => {
    try {
      const response = await fetch(`/api/admin/unshipped-statements/${statementId}/download`)

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `미출고명세서_${statementId}_${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        showSuccess('미출고 명세서가 다운로드되었습니다.')
      } else {
        showError('다운로드 실패: 파일을 생성할 수 없습니다.')
      }
    } catch (error) {
      console.error('Download error:', error)
      showError('다운로드 중 오류가 발생했습니다.')
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
    setSelectedStatements(prev => 
      prev.length === statements.length ? [] : statements.map(s => s.id)
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'notified': return 'text-blue-600 bg-blue-100'
      case 'resolved': return 'text-green-600 bg-green-100'
      case 'cancelled': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기중'
      case 'notified': return '통보완료'
      case 'resolved': return '해결완료'
      case 'cancelled': return '취소됨'
      default: return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return Clock
      case 'notified': return Mail
      case 'resolved': return CheckCircle
      case 'cancelled': return XCircle
      default: return AlertTriangle
    }
  }

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'yyyy.MM.dd HH:mm', { locale: ko })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount)
  }

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">미출고 명세서 관리</h1>
        <p className="text-sm text-gray-600">
          미출고 명세서의 상태를 관리하고 고객에게 통보할 수 있습니다.
        </p>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              검색 (업체명/주문번호)
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="업체명 또는 주문번호 검색"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              상태
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              <option value="pending">대기중</option>
              <option value="notified">통보완료</option>
              <option value="resolved">해결완료</option>
              <option value="cancelled">취소됨</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              시작일
            </label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              종료일
            </label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            총 {totalCount}건 / 선택된 {selectedStatements.length}건
          </span>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => handleEmailSend(selectedStatements)}
            disabled={selectedStatements.length === 0 || emailSending}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Mail className="w-4 h-4 mr-2" />
            {emailSending ? '발송중...' : '일괄 이메일 발송'}
          </Button>
          <Button
            onClick={() => handleStatusUpdate(selectedStatements, 'resolved')}
            disabled={selectedStatements.length === 0 || statusUpdating}
            size="sm"
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            해결완료 처리
          </Button>
          <Button
            onClick={() => handleStatusUpdate(selectedStatements, 'cancelled')}
            disabled={selectedStatements.length === 0 || statusUpdating}
            size="sm"
            variant="outline"
            className="text-red-600 hover:text-red-700"
          >
            <XCircle className="w-4 h-4 mr-2" />
            취소 처리
          </Button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedStatements.length === statements.length && statements.length > 0}
                    onChange={toggleAllSelection}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  업체 정보
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  주문 번호
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
                  생성일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : statements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    미출고 명세서가 없습니다.
                  </td>
                </tr>
              ) : (
                statements.map((statement) => {
                  const StatusIcon = getStatusIcon(statement.status)
                  return (
                    <tr key={statement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedStatements.includes(statement.id)}
                          onChange={() => toggleStatementSelection(statement.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {statement.users.company_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {statement.users.representative_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {statement.orders.order_number}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDateTime(statement.orders.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          {statement.unshipped_statement_items.slice(0, 2).map((item, index) => (
                            <div key={index} className="text-sm text-gray-900">
                              {item.product_name} {item.color && `(${item.color})`} {item.size && `${item.size}`}
                              <span className="text-gray-500 ml-2">×{item.unshipped_quantity}</span>
                            </div>
                          ))}
                          {statement.unshipped_statement_items.length > 2 && (
                            <div className="text-sm text-gray-500">
                              외 {statement.unshipped_statement_items.length - 2}건
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(statement.total_unshipped_amount)}원
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(statement.status)}`}>
                          <StatusIcon className="w-4 h-4 mr-1" />
                          {getStatusText(statement.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDateTime(statement.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        <Button
                          onClick={() => handleStatementDownload(statement.id)}
                          size="sm"
                          variant="outline"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleEmailSend([statement.id])}
                          size="sm"
                          variant="outline"
                          className="text-green-600 hover:text-green-700"
                          disabled={statement.status === 'cancelled'}
                        >
                          <Mail className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-6">
          <div className="flex space-x-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                onClick={() => setCurrentPage(page)}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
              >
                {page}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 