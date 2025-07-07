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
import ReturnStatementDetailModal from './return-statement-detail-modal'

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
    total_price?: number
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
    yearMonth: format(new Date(), 'yyyy-MM'),
    companyName: '',
    returnType: 'all',
    status: 'all'
  })
  const [processing, setProcessing] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedStatement, setSelectedStatement] = useState<ReturnStatement | null>(null)
  const [newStatement, setNewStatement] = useState({
    company_name: '',
    return_reason: '',
    return_type: 'customer_change' as const,
    refund_method: 'mileage' as const,
    items: [] as Array<{
      product_name: string
      color: string
      size: string
      return_quantity: number
      unit_price: number
      total_price: number
    }>
  })
  const [companySearchTerm, setCompanySearchTerm] = useState('')
  const [companySearchResults, setCompanySearchResults] = useState<any[]>([])
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false)
  const [showProductSearchModal, setShowProductSearchModal] = useState(false)
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null)
  const [productSearchTerm, setProductSearchTerm] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<any[]>([])
  const [isSearchingProducts, setIsSearchingProducts] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<{
    productId: string
    productName: string
    productCode: string
    color: string
    size: string
    unitPrice: number
    availableColors: string[]
    availableSizes: string[]
  }[]>([])

  useEffect(() => {
    fetchStatements()
  }, [filters])

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
    setNewStatement({ ...newStatement, company_name: company.company_name })
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
        unitPrice,
        availableColors: product.colors || [],
        availableSizes: product.sizes || []
      }])
    }
  }

  const addSelectedProductsToStatement = () => {
    if (selectedProducts.length === 0) {
      showError('추가할 상품을 선택해주세요.')
      return
    }

    const newItems = selectedProducts.map(product => ({
      product_name: product.productName,
      color: product.color,
      size: product.size,
      return_quantity: 1,
      unit_price: product.unitPrice,
      total_price: product.unitPrice,
      available_colors: product.availableColors,
      available_sizes: product.availableSizes
    }))

    setNewStatement(prev => ({
      ...prev,
      items: [...prev.items, ...newItems]
    }))

    setSelectedProducts([])
    setShowProductSearchModal(false)
    setProductSearchTerm('')
    setProductSearchResults([])
    showSuccess(`${selectedProducts.length}개 상품이 추가되었습니다.`)
  }

  const isProductSelected = (product: any, color: string, size: string) => {
    return selectedProducts.some(p => 
      p.productId === product.id && p.color === color && p.size === size
    )
  }

  const fetchStatements = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        yearMonth: filters.yearMonth,
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

    if (!confirm(`선택된 ${statementIds.length}건의 반품을 처리하시겠습니까?\n(마일리지 증가가 자동으로 적용됩니다)`)) {
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
        const { processedCount, totalMileageAdded, errors } = result.data
        let message = `반품 처리 완료: 성공 ${processedCount}건`
        
        if (totalMileageAdded > 0) {
          message += `, 총 마일리지 증가 ${totalMileageAdded.toLocaleString()}P`
        }
        
        if (errors && errors.length > 0) {
          message += `\n실패 ${errors.length}건: ${errors.join(', ')}`
        }
        
        showSuccess(message)
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

  const handleCreateStatement = async () => {
    // 필수 필드 검증
    if (!newStatement.company_name.trim()) {
      showError('업체명을 선택해주세요.')
      return
    }

    if (!newStatement.return_reason.trim()) {
      showError('반품 사유를 입력해주세요.')
      return
    }

    // 상품 정보 검증
    const invalidItems = newStatement.items.filter(item => 
      !item.product_name.trim() || item.return_quantity <= 0 || item.unit_price <= 0
    )
    
    if (invalidItems.length > 0) {
      showError('모든 상품의 정보를 올바르게 입력해주세요.')
      return
    }

    // 선택된 회사명이 검색 결과에 있는지 확인
    if (companySearchTerm && companySearchTerm !== newStatement.company_name) {
      showError('검색 결과에서 업체를 선택해주세요.')
      return
    }

    try {
      setProcessing(true)
      const response = await fetch('/api/admin/return-statements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newStatement)
      })

      const result = await response.json()

      if (result.success) {
        showSuccess('반품 명세서가 성공적으로 생성되었습니다.')
        setShowCreateModal(false)
        setCompanySearchTerm('')
        setCompanySearchResults([])
        setShowCompanyDropdown(false)
        setNewStatement({
          company_name: '',
          return_reason: '',
          return_type: 'customer_change' as const,
          refund_method: 'mileage' as const,
          items: []
        })
        await fetchStatements()
      } else {
        showError(`반품 명세서 생성 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Return statement creation error:', error)
      showError('반품 명세서 생성 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  const addStatementItem = () => {
    setNewStatement({
      ...newStatement,
      items: [...newStatement.items, {
        product_name: '',
        color: '',
        size: '',
        return_quantity: 0,
        unit_price: 0,
        total_price: 0
      }]
    })
  }

  const removeStatementItem = (index: number) => {
    if (newStatement.items.length > 1) {
      const newItems = newStatement.items.filter((_, i) => i !== index)
      setNewStatement({ ...newStatement, items: newItems })
    }
  }

  const updateStatementItem = (index: number, field: string, value: any) => {
    const newItems = [...newStatement.items]
    newItems[index] = { ...newItems[index], [field]: value }
    
    // 수량과 단가가 변경되면 총 가격 자동 계산
    if (field === 'return_quantity' || field === 'unit_price') {
      const quantity = field === 'return_quantity' ? value : newItems[index].return_quantity
      const unitPrice = field === 'unit_price' ? value : newItems[index].unit_price
      newItems[index].total_price = quantity * unitPrice
    }
    
    setNewStatement({ ...newStatement, items: newItems })
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

  const handleViewDetail = (statement: ReturnStatement) => {
    setSelectedStatement(statement)
    setShowDetailModal(true)
  }

  const handleUpdateItems = async (statementId: string, items: ReturnStatement['items']) => {
    try {
      const response = await fetch(`/api/admin/return-statements/${statementId}/items`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ items })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess('반품 상품 정보가 업데이트되었습니다.')
        await fetchStatements()
        // 선택된 명세서 정보도 업데이트
        if (selectedStatement) {
          setSelectedStatement({
            ...selectedStatement,
            items: items
          })
        }
      } else {
        showError(`업데이트 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Update items error:', error)
      showError('업데이트 중 오류가 발생했습니다.')
    }
  }

  const handleDeleteStatement = async (statementId: string) => {
    if (!confirm('이 반품명세서를 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/return-statements/${statementId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        showSuccess('반품명세서가 삭제되었습니다.')
        await fetchStatements()
      } else {
        showError(`삭제 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      showError('삭제 중 오류가 발생했습니다.')
    }
  }

  const handleRejectStatement = async (statementId: string) => {
    const reason = prompt('반품 거절 사유를 입력해주세요:')
    if (!reason || !reason.trim()) {
      return
    }

    try {
      const response = await fetch(`/api/admin/return-statements/${statementId}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reason.trim() })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess('반품이 거절되었습니다.')
        await fetchStatements()
      } else {
        showError(`거절 처리 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('Reject error:', error)
      showError('거절 처리 중 오류가 발생했습니다.')
    }
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
            onClick={() => setShowCreateModal(true)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <FileText className="h-4 w-4 mr-2" />
            반품 명세서 생성
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
              조회 월
            </label>
            <Input
              type="month"
              value={filters.yearMonth}
              onChange={(e) => setFilters(prev => ({ ...prev, yearMonth: e.target.value }))}
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
                  <td colSpan={11} className="px-6 py-4 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : statements.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-4 text-center text-gray-500">
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
                      <div className="flex space-x-1">
                        <Button
                          onClick={() => handleViewDetail(statement)}
                          size="sm"
                          variant="outline"
                          title="상세보기"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={() => handleStatementDownload(statement.id)}
                          size="sm"
                          variant="outline"
                          title="다운로드"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {statement.status === 'pending' && (
                          <Button
                            onClick={() => handleRejectStatement(statement.id)}
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-800"
                            title="거절"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          onClick={() => handleDeleteStatement(statement.id)}
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-800"
                          title="삭제"
                        >
                          <AlertTriangle className="h-4 w-4" />
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

      {/* 반품 명세서 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">반품 명세서 생성</h3>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false)
                  setCompanySearchTerm('')
                  setCompanySearchResults([])
                  setShowCompanyDropdown(false)
                  setNewStatement({
                    company_name: '',
                    return_reason: '',
                    return_type: 'customer_change' as const,
                    refund_method: 'mileage' as const,
                    items: []
                  })
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                닫기
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-6">
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
                      반품 유형
                    </label>
                    <select
                      value={newStatement.return_type}
                      onChange={(e) => setNewStatement({...newStatement, return_type: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="defect">불량</option>
                      <option value="size_issue">사이즈 문제</option>
                      <option value="color_issue">색상 문제</option>
                      <option value="customer_change">고객 변심</option>
                      <option value="other">기타</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      환불 방법
                    </label>
                    <select
                      value={newStatement.refund_method}
                      onChange={(e) => setNewStatement({...newStatement, refund_method: e.target.value as any})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="mileage">마일리지</option>
                      <option value="card">카드</option>
                      <option value="bank_transfer">계좌이체</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      반품 사유 *
                    </label>
                    <Input
                      type="text"
                      value={newStatement.return_reason}
                      onChange={(e) => setNewStatement({...newStatement, return_reason: e.target.value})}
                      placeholder="반품 사유를 입력하세요"
                    />
                  </div>
                </div>

                {/* 상품 목록 */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-medium text-gray-900">반품 상품</h4>
                    <div className="flex gap-2">
                      <Button
                        onClick={addStatementItem}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        상품 추가
                      </Button>
                      <Button
                        onClick={() => setShowProductSearchModal(true)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        상품 검색
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {newStatement.items.map((item, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h5 className="font-medium text-gray-900">상품 {index + 1}</h5>
                          {newStatement.items.length > 1 && (
                            <Button
                              onClick={() => removeStatementItem(index)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              삭제
                            </Button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              상품명 *
                            </label>
                            <Input
                              type="text"
                              value={item.product_name}
                              onChange={(e) => updateStatementItem(index, 'product_name', e.target.value)}
                              placeholder="상품명"
                              className="w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              컬러
                            </label>
                            {(item as any).available_colors && (item as any).available_colors.length > 0 ? (
                              <select
                                value={item.color}
                                onChange={(e) => updateStatementItem(index, 'color', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">색상 선택</option>
                                {(item as any).available_colors.map((color: string) => (
                                  <option key={color} value={color}>
                                    {color}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <Input
                                type="text"
                                value={item.color}
                                onChange={(e) => updateStatementItem(index, 'color', e.target.value)}
                                placeholder="컬러"
                              />
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              사이즈
                            </label>
                            {(item as any).available_sizes && (item as any).available_sizes.length > 0 ? (
                              <select
                                value={item.size}
                                onChange={(e) => updateStatementItem(index, 'size', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                <option value="">사이즈 선택</option>
                                {(item as any).available_sizes.map((size: string) => (
                                  <option key={size} value={size}>
                                    {size}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <Input
                                type="text"
                                value={item.size}
                                onChange={(e) => updateStatementItem(index, 'size', e.target.value)}
                                placeholder="사이즈"
                              />
                            )}
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              수량 *
                            </label>
                            <Input
                              type="number"
                              min="1"
                              value={item.return_quantity}
                              onChange={(e) => updateStatementItem(index, 'return_quantity', parseInt(e.target.value) || 0)}
                              placeholder="수량"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              단가 *
                            </label>
                            <Input
                              type="number"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => updateStatementItem(index, 'unit_price', parseInt(e.target.value) || 0)}
                              placeholder="단가"
                            />
                          </div>
                        </div>
                        
                        <div className="mt-3 text-right">
                          <span className="text-sm text-gray-600">
                            총 가격: <span className="font-medium">{item.total_price?.toLocaleString()}원</span>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 text-right">
                    <span className="text-lg font-medium text-gray-900">
                      총 환불 금액: {newStatement.items.reduce((sum, item) => sum + (item.total_price || 0), 0).toLocaleString()}원
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false)
                  setCompanySearchTerm('')
                  setCompanySearchResults([])
                  setShowCompanyDropdown(false)
                  setNewStatement({
                    company_name: '',
                    return_reason: '',
                    return_type: 'customer_change' as const,
                    refund_method: 'mileage' as const,
                    items: []
                  })
                }}
              >
                취소
              </Button>
              <Button
                onClick={handleCreateStatement}
                className="bg-green-600 hover:bg-green-700"
              >
                반품 명세서 생성
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 반품명세서 상세보기 모달 */}
      <ReturnStatementDetailModal
        statement={selectedStatement as ReturnStatement}
        isOpen={showDetailModal}
        onClose={() => {
          setShowDetailModal(false)
          setSelectedStatement(null)
        }}
        onApprove={(statementId) => handleProcessReturn([statementId])}
        onReject={handleRejectStatement}
        onUpdateItems={handleUpdateItems}
        getReturnTypeText={getReturnTypeText}
        getReturnTypeColor={getReturnTypeColor}
        getStatusText={getStatusText}
        getStatusColor={getStatusColor}
      />

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