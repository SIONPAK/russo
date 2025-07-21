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
  Archive
} from 'lucide-react'

interface ShippingStatement {
  id: string
  order_id: string
  order_number: string
  company_name: string
  customer_grade: string
  created_at: string
  shipped_at: string
  status: string
  email_sent: boolean
  email_sent_at: string | null
  total_amount: number
  items: {
    product_name: string
    color: string
    size: string
    quantity: number
    shipped_quantity: number
    unit_price: number
    total_price: number
  }[]
}

export default function ShippingStatementsPage() {
  const [statements, setStatements] = useState<ShippingStatement[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatements, setSelectedStatements] = useState<string[]>([])
  const [filters, setFilters] = useState({
    startDate: (() => {
      const date = new Date()
      date.setDate(date.getDate() - 90) // 90일 전으로 확장
      return date.toISOString().split('T')[0]
    })(),
    endDate: new Date().toISOString().split('T')[0], // 오늘
    companyName: '',
    emailSent: 'all'
  })
  const [emailSending, setEmailSending] = useState(false)

  useEffect(() => {
    fetchStatements()
  }, [filters])

  const fetchStatements = async () => {
    try {
      setLoading(true)
      console.log('🔍 [출고명세서] 조회 시작')
      
      // 가장 간단한 API 호출
      const response = await fetch('/api/admin/orders?status=all&limit=1000')
      const result = await response.json()
      
      console.log('🔍 [출고명세서] API 응답:', {
        success: result.success,
        ordersCount: result.data?.orders?.length || 0,
        error: result.error
      })

      if (result.success && result.data?.orders) {
        // 이메일 발송 로그 조회
        const emailLogResponse = await fetch('/api/admin/orders/email-logs')
        const emailLogResult = await emailLogResponse.json()
        const emailLogs = emailLogResult.success ? emailLogResult.data : []

        console.log('🔍 [출고명세서] 이메일 로그:', emailLogs.length)

        // 주문 데이터와 이메일 로그 매칭
        const statementsWithEmail = result.data.orders.map((order: any) => {
          // 해당 주문의 이메일 발송 로그 찾기
          const emailLog = emailLogs.find((log: any) => 
            log.order_id === order.id && 
            (log.email_type === 'shipping_statement' || log.email_type === 'confirmed_statement')
          )

          return {
            id: order.id,
            order_id: order.id,
            order_number: order.order_number,
            company_name: order.users?.company_name || '알 수 없음',
            customer_grade: order.users?.customer_grade || 'general',
            created_at: order.created_at,
            shipped_at: order.shipped_at || order.created_at,
            status: order.status,
            email_sent: !!emailLog,
            email_sent_at: emailLog?.sent_at || null,
            total_amount: (() => {
              // 공급가액 계산
              const supplyAmount = order.order_items?.reduce((sum: number, item: any) => 
                sum + (item.quantity * item.unit_price), 0) || 0;
              
              // 부가세액 계산 (공급가액의 10%, 소수점 절사)
              const taxAmount = Math.floor(supplyAmount * 0.1);
              
              // 총 주문 수량 계산 (배송비 계산용)
              const totalQuantity = order.order_items?.reduce((sum: number, item: any) => 
                sum + (item.quantity || 0), 0) || 0;
              
              // 배송비 계산 (20장 미만일 때 3,000원)
              const shippingFee = totalQuantity < 20 ? 3000 : 0;
              
              // 총 금액 = 공급가액 + 부가세액 + 배송비
              return supplyAmount + taxAmount + shippingFee;
            })(),
            items: order.order_items?.map((item: any) => ({
              product_name: item.product_name,
              color: item.color || '기본',
              size: item.size || '',
              quantity: item.quantity,
              shipped_quantity: item.shipped_quantity || 0,
              unit_price: item.unit_price,
              total_price: item.unit_price * item.quantity
            })) || []
          }
        })

        console.log('🔍 [출고명세서] 최종 변환 완료:', statementsWithEmail.length)
        setStatements(statementsWithEmail)
      } else {
        console.error('🔍 [출고명세서] API 실패:', result)
        setStatements([])
      }
    } catch (error) {
      console.error('🔍 [출고명세서] 오류:', error)
      setStatements([])
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSend = async (statementIds: string[]) => {
    if (statementIds.length === 0) {
      alert('발송할 명세서를 선택해주세요.')
      return
    }

    if (!confirm(`선택된 ${statementIds.length}건의 출고 명세서를 이메일로 발송하시겠습니까?`)) {
      return
    }

    try {
      setEmailSending(true)
      
      // statementIds를 orderIds로 변환
      const orderIds = statementIds.map(statementId => {
        const statement = statements.find(s => s.id === statementId)
        return statement?.order_id
      }).filter(Boolean)

      const response = await fetch('/api/admin/orders/email-shipping-statements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderIds })
      })

      const result = await response.json()

      if (result.success) {
        const { successfulEmails, failedEmails } = result.data.summary
        
        if (successfulEmails > 0 && failedEmails === 0) {
          alert(`✅ 이메일 발송 완료: ${successfulEmails}건 성공`)
        } else if (successfulEmails === 0 && failedEmails > 0) {
          alert(`❌ 이메일 발송 실패: ${failedEmails}건 실패`)
        } else if (successfulEmails > 0 && failedEmails > 0) {
          alert(`⚠️ 이메일 발송 부분 완료: 성공 ${successfulEmails}건, 실패 ${failedEmails}건`)
        } else {
          alert('이메일 발송할 대상이 없습니다.')
        }
        
        await fetchStatements()
        setSelectedStatements([])
      } else {
        alert(`❌ 이메일 발송 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Email send error:', error)
      alert('이메일 발송 중 오류가 발생했습니다.')
    } finally {
      setEmailSending(false)
    }
  }

  const handleStatementDownload = async (statementId: string) => {
    try {
      const response = await fetch(`/api/admin/orders/${statementId}/statement`)

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `출고명세서_${statementId}_${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        alert('출고 명세서가 다운로드되었습니다.')
      } else {
        alert('다운로드 실패: 파일을 생성할 수 없습니다.')
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('다운로드 중 오류가 발생했습니다.')
    }
  }

  const handleBulkDownload = async () => {
    if (selectedStatements.length === 0) {
      alert('다운로드할 명세서를 선택해주세요.')
      return
    }

    try {
      // 각 선택된 명세서에 대해 개별 다운로드
      for (const statementId of selectedStatements) {
        const response = await fetch(`/api/admin/orders/${statementId}/statement`)

        if (response.ok) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `출고명세서_${statementId}_${new Date().toISOString().split('T')[0]}.xlsx`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
          
          // 다운로드 간 약간의 지연 추가
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
      
      alert(`${selectedStatements.length}건의 출고 명세서가 다운로드되었습니다.`)
    } catch (error) {
      console.error('Bulk download error:', error)
      alert('일괄 다운로드 중 오류가 발생했습니다.')
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">확정됨</span>
      case 'preparing':
        return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">배송준비중</span>
      case 'shipped':
        return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">배송완료</span>
      default:
        return <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">{status}</span>
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">📋 출고 명세서 관리</h1>
        <div className="flex gap-2">
          <button
            onClick={() => handleEmailSend(selectedStatements)}
            disabled={emailSending || selectedStatements.length === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
          >
            {emailSending ? '발송 중...' : `선택 명세서 이메일 발송 (${selectedStatements.length})`}
          </button>
          <button
            onClick={handleBulkDownload}
            disabled={selectedStatements.length === 0}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            선택 명세서 다운로드 ({selectedStatements.length})
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <label className="block text-sm font-medium mb-1">이메일 발송</label>
            <select
              value={filters.emailSent}
              onChange={(e) => setFilters(prev => ({ ...prev, emailSent: e.target.value }))}
              className="w-full p-2 border rounded"
            >
              <option value="all">전체</option>
              <option value="sent">발송완료</option>
              <option value="not_sent">미발송</option>
            </select>
          </div>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">총 명세서</h3>
          <p className="text-2xl font-bold text-blue-600">{statements.length}건</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">이메일 발송완료</h3>
          <p className="text-2xl font-bold text-green-600">
            {statements.filter(s => s.email_sent).length}건
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">이메일 미발송</h3>
          <p className="text-2xl font-bold text-red-600">
            {statements.filter(s => !s.email_sent).length}건
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-600">총 출고금액</h3>
          <p className="text-2xl font-bold text-purple-600">
            {statements.reduce((sum, s) => sum + s.total_amount, 0).toLocaleString()}원
          </p>
        </div>
      </div>

      {/* 명세서 목록 */}
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
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">주문일시</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">출고금액</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">주문상태</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">이메일 발송</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : statements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    출고 명세서가 없습니다.
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
                    </td>
                    <td className="px-4 py-3">
                      <div className={`text-sm font-medium ${getGradeColor(statement.customer_grade)}`}>
                        {getGradeBadge(statement.customer_grade)} {statement.company_name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-900">
                        {format(new Date(statement.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {statement.total_amount.toLocaleString()}원
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        {getStatusBadge(statement.status)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          statement.email_sent 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {statement.email_sent ? '발송완료' : '미발송'}
                        </span>
                        {statement.email_sent && statement.email_sent_at && (
                          <span className="text-xs text-gray-500">
                            {format(new Date(statement.email_sent_at), 'MM-dd HH:mm')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatementDownload(statement.id)}
                          className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          다운로드
                        </button>
                        <button
                          onClick={() => handleEmailSend([statement.id])}
                          disabled={emailSending}
                          className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
                        >
                          이메일 발송
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