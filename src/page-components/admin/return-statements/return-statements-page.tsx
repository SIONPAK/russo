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
  XCircle,
  Mail
} from 'lucide-react'

interface ReturnStatement {
  id: string
  statement_number: string
  order_id: string
  order_number: string
  company_name: string
  customer_grade: string
  return_reason: string
  return_type: 'defect' | 'size_issue' | 'color_issue' | 'customer_change' | 'other'
  created_at: string
  processed_at: string | null
  refunded: boolean
  refund_amount: number
  refund_method: 'mileage' | 'card' | 'bank_transfer'
  status: 'pending' | 'approved' | 'refunded' | 'rejected'
  items: {
    product_name: string
    color: string
    size: string
    return_quantity: number
    unit_price: number
    total_price: number
  }[]
  total_amount: number
  email_sent: boolean
  email_sent_at: string | null
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
  const [sendingEmail, setSendingEmail] = useState(false)

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

      const response = await fetch(`/api/admin/return-statements?${params}`)
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
      showError('처리할 반품을 선택해주세요.')
      return
    }

    if (!confirm(`선택된 ${statementIds.length}건의 반품을 처리하시겠습니까?`)) {
      return
    }

    try {
      setProcessing(true)
      const response = await fetch('/api/admin/return-statements/process', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statementIds })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(`반품 처리 완료: 성공 ${result.data.processed}건`)
        await fetchStatements()
        setSelectedStatements([])
      } else {
        showError(`반품 처리 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Return process error:', error)
      showError('반품 처리 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const handleSendEmails = async () => {
    if (selectedStatements.length === 0) {
      showError('이메일을 보낼 명세서를 선택해주세요.')
      return
    }

    if (!confirm(`선택된 ${selectedStatements.length}건의 반품명세서를 이메일로 발송하시겠습니까?`)) {
      return
    }

    try {
      setSendingEmail(true)
      const response = await fetch('/api/admin/return-statements/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statementIds: selectedStatements })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(`이메일 발송 완료: 성공 ${result.data.sent}건`)
        await fetchStatements()
        setSelectedStatements([])
      } else {
        showError(`이메일 발송 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Email send error:', error)
      showError('이메일 발송 중 오류가 발생했습니다.')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleStatementDownload = async (statementId: string) => {
    try {
      const response = await fetch(`/api/admin/return-statements/${statementId}/download`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `return_statement_${statementId}.xlsx`
        a.click()
        window.URL.revokeObjectURL(url)
      } else {
        showError('다운로드 실패')
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
    if (!Array.isArray(statements)) return
    setSelectedStatements(prev => 
      prev.length === statements.length ? [] : statements.map(s => s.id)
    )
  }

  const getReturnTypeText = (type: string) => {
    const types = {
      'defect': '불량',
      'size_issue': '사이즈 문제',
      'color_issue': '색상 문제',
      'customer_change': '고객 변심',
      'other': '기타'
    }
    return types[type as keyof typeof types] || type
  }

  const getReturnTypeColor = (type: string) => {
    const colors = {
      'defect': 'bg-red-100 text-red-800',
      'size_issue': 'bg-orange-100 text-orange-800',
      'color_issue': 'bg-yellow-100 text-yellow-800',
      'customer_change': 'bg-blue-100 text-blue-800',
      'other': 'bg-gray-100 text-gray-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getStatusText = (status: string) => {
    const statuses = {
      'pending': '대기중',
      'approved': '승인됨',
      'refunded': '환불완료',
      'rejected': '거부됨'
    }
    return statuses[status as keyof typeof statuses] || status
  }

  const getStatusColor = (status: string) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'refunded': 'bg-blue-100 text-blue-800',
      'rejected': 'bg-red-100 text-red-800'
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getGradeColor = (grade: string) => {
    const colors = {
      'VIP': 'bg-purple-100 text-purple-800',
      'GOLD': 'bg-yellow-100 text-yellow-800',
      'SILVER': 'bg-gray-100 text-gray-800',
      'BRONZE': 'bg-orange-100 text-orange-800'
    }
    return colors[grade as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getGradeBadge = (grade: string) => {
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getGradeColor(grade)}`}>
        {grade}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">반품명세서 관리</h1>
          <p className="text-gray-600">반품 요청 및 명세서를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleSendEmails()}
            disabled={selectedStatements.length === 0 || sendingEmail}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Mail className="h-4 w-4 mr-2" />
            {sendingEmail ? '발송 중...' : '이메일 발송'}
          </Button>
          <Button
            onClick={() => handleProcessReturn(selectedStatements)}
            disabled={selectedStatements.length === 0 || processing}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {processing ? '처리 중...' : '반품 처리'}
          </Button>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              시작일
            </label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              종료일
            </label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              회사명
            </label>
            <Input
              type="text"
              placeholder="회사명 검색"
              value={filters.companyName}
              onChange={(e) => setFilters(prev => ({ ...prev, companyName: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              반품 유형
            </label>
            <select
              value={filters.returnType}
              onChange={(e) => setFilters(prev => ({ ...prev, returnType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              <option value="defect">불량</option>
              <option value="size_issue">사이즈 문제</option>
              <option value="color_issue">색상 문제</option>
              <option value="customer_change">고객 변심</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상태
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              <option value="pending">대기중</option>
              <option value="approved">승인됨</option>
              <option value="refunded">환불완료</option>
              <option value="rejected">거부됨</option>
            </select>
          </div>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">총 반품 건수</p>
              <p className="text-2xl font-bold text-gray-900">{statements.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">대기중</p>
              <p className="text-2xl font-bold text-gray-900">
                {statements.filter(s => s.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">처리완료</p>
              <p className="text-2xl font-bold text-gray-900">
                {statements.filter(s => s.status === 'refunded').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <XCircle className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">거부됨</p>
              <p className="text-2xl font-bold text-gray-900">
                {statements.filter(s => s.status === 'rejected').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={statements.length > 0 && selectedStatements.length === statements.length}
                    onChange={toggleAllSelection}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  명세서 번호
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  주문번호
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  회사명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  등급
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  반품 유형
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  반품 사유
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  환불 금액
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  생성일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이메일
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-4 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : statements.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-4 text-center text-gray-500">
                    반품명세서가 없습니다.
                  </td>
                </tr>
              ) : (
                statements.map((statement) => (
                  <tr key={statement.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedStatements.includes(statement.id)}
                        onChange={() => toggleStatementSelection(statement.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {statement.statement_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {statement.order_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {statement.company_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getGradeBadge(statement.customer_grade)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getReturnTypeColor(statement.return_type)}`}>
                        {getReturnTypeText(statement.return_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {statement.return_reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {statement.refund_amount.toLocaleString()}원
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(statement.status)}`}>
                        {getStatusText(statement.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(statement.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {statement.email_sent ? (
                        <span className="text-green-600">발송완료</span>
                      ) : (
                        <span className="text-gray-400">미발송</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handleStatementDownload(statement.id)}
                          size="sm"
                          variant="outline"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
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