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
  Mail,
  Plus
} from 'lucide-react'

interface DeductionStatement {
  id: string
  statement_number: string
  order_id: string
  order_number: string
  company_name: string
  customer_grade: string
  deduction_reason: string
  deduction_type: 'return' | 'defect' | 'shortage' | 'damage' | 'other'
  created_at: string
  processed_at: string | null
  mileage_deducted: boolean
  mileage_amount: number
  status: 'pending' | 'completed' | 'cancelled'
  items: {
    product_name: string
    color: string
    size: string
    deduction_quantity: number
    unit_price: number
    total_price: number
  }[]
  total_amount: number
  email_sent: boolean
  email_sent_at: string | null
}

export default function DeductionStatementsPage() {
  const [statements, setStatements] = useState<DeductionStatement[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatements, setSelectedStatements] = useState<string[]>([])
  const [filters, setFilters] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    companyName: '',
    deductionType: 'all',
    status: 'all'
  })
  const [processing, setProcessing] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

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
        deductionType: filters.deductionType,
        status: filters.status
      })

      const response = await fetch(`/api/admin/deduction-statements?${params}`)
      const result = await response.json()

      if (result.success) {
        setStatements(Array.isArray(result.data) ? result.data : [])
      } else {
        console.error('Failed to fetch deduction statements:', result.error)
        setStatements([])
      }
    } catch (error) {
      console.error('Error fetching deduction statements:', error)
      setStatements([])
    } finally {
      setLoading(false)
    }
  }

  const handleProcessDeduction = async (statementIds: string[]) => {
    if (statementIds.length === 0) {
      showError('처리할 차감을 선택해주세요.')
      return
    }

    if (!confirm(`선택된 ${statementIds.length}건의 차감을 처리하시겠습니까?\n(마일리지 차감이 자동으로 적용됩니다)`)) {
      return
    }

    try {
      setProcessing(true)
      const response = await fetch('/api/admin/deduction-statements/process', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ statementIds })
      })

      const result = await response.json()

      if (result.success) {
        const { processedCount, totalMileageDeducted, errors } = result.data
        let message = `차감 처리 완료: 성공 ${processedCount}건`
        
        if (totalMileageDeducted > 0) {
          message += `, 총 마일리지 차감 ${totalMileageDeducted.toLocaleString()}P`
        }
        
        if (errors && errors.length > 0) {
          message += `\n실패 ${errors.length}건: ${errors.join(', ')}`
        }
        
        showSuccess(message)
        await fetchStatements()
        setSelectedStatements([])
      } else {
        showError(`차감 처리 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Deduction process error:', error)
      showError('차감 처리 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const handleSendEmails = async () => {
    if (selectedStatements.length === 0) {
      showError('이메일을 보낼 명세서를 선택해주세요.')
      return
    }

    if (!confirm(`선택된 ${selectedStatements.length}건의 차감명세서를 이메일로 발송하시겠습니까?`)) {
      return
    }

    try {
      setSendingEmail(true)
      const response = await fetch('/api/admin/deduction-statements/send-email', {
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
      const response = await fetch(`/api/admin/deduction-statements/${statementId}/download`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `deduction_statement_${statementId}.xlsx`
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

  const getDeductionTypeText = (type: string) => {
    const types = {
      'return': '반품',
      'defect': '불량',
      'shortage': '부족',
      'damage': '파손',
      'other': '기타'
    }
    return types[type as keyof typeof types] || type
  }

  const getDeductionTypeColor = (type: string) => {
    const colors = {
      'return': 'bg-red-100 text-red-800',
      'defect': 'bg-orange-100 text-orange-800',
      'shortage': 'bg-yellow-100 text-yellow-800',
      'damage': 'bg-purple-100 text-purple-800',
      'other': 'bg-gray-100 text-gray-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getStatusText = (status: string) => {
    const statuses = {
      'pending': '대기중',
      'completed': '완료',
      'cancelled': '취소됨'
    }
    return statuses[status as keyof typeof statuses] || status
  }

  const getStatusColor = (status: string) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800'
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
          <h1 className="text-2xl font-bold text-gray-900">차감명세서 관리</h1>
          <p className="text-gray-600">불량건이나 누락건 등에 대한 차감명세서를 관리합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-red-600 hover:bg-red-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            차감명세서 생성
          </Button>
          <Button
            onClick={() => handleSendEmails()}
            disabled={selectedStatements.length === 0 || sendingEmail}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Mail className="h-4 w-4 mr-2" />
            {sendingEmail ? '발송 중...' : '이메일 발송'}
          </Button>
          <Button
            onClick={() => handleProcessDeduction(selectedStatements)}
            disabled={selectedStatements.length === 0 || processing}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {processing ? '처리 중...' : '차감 처리'}
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
              차감 유형
            </label>
            <select
              value={filters.deductionType}
              onChange={(e) => setFilters(prev => ({ ...prev, deductionType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              <option value="return">반품</option>
              <option value="defect">불량</option>
              <option value="shortage">부족</option>
              <option value="damage">파손</option>
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
              <option value="completed">완료</option>
              <option value="cancelled">취소됨</option>
            </select>
          </div>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">총 차감 건수</p>
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
                {statements.filter(s => s.status === 'completed').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <XCircle className="h-8 w-8 text-red-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">총 차감 금액</p>
              <p className="text-2xl font-bold text-gray-900">
                {statements.reduce((sum, s) => sum + s.total_amount, 0).toLocaleString()}원
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
                  차감 유형
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  차감 사유
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  차감 금액
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  마일리지
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
                  <td colSpan={13} className="px-6 py-4 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : statements.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-4 text-center text-gray-500">
                    차감명세서가 없습니다.
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
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDeductionTypeColor(statement.deduction_type)}`}>
                        {getDeductionTypeText(statement.deduction_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {statement.deduction_reason}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {statement.total_amount.toLocaleString()}원
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${statement.mileage_deducted ? 'text-green-600' : 'text-gray-400'}`}>
                          {statement.mileage_amount.toLocaleString()}P
                        </span>
                        {statement.mileage_deducted && (
                          <span className="text-xs text-green-600">✓</span>
                        )}
                      </div>
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

      {/* 차감명세서 생성 모달 */}
      {showCreateModal && (
        <DeductionStatementCreateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            fetchStatements()
          }}
        />
      )}
    </div>
  )
}

// 차감명세서 생성 모달 컴포넌트
function DeductionStatementCreateModal({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    orderId: '',
    deductionType: 'defect' as 'return' | 'defect' | 'shortage' | 'damage' | 'other',
    deductionReason: '',
    items: [
      {
        product_name: '',
        color: '',
        size: '',
        deduction_quantity: 1,
        unit_price: 0
      }
    ]
  })
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [productSearchTerm, setProductSearchTerm] = useState('')

  // 주문 목록 조회
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const params = new URLSearchParams({
          limit: '50',
          search: searchTerm,
          status: 'all'
        })
        const response = await fetch(`/api/admin/orders?${params}`)
        const data = await response.json()
        if (data.success) {
          setOrders(data.data.orders || [])
        } else {
          console.error('주문 조회 실패:', data.error)
          setOrders([])
        }
      } catch (error) {
        console.error('주문 목록 조회 오류:', error)
        setOrders([])
      }
    }
    
    // 검색어가 있거나 초기 로드시에만 조회
    if (searchTerm || orders.length === 0) {
      fetchOrders()
    }
  }, [searchTerm])

  // 상품 목록 조회
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const params = new URLSearchParams({
          limit: '100',
          search: productSearchTerm
        })
        const response = await fetch(`/api/admin/products?${params}`)
        const data = await response.json()
        if (data.success) {
          setProducts(data.data.products)
        }
      } catch (error) {
        console.error('상품 목록 조회 오류:', error)
      }
    }
    if (productSearchTerm) {
      fetchProducts()
    }
  }, [productSearchTerm])

  // 주문 선택 시 주문 상품 조회
  useEffect(() => {
    const fetchOrderItems = async () => {
      if (!formData.orderId) {
        setSelectedOrder(null)
        setOrderItems([])
        return
      }

      try {
        const response = await fetch(`/api/admin/orders/${formData.orderId}`)
        const data = await response.json()
        if (data.success) {
          setSelectedOrder(data.data)
          setOrderItems(data.data.order_items || [])
        }
      } catch (error) {
        console.error('주문 상품 조회 오류:', error)
      }
    }
    fetchOrderItems()
  }, [formData.orderId])

  // 주문 상품에서 선택
  const addItemFromOrder = (orderItem: any) => {
    const newItem = {
      product_name: orderItem.product_name,
      color: orderItem.color || '',
      size: orderItem.size || '',
      deduction_quantity: 1,
      unit_price: orderItem.unit_price
    }
    
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
  }

  // 상품 검색에서 선택
  const addItemFromProduct = (product: any) => {
    const newItem = {
      product_name: product.name,
      color: '',
      size: '',
      deduction_quantity: 1,
      unit_price: product.price
    }
    
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }))
  }

  // 아이템 제거
  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  // 아이템 업데이트
  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  // 차감명세서 생성
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.orderId || !formData.deductionReason || formData.items.length === 0) {
      showError('필수 정보를 모두 입력해주세요.')
      return
    }

    // 아이템 검증
    const invalidItems = formData.items.filter(item => 
      !item.product_name || item.deduction_quantity <= 0 || item.unit_price <= 0
    )
    if (invalidItems.length > 0) {
      showError('모든 상품의 정보를 올바르게 입력해주세요.')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/admin/deduction-statements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      if (data.success) {
        showSuccess('차감명세서가 성공적으로 생성되었습니다.')
        onSuccess()
      } else {
        showError('차감명세서 생성에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      console.error('차감명세서 생성 오류:', error)
      showError('차감명세서 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const totalAmount = formData.items.reduce((sum, item) => 
    sum + (item.deduction_quantity * item.unit_price), 0
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">차감명세서 생성</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  주문 선택 *
                </label>
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="회사명이나 주문번호로 검색하세요 (예: 뮤릭처, PO175173162049)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <select
                    value={formData.orderId}
                    onChange={(e) => setFormData(prev => ({ ...prev, orderId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">
                      {searchTerm ? 
                        (orders.length > 0 ? `${orders.length}개의 주문이 검색되었습니다. 선택해주세요.` : '검색 결과가 없습니다.') 
                        : '위에서 회사명이나 주문번호를 검색해주세요'
                      }
                    </option>
                    {orders.map(order => (
                      <option key={order.id} value={order.id}>
                        {order.order_number} | {order.users?.company_name || order.shipping_name} | {order.users?.representative_name || ''} | {new Date(order.created_at).toLocaleDateString('ko-KR')}
                      </option>
                    ))}
                  </select>
                  {searchTerm && orders.length > 0 && (
                    <div className="text-sm text-green-600">
                      ✓ {orders.length}개의 주문을 찾았습니다
                    </div>
                  )}
                  {searchTerm && orders.length === 0 && (
                    <div className="text-sm text-red-600">
                      ⚠ 검색 결과가 없습니다. 다른 검색어를 시도해보세요
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  차감 유형 *
                </label>
                <select
                  value={formData.deductionType}
                  onChange={(e) => setFormData(prev => ({ ...prev, deductionType: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="defect">불량</option>
                  <option value="shortage">부족</option>
                  <option value="damage">파손</option>
                  <option value="return">반품</option>
                  <option value="other">기타</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                차감 사유 *
              </label>
              <textarea
                value={formData.deductionReason}
                onChange={(e) => setFormData(prev => ({ ...prev, deductionReason: e.target.value }))}
                placeholder="차감 사유를 상세히 입력하세요"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* 상품 선택 섹션 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 주문 상품에서 선택 */}
              {orderItems.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">주문 상품에서 선택</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {orderItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.product_name}</div>
                          <div className="text-xs text-gray-500">
                            {item.color && `색상: ${item.color}`} {item.size && `사이즈: ${item.size}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            주문수량: {item.quantity}, 단가: {item.unit_price.toLocaleString()}원
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => addItemFromOrder(item)}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          추가
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 상품 검색에서 선택 */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">상품 검색</h3>
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="상품명으로 검색"
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                  />
                  {products.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {products.map((product) => (
                        <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{product.name}</div>
                            <div className="text-xs text-gray-500">
                              코드: {product.code} | 가격: {product.price.toLocaleString()}원
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => addItemFromProduct(product)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            추가
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 선택된 차감 상품 목록 */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  차감 상품 목록 * ({formData.items.length}개)
                </label>
              </div>

              <div className="space-y-4">
                {formData.items.map((item, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg bg-yellow-50">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium text-gray-900">상품 #{index + 1}</h4>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          상품명 *
                        </label>
                        <Input
                          type="text"
                          value={item.product_name}
                          onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                          required
                          className="bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          색상
                        </label>
                        <Input
                          type="text"
                          value={item.color}
                          onChange={(e) => updateItem(index, 'color', e.target.value)}
                          className="bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          사이즈
                        </label>
                        <Input
                          type="text"
                          value={item.size}
                          onChange={(e) => updateItem(index, 'size', e.target.value)}
                          className="bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          차감 수량 *
                        </label>
                        <Input
                          type="number"
                          value={item.deduction_quantity}
                          onChange={(e) => updateItem(index, 'deduction_quantity', parseInt(e.target.value) || 0)}
                          min="1"
                          required
                          className="bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          단가 *
                        </label>
                        <Input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseInt(e.target.value) || 0)}
                          min="0"
                          required
                          className="bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          금액
                        </label>
                        <Input
                          type="text"
                          value={`${(item.deduction_quantity * item.unit_price).toLocaleString()}원`}
                          readOnly
                          className="bg-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {formData.items.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  위에서 상품을 선택하거나 검색하여 추가해주세요.
                </div>
              )}
            </div>

            {/* 총 차감 금액 */}
            {formData.items.length > 0 && (
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-red-800">총 차감 금액</span>
                  <span className="text-lg font-bold text-red-600">
                    -{totalAmount.toLocaleString()}원
                  </span>
                </div>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={loading || formData.items.length === 0}
              >
                {loading ? '생성 중...' : '차감명세서 생성'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 