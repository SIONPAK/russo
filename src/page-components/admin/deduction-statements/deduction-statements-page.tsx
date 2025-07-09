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
  Plus,
  X
} from 'lucide-react'

interface DeductionStatement {
  id: string
  statement_number: string
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
    yearMonth: format(new Date(), 'yyyy-MM'),
    companyName: '',
    deductionType: 'all',
    status: 'all'
  })
  const [processing, setProcessing] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [showProductSearchModal, setShowProductSearchModal] = useState(false)
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null)
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [productSearchResults, setProductSearchResults] = useState<any[]>([])
  const [productSearchKeyword, setProductSearchKeyword] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<{
    productId: string
    productName: string
    productCode: string
    color: string
    size: string
    unitPrice: number
  }[]>([])

  useEffect(() => {
    fetchStatements()
  }, [filters])

  const fetchStatements = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        yearMonth: filters.yearMonth,
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

  const searchProducts = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setProductSearchResults([])
      return
    }

    setIsSearchingProducts(true)
    try {
      const response = await fetch(`/api/admin/products?search=${encodeURIComponent(searchTerm)}&limit=20`)
      const result = await response.json()

      if (result.success) {
        setProductSearchResults(result.data || [])
      }
    } catch (error) {
      console.error('Product search error:', error)
      setProductSearchResults([])
    } finally {
      setIsSearchingProducts(false)
    }
  }

  const toggleProductSelection = (product: any, color: string, size: string) => {
    const productKey = `${product.id}-${color}-${size}`
    const isSelected = selectedProducts.some(p => 
      p.productId === product.id && p.color === color && p.size === size
    )

    if (isSelected) {
      setSelectedProducts(prev => prev.filter(p => 
        !(p.productId === product.id && p.color === color && p.size === size)
      ))
    } else {
      const unitPrice = product.is_on_sale && product.sale_price ? product.sale_price : product.price
      setSelectedProducts(prev => [...prev, {
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        color,
        size,
        unitPrice
      }])
    }
  }

  const openProductSearch = (itemIndex: number) => {
    setSelectedItemIndex(itemIndex)
    setShowProductSearchModal(true)
    setProductSearchKeyword('')
    setProductSearchResults([])
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
              조회 월
            </label>
            <Input
              type="month"
              value={filters.yearMonth}
              onChange={(e) => setFilters(prev => ({ ...prev, yearMonth: e.target.value }))}
              className="w-full"
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
              <p className="text-sm font-medium text-gray-500">총 차감 금액 (세금포함)</p>
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
                  차감 금액<br/>
                  <span className="text-xs text-blue-600 normal-case">(세금포함)</span>
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
                  <td colSpan={12} className="px-6 py-4 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : statements.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-4 text-center text-gray-500">
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
  const [showProductSearchModal, setShowProductSearchModal] = useState(false)
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null)
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [productSearchResults, setProductSearchResults] = useState<any[]>([])
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<{
    productId: string
    productName: string
    productCode: string
    color: string
    size: string
    unitPrice: number
  }[]>([])
  const [companySearchTerm, setCompanySearchTerm] = useState('')
  const [companySearchResults, setCompanySearchResults] = useState<any[]>([])
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)

  // 회사명 검색
  const searchCompanies = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setCompanySearchResults([])
      setShowCompanyDropdown(false)
      return
    }

    try {
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(searchTerm)}&limit=10`)
      const result = await response.json()

      if (result.success) {
        setCompanySearchResults(result.data || [])
        setShowCompanyDropdown(true)
      }
    } catch (error) {
      console.error('Company search error:', error)
      setCompanySearchResults([])
    }
  }

  const selectCompany = (company: any) => {
    setCompanySearchTerm(company.company_name)
    setShowCompanyDropdown(false)
  }

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.company-search-container')) {
        setShowCompanyDropdown(false)
      }
    }

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowCompanyDropdown(false)
      }
    }

    if (showCompanyDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscKey)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscKey)
    }
  }, [showCompanyDropdown])

  // 상품 검색
  const searchProducts = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setProductSearchResults([])
      return
    }

    setIsSearchingProducts(true)
    try {
      const response = await fetch(`/api/admin/products?search=${encodeURIComponent(searchTerm)}&limit=20`)
      const result = await response.json()

      if (result.success) {
        setProductSearchResults(result.data || [])
      }
    } catch (error) {
      console.error('Product search error:', error)
      setProductSearchResults([])
    } finally {
      setIsSearchingProducts(false)
    }
  }

  const toggleProductSelection = (product: any, color: string, size: string) => {
    const isSelected = selectedProducts.some(p => 
      p.productId === product.id && p.color === color && p.size === size
    )

    if (isSelected) {
      setSelectedProducts(prev => prev.filter(p => 
        !(p.productId === product.id && p.color === color && p.size === size)
      ))
    } else {
      const unitPrice = product.is_on_sale && product.sale_price ? product.sale_price : product.price
      setSelectedProducts(prev => [...prev, {
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        color,
        size,
        unitPrice
      }])
    }
  }

  const addSelectedProductsToStatement = () => {
    const newItems = selectedProducts.map(product => ({
      product_name: product.productName,
      color: product.color,
      size: product.size,
      deduction_quantity: 1,
      unit_price: product.unitPrice
    }))

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, ...newItems]
    }))
    
    setShowProductSearchModal(false)
    setSelectedProducts([])
    setProductSearchTerm('')
    setProductSearchResults([])
  }

  const isProductSelected = (product: any, color: string, size: string) => {
    return selectedProducts.some(p => 
      p.productId === product.id && p.color === color && p.size === size
    )
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
    
    if (!companySearchTerm || !formData.deductionReason || formData.items.length === 0) {
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
      const submitData = {
        ...formData,
        company_name: companySearchTerm
      }
      
      const response = await fetch('/api/admin/deduction-statements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
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

  const totalAmount = formData.items.reduce((sum, item) => {
    const supplyAmount = item.deduction_quantity * item.unit_price
    const vat = Math.floor(supplyAmount * 0.1)
    return sum + supplyAmount + vat
  }, 0)

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
              <div className="relative company-search-container">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  업체명 *
                </label>
                <Input
                  type="text"
                  value={companySearchTerm}
                  onChange={(e) => {
                    setCompanySearchTerm(e.target.value)
                    searchCompanies(e.target.value)
                  }}
                  onFocus={() => {
                    if (companySearchResults.length > 0) {
                      setShowCompanyDropdown(true)
                    }
                  }}
                  placeholder="업체명을 검색하세요"
                  required
                />
                
                {/* 검색 결과 드롭다운 */}
                {showCompanyDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {companySearchResults.length > 0 ? (
                      companySearchResults.map((company) => (
                        <div
                          key={company.id}
                          onClick={() => selectCompany(company)}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">{company.company_name}</div>
                          <div className="text-sm text-gray-500">
                            {company.representative_name} | {company.business_number}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-gray-500 text-sm">
                        검색 결과가 없습니다.
                      </div>
                    )}
                  </div>
                )}
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

            {/* 차감 상품 목록 */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-medium text-gray-900">차감 상품</h4>
                <Button
                  type="button"
                  onClick={() => setShowProductSearchModal(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Search className="h-4 w-4 mr-2" />
                  상품 검색
                </Button>
              </div>

              <div className="space-y-4">
                {formData.items.map((item, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-sm font-medium text-gray-700">상품 {index + 1}</span>
                      <Button
                        type="button"
                        onClick={() => removeItem(index)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            단가<br/>
                            <span className="text-xs text-gray-600">(세금제외)</span>
                          </label>
                          <Input
                            type="text"
                            value={`${(item.deduction_quantity * item.unit_price).toLocaleString()}원`}
                            readOnly
                            className="bg-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            부가세<br/>
                            <span className="text-xs text-gray-600">(10%)</span>
                          </label>
                          <Input
                            type="text"
                            value={`${Math.floor(item.deduction_quantity * item.unit_price * 0.1).toLocaleString()}원`}
                            readOnly
                            className="bg-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            합계<br/>
                            <span className="text-xs text-blue-600">(단가+부가세)</span>
                          </label>
                          <Input
                            type="text"
                            value={`${(() => {
                              const supplyAmount = item.deduction_quantity * item.unit_price
                              const vat = Math.floor(supplyAmount * 0.1)
                              return (supplyAmount + vat).toLocaleString()
                            })()}원`}
                            readOnly
                            className="bg-gray-100"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {formData.items.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  위의 "상품 검색" 버튼을 클릭하여 상품을 추가해주세요.
                </div>
              )}
            </div>

            {/* 총 차감 금액 */}
            {formData.items.length > 0 && (
              <div className="bg-red-50 p-4 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <span className="text-sm text-red-800">단가 합계</span>
                    <div className="text-lg font-medium text-red-900">
                      -{formData.items.reduce((sum, item) => sum + (item.deduction_quantity * item.unit_price), 0).toLocaleString()}원
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-red-800">부가세 합계</span>
                    <div className="text-lg font-medium text-red-900">
                      -{formData.items.reduce((sum, item) => sum + Math.floor(item.deduction_quantity * item.unit_price * 0.1), 0).toLocaleString()}원
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-red-800">총 차감 금액</span>
                    <div className="text-xl font-bold text-red-600">
                      -{totalAmount.toLocaleString()}원
                    </div>
                  </div>
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

      {/* 상품 검색 모달 */}
      {showProductSearchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900">상품 검색</h3>
                <p className="text-sm text-gray-600 mt-1">상품명 또는 상품코드로 검색하세요.</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setShowProductSearchModal(false)
                  setSelectedProducts([])
                  setProductSearchTerm('')
                  setProductSearchResults([])
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                닫기
              </Button>
            </div>
            
            <div className="p-6">
              <div className="flex space-x-2 mb-6">
                <Input
                  type="text"
                  value={productSearchTerm}
                  onChange={(e) => {
                    setProductSearchTerm(e.target.value)
                    searchProducts(e.target.value)
                  }}
                  placeholder="상품명 또는 상품코드로 검색하세요"
                  className="flex-1 h-12"
                  autoFocus
                />
                <Button 
                  onClick={() => searchProducts(productSearchTerm)} 
                  disabled={isSearchingProducts}
                  className="h-12 px-6"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {isSearchingProducts ? '검색중...' : '검색'}
                </Button>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {isSearchingProducts ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">검색 중...</p>
                  </div>
                ) : productSearchResults.length > 0 ? (
                  <div className="space-y-4">
                    {productSearchResults.map((product) => {
                      // 색상과 사이즈 옵션 추출
                      const inventoryOptions = product.inventory_options as any[] || []
                      const colors: string[] = inventoryOptions.length > 0
                        ? [...new Set(inventoryOptions.map((opt: any) => opt.color).filter(Boolean).map(String))]
                        : ['기본']
                      const sizes: string[] = inventoryOptions.length > 0
                        ? [...new Set(inventoryOptions.map((opt: any) => opt.size).filter(Boolean).map(String))]
                        : ['FREE']
                      
                      return (
                        <div key={product.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-medium text-gray-900">{product.name}</h4>
                              <p className="text-sm text-gray-600">코드: {product.code}</p>
                              <p className="text-sm text-blue-600 font-medium">
                                {product.is_on_sale && product.sale_price 
                                  ? `${product.sale_price.toLocaleString()}원 (세일가)`
                                  : `${product.price.toLocaleString()}원`
                                }
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {colors.map((color) =>
                              sizes.map((size) => {
                                const isSelected = isProductSelected(product, color, size)
                                return (
                                  <Button
                                    key={`${color}-${size}`}
                                    variant={isSelected ? "default" : "outline"}
                                    onClick={() => toggleProductSelection(product, color, size)}
                                    className={`text-left justify-start ${
                                      isSelected 
                                        ? 'bg-blue-600 text-white border-blue-600' 
                                        : 'hover:bg-gray-50'
                                    }`}
                                  >
                                    {isSelected && <span className="mr-2">✓</span>}
                                    {color} / {size}
                                  </Button>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : productSearchTerm ? (
                  <div className="text-center py-8 text-gray-500">
                    검색 결과가 없습니다.
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    상품명 또는 상품코드를 입력하세요.
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  {selectedProducts.length > 0 && (
                    <span className="font-medium text-blue-600">
                      {selectedProducts.length}개 상품 선택됨
                    </span>
                  )}
                </div>
                {selectedProducts.length > 0 && (
                  <Button 
                    variant="ghost" 
                    onClick={() => setSelectedProducts([])}
                    className="text-red-600 hover:text-red-800"
                  >
                    선택 해제
                  </Button>
                )}
              </div>
              <div className="flex space-x-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowProductSearchModal(false)
                    setSelectedProducts([])
                    setProductSearchTerm('')
                    setProductSearchResults([])
                  }}
                >
                  취소
                </Button>
                <Button
                  onClick={addSelectedProductsToStatement}
                  disabled={selectedProducts.length === 0}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  선택한 상품 추가 ({selectedProducts.length})
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 