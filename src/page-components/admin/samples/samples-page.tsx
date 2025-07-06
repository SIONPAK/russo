'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { formatCurrency, formatDateTime } from '@/shared/lib/utils'
import { downloadSampleShippingExcel, downloadOrderShippingExcel, parseTrackingExcel } from '@/shared/lib/excel-utils'
import { showSuccess, showError, showInfo } from '@/shared/lib/toast'
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Download, 
  Package, 
  Upload,
  FileText,
  X,
  RotateCcw,
  CreditCard,
  Send,
  CheckCircle,
  Users
} from 'lucide-react'

// 샘플 명세서 인터페이스
interface SampleStatement {
  id: string
  sample_number: string
  customer_id: string
  customer_name: string
  product_id: string
  product_name: string
  product_options: string
  color: string
  size: string
  quantity: number
  unit_price: number
  total_price: number
  status: 'shipped' | 'returned' | 'charged'
  outgoing_date: string | null
  due_date: string | null
  days_remaining: number | null
  is_overdue: boolean
  tracking_number: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string
}

// 샘플 아이템 인터페이스
interface SampleItem {
  id: string
  product_id: string
  product_code: string
  product_name: string
  color: string
  size: string
  quantity: number
  unit_price: number
}

export function SamplesPage() {
  const [statements, setStatements] = useState<SampleStatement[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatements, setSelectedStatements] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  })
  const [stats, setStats] = useState({
    shipped: 0,
    returned: 0,
    charged: 0
  })

  // 명세서 생성 관련 상태
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showCreateStatementModal, setShowCreateStatementModal] = useState(false)
  const [sampleItems, setSampleItems] = useState<SampleItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerSearchKeyword, setCustomerSearchKeyword] = useState('')
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([])
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [productSearchKeyword, setProductSearchKeyword] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<any[]>([])
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const [selectedOrders, setSelectedOrders] = useState<any[]>([])
  const [showOrderSearch, setShowOrderSearch] = useState(false)
  const [orderSearchKeyword, setOrderSearchKeyword] = useState('')
  const [orderSearchResults, setOrderSearchResults] = useState<any[]>([])
  const [sampleType, setSampleType] = useState<'photography' | 'sales'>('sales')

  // D-21 날짜 계산 함수
  const calculateDaysRemaining = (createdAt: string) => {
    const createdDate = new Date(createdAt)
    const returnDeadline = new Date(createdDate.getTime() + (21 * 24 * 60 * 60 * 1000)) // 21일 후
    const today = new Date()
    const diffTime = returnDeadline.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return { daysRemaining: diffDays, isOverdue: diffDays < 0 }
  }

  // 날짜 포맷 함수
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }) + ' ' + date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 알림 함수들
  const showSuccess = (message: string) => {
    alert(message)
  }

  const showError = (message: string) => {
    alert(message)
  }

  const showInfo = (message: string) => {
    alert(message)
  }

  // 통화 포맷 함수
  const formatCurrency = (amount: number) => {
    return `₩${amount.toLocaleString()}`
  }

  // 명세서 목록 조회
  const fetchStatements = async (filterParams = filters) => {
    try {
      setLoading(true)
      const queryParams = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...filterParams
      })

      const response = await fetch(`/api/admin/sample-statements?${queryParams}`)
      const result = await response.json()

      if (result.success) {
        setStatements(result.data.statements || [])
        // 통계 데이터도 업데이트
        if (result.data.stats) {
          setStats(result.data.stats)
        }
      } else {
        showError(result.error || '명세서 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('명세서 조회 오류:', error)
      showError('명세서 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatements()
  }, [currentPage])

  // 일괄 상태 업데이트 함수
  const handleBulkAction = async (status: string) => {
    if (selectedStatements.length === 0) return
    
    const statusLabels: {[key: string]: string} = {
      'shipped': '출고완료',
      'returned': '회수완료',
      'charged': '샘플결제'
    }
    
    const confirmMessage = status === 'charged' 
      ? `선택된 ${selectedStatements.length}개 명세서를 샘플결제로 변경하시겠습니까?\n고객의 마일리지에서 샘플 금액이 차감됩니다.`
      : `선택된 ${selectedStatements.length}개 명세서를 "${statusLabels[status]}"로 변경하시겠습니까?`
    
    if (!confirm(confirmMessage)) return
    
    try {
      const response = await fetch('/api/admin/sample-statements', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: `mark_${status}`,
          sample_ids: selectedStatements
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        showSuccess(`${selectedStatements.length}개 명세서의 상태가 변경되었습니다.`)
        setSelectedStatements([])
        fetchStatements()
      } else {
        showError(result.error || '상태 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('일괄 상태 업데이트 오류:', error)
      showError('상태 변경 중 오류가 발생했습니다.')
    }
  }

  // 필터링된 명세서 목록
  const filteredStatements = statements.filter(statement => {
    const matchesSearch = !filters.search || 
      statement.customer_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
      statement.sample_number?.toLowerCase().includes(filters.search.toLowerCase()) ||
      statement.product_name?.toLowerCase().includes(filters.search.toLowerCase())
    
    const matchesStatus = !filters.status || statement.status === filters.status
    
    return matchesSearch && matchesStatus
  })

  // 페이지네이션된 명세서 목록
  const paginatedStatements = filteredStatements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // 통계는 상태로 관리 (fetchStatements에서 업데이트됨)

  // 고객 검색 함수
  const searchCustomers = async (keyword: string) => {
    if (!keyword.trim()) {
      setCustomerSearchResults([])
      return
    }

    try {
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(keyword)}&limit=10`)
      const result = await response.json()

      if (result.success) {
        setCustomerSearchResults(result.data)
      }
    } catch (error) {
      console.error('고객 검색 오류:', error)
    }
  }

  // 상품 검색 함수
  const searchProducts = async (keyword: string) => {
    if (!keyword.trim()) {
      setProductSearchResults([])
      return
    }

    try {
      const response = await fetch(`/api/admin/products?search=${encodeURIComponent(keyword)}&limit=20`)
      const result = await response.json()

      if (result.success) {
        setProductSearchResults(result.data)
      }
    } catch (error) {
      console.error('상품 검색 오류:', error)
    }
  }

  // 샘플 아이템 추가
  const addSampleItem = () => {
    const newItem: SampleItem = {
      id: Date.now().toString(),
      product_id: '',
      product_code: '',
      product_name: '',
      color: '',
      size: '',
      quantity: 1,
      unit_price: 0
    }
    setSampleItems([...sampleItems, newItem])
  }

  // 샘플 아이템 제거
  const removeSampleItem = (index: number) => {
    const newItems = sampleItems.filter((_, i) => i !== index)
    setSampleItems(newItems)
  }

  // 상품 선택
  const selectProduct = (product: any, color: string, size: string) => {
    if (selectedRowIndex === null) return

    const updatedItems = [...sampleItems]
    updatedItems[selectedRowIndex] = {
      ...updatedItems[selectedRowIndex],
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      color,
      size,
      unit_price: product.price || 0
    }

    setSampleItems(updatedItems)
    setShowProductSearch(false)
    setSelectedRowIndex(null)
  }

  // 주문 검색 함수
  const searchOrders = async (keyword: string) => {
    if (!keyword.trim()) {
      setOrderSearchResults([])
      return
    }

    try {
      const response = await fetch(`/api/admin/orders?search=${encodeURIComponent(keyword)}&limit=10&status=confirmed`)
      const result = await response.json()

      if (result.success) {
        setOrderSearchResults(result.data)
      }
    } catch (error) {
      console.error('주문 검색 오류:', error)
    }
  }

  // 샘플 명세서 생성 (주문에서)
  const createSampleStatementFromOrder = async () => {
    if (selectedOrders.length === 0) {
      showError('주문을 선택해주세요.')
      return
    }

    try {
      const promises = selectedOrders.map(order => 
        fetch('/api/admin/sample-statements/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer_id: order.user_id,
            from_order_id: order.id,
            sample_type: sampleType,
            admin_notes: `${order.order_number}에서 생성된 샘플 명세서`
          })
        }).then(res => res.json())
      )

      const results = await Promise.all(promises)
      const successCount = results.filter(result => result.success).length
      const failCount = results.length - successCount

      if (successCount > 0) {
        showSuccess(`${successCount}개의 샘플 명세서가 생성되었습니다.${failCount > 0 ? ` (${failCount}개 실패)` : ''}`)
        setShowCreateStatementModal(false)
        setSelectedOrders([])
        fetchStatements()
      } else {
        showError('샘플 명세서 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('샘플 명세서 생성 오류:', error)
      showError('샘플 명세서 생성 중 오류가 발생했습니다.')
    }
  }

  // 샘플 명세서 생성 (직접 입력)
  const createSampleStatement = async () => {
    if (!selectedCustomer) {
      showError('고객을 선택해주세요.')
      return
    }

    if (sampleItems.length === 0) {
      showError('샘플 상품을 추가해주세요.')
      return
    }

    if (sampleItems.some(item => !item.product_id || item.quantity <= 0)) {
      showError('모든 상품 정보를 입력해주세요.')
      return
    }

    try {
      const response = await fetch('/api/admin/sample-statements/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          items: sampleItems,
          sample_type: sampleType
        })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess('샘플 명세서가 생성되었습니다.')
        setShowCreateModal(false)
        setSampleItems([])
        setSelectedCustomer(null)
        fetchStatements()
      } else {
        showError(result.error || '샘플 명세서 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('샘플 명세서 생성 오류:', error)
      showError('샘플 명세서 생성 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">샘플 관리</h1>
          <p className="text-gray-600">촬영용 샘플 출고 및 회수 관리</p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={() => setShowCreateModal(true)} className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            샘플 생성
          </Button>
          <Button variant="outline" onClick={() => setShowCreateStatementModal(true)}>
            <FileText className="h-4 w-4 mr-2" />
            샘플 명세서 생성
          </Button>
          <Button variant="outline" onClick={() => showInfo('배송정보 다운로드 기능은 현재 구현되지 않았습니다.')}>
            <Download className="h-4 w-4 mr-2" />
            배송정보 다운로드
          </Button>
          <div className="relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  showInfo('운송장 번호 업로드 기능은 현재 구현되지 않았습니다.')
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Button
              variant="outline"
              className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
            >
              <Upload className="h-4 w-4 mr-2" />
              운송장번호 업로드
            </Button>
          </div>
          <Button variant="outline" onClick={() => showInfo('운송장 일괄 등록 기능은 현재 구현되지 않았습니다.')}>
            <Upload className="h-4 w-4 mr-2" />
            운송장 일괄 등록
          </Button>
          <Button>
            <Package className="h-4 w-4 mr-2" />
            일괄 처리
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <div className="flex items-center">
            <Send className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">출고완료</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.shipped}건
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">회수완료</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.returned}건
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <div className="flex items-center">
            <X className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">샘플결제</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.charged}건
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="샘플번호, 고객명, 상품명 검색"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="pl-10 border-gray-200 focus:border-blue-300 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <select
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">전체 상태</option>
              <option value="shipped">출고완료</option>
              <option value="returned">회수완료</option>
              <option value="charged">샘플결제</option>
            </select>

            <Button onClick={() => fetchStatements(filters)} className="bg-blue-600 hover:bg-blue-700">
              <Search className="h-4 w-4 mr-2" />
              검색
            </Button>
          </div>
        </div>
      </div>

      {/* 일괄 처리 버튼 */}
      <div className="flex items-center space-x-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleBulkAction('shipped')}
          disabled={selectedStatements.length === 0}
          className="text-xs"
        >
          <Package className="h-3 w-3 mr-1" />
          출고완료
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleBulkAction('returned')}
          disabled={selectedStatements.length === 0}
          className="text-xs"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          회수완료
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleBulkAction('charged')}
          disabled={selectedStatements.length === 0}
          className="text-xs"
        >
          <CreditCard className="h-3 w-3 mr-1" />
          샘플결제
        </Button>
      </div>

      {/* 명세서 목록 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-12 px-4 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedStatements.length === statements.length && statements.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStatements(statements.map(s => s.id))
                      } else {
                        setSelectedStatements([])
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  샘플코드
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  품목명
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  컬러
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  사이즈
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  수량
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  단가
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  부가세
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  고객
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  남은 기간
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  생성일
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedStatements.map((statement) => (
                <tr key={statement.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedStatements.includes(statement.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStatements([...selectedStatements, statement.id])
                        } else {
                          setSelectedStatements(selectedStatements.filter(id => id !== statement.id))
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {statement.sample_number}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {statement.product_name}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900">
                      {statement.color}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900">
                      {statement.size}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900">
                      {statement.quantity}개
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      ₩{statement.unit_price.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      ₩{statement.total_price.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900">
                      {statement.customer_name}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900">
                      {statement.days_remaining !== null ? (
                        <span className={statement.is_overdue ? 'text-red-600 font-medium' : 'text-gray-900'}>
                          {statement.is_overdue ? `D+${Math.abs(statement.days_remaining)}` : `D-${statement.days_remaining}`}
                        </span>
                      ) : '-'}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900">
                      {statement.created_at ? formatDateTime(statement.created_at) : '-'}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        statement.status === 'shipped' ? 'bg-yellow-100 text-yellow-800' :
                        statement.status === 'returned' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {statement.status === 'shipped' ? '출고완료' : 
                         statement.status === 'returned' ? '회수완료' : '샘플결제'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {/* 상태 변경 드롭다운 */}
                      <select
                        value={statement.status}
                        onChange={async (e) => {
                          const newStatus = e.target.value
                          if (newStatus === statement.status) return
                          
                          const statusLabels: {[key: string]: string} = {
                            'shipped': '출고완료',
                            'returned': '회수완료',
                            'charged': '샘플결제'
                          }
                          
                          const confirmMessage = newStatus === 'charged' 
                            ? `샘플 결제로 변경하시겠습니까?\n고객의 마일리지에서 샘플 금액이 차감됩니다.`
                            : `상태를 "${statusLabels[newStatus]}"로 변경하시겠습니까?`
                          
                          if (!confirm(confirmMessage)) {
                            e.target.value = statement.status // 원래 값으로 되돌리기
                            return
                          }
                          
                          try {
                            const response = await fetch('/api/admin/sample-statements', {
                              method: 'PATCH',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                action: `mark_${newStatus}`,
                                sample_ids: [statement.id]
                              })
                            })
                            
                            const result = await response.json()
                            
                            if (result.success) {
                              showSuccess('상태가 변경되었습니다.')
                              fetchStatements()
                            } else {
                              showError(result.error || '상태 변경에 실패했습니다.')
                              e.target.value = statement.status // 원래 값으로 되돌리기
                            }
                          } catch (error) {
                            console.error('상태 변경 오류:', error)
                            showError('상태 변경 중 오류가 발생했습니다.')
                            e.target.value = statement.status // 원래 값으로 되돌리기
                          }
                        }}
                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="shipped">출고완료</option>
                        <option value="returned">회수완료</option>
                        <option value="charged">샘플결제</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* 로딩 상태 */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {/* 데이터 없음 */}
        {!loading && statements.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">등록된 샘플이 없습니다.</p>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between bg-white px-4 py-3 border-t border-gray-200">
        <div className="flex-1 flex justify-between sm:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            이전
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredStatements.length / itemsPerPage), prev + 1))}
            disabled={currentPage === Math.ceil(filteredStatements.length / itemsPerPage)}
          >
            다음
          </Button>
        </div>
        
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              총 <span className="font-medium">{filteredStatements.length}</span>개 중{' '}
              <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, filteredStatements.length)}</span>-
              <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredStatements.length)}</span>개 표시
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              이전
            </Button>
            
            {Array.from({ length: Math.ceil(filteredStatements.length / itemsPerPage) }, (_, i) => i + 1)
              .filter(page => {
                const totalPages = Math.ceil(filteredStatements.length / itemsPerPage)
                return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2
              })
              .map((page, index, array) => (
                <React.Fragment key={page}>
                  {index > 0 && array[index - 1] !== page - 1 && (
                    <span className="text-gray-400">...</span>
                  )}
                  <Button
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="min-w-[2.5rem]"
                  >
                    {page}
                  </Button>
                </React.Fragment>
              ))}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredStatements.length / itemsPerPage), prev + 1))}
              disabled={currentPage === Math.ceil(filteredStatements.length / itemsPerPage)}
            >
              다음
            </Button>
          </div>
        </div>
      </div>

      {/* 샘플 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">샘플 생성</h3>
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
              {/* 고객 선택 */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">고객 선택</h4>
                <div className="flex gap-3">
                  <div className="flex-1">
                    {selectedCustomer ? (
                      <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div>
                          <div className="font-medium text-blue-900">{selectedCustomer.company_name}</div>
                          <div className="text-sm text-blue-600">{selectedCustomer.representative_name}</div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setSelectedCustomer(null)}
                          className="text-blue-600 border-blue-300"
                        >
                          변경
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        onClick={() => setShowCustomerSearch(true)}
                        className="w-full p-3 border-dashed"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        고객 선택
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* 샘플 상품 목록 */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-medium text-gray-900">샘플 상품</h4>
                  <Button onClick={addSampleItem} size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    상품 추가
                  </Button>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No.</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">품목코드</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">품목명</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">컬러</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">사이즈</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수량</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">단가</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sampleItems.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                              <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                              <p>샘플 상품을 추가해주세요.</p>
                            </td>
                          </tr>
                        ) : (
                          sampleItems.map((item, index) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                              <td className="px-4 py-3">
                                <div
                                  className="text-sm text-blue-600 cursor-pointer hover:text-blue-800 font-medium"
                                  onDoubleClick={() => {
                                    setSelectedRowIndex(index)
                                    setShowProductSearch(true)
                                    setProductSearchKeyword('')
                                    setProductSearchResults([])
                                  }}
                                  title="더블클릭하여 상품 검색"
                                >
                                  {item.product_code}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{item.product_name}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{item.color}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{item.size}</td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const updatedItems = [...sampleItems]
                                    updatedItems[index].quantity = parseInt(e.target.value) || 1
                                    setSampleItems(updatedItems)
                                  }}
                                  className="w-20 px-2 py-1 text-center border border-gray-300 rounded"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(item.unit_price)}</td>
                              <td className="px-4 py-3">
                                <Button size="sm" variant="destructive" onClick={() => removeSampleItem(index)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      
                      {sampleItems.length > 0 && (
                        <tfoot className="bg-gray-50">
                          <tr className="font-medium">
                            <td colSpan={6} className="px-4 py-3 text-right text-sm text-gray-900">합계:</td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatCurrency(sampleItems.reduce((total, item) => total + item.unit_price * item.quantity, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  취소
                </Button>
                <Button 
                  onClick={createSampleStatement} 
                  disabled={!selectedCustomer || sampleItems.length === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  샘플 생성
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 고객 검색 모달 */}
      {showCustomerSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">고객 검색</h3>
                <Button variant="outline" onClick={() => setShowCustomerSearch(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="회사명 또는 대표자명으로 검색"
                  value={customerSearchKeyword}
                  onChange={(e) => {
                    setCustomerSearchKeyword(e.target.value)
                    searchCustomers(e.target.value)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {customerSearchResults.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {customerSearchKeyword ? '검색 결과가 없습니다.' : '검색어를 입력해주세요.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customerSearchResults.map((customer) => (
                      <div
                        key={customer.id}
                        className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedCustomer(customer)
                          setShowCustomerSearch(false)
                        }}
                      >
                        <div className="font-medium text-gray-900">{customer.company_name}</div>
                        <div className="text-sm text-gray-600">{customer.representative_name}</div>
                        <div className="text-xs text-gray-500">{customer.email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상품 검색 모달 */}
      {showProductSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">상품 검색</h3>
                <Button variant="outline" onClick={() => setShowProductSearch(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="상품명 또는 상품코드로 검색"
                  value={productSearchKeyword}
                  onChange={(e) => {
                    setProductSearchKeyword(e.target.value)
                    searchProducts(e.target.value)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="max-h-[500px] overflow-y-auto">
                {productSearchResults.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {productSearchKeyword ? '검색 결과가 없습니다.' : '검색어를 입력해주세요.'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {productSearchResults.map((product) => (
                      <div key={product.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-600">코드: {product.code}</div>
                            <div className="text-sm text-blue-600 font-medium">{formatCurrency(product.price)}</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {product.inventory_options?.map((option: any) => (
                            <Button
                              key={`${option.color}-${option.size}`}
                              variant="outline"
                              onClick={() => selectProduct(product, option.color, option.size)}
                              className="text-left justify-start"
                            >
                              {option.color} / {option.size}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 샘플 명세서 생성 모달 */}
      {showCreateStatementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">샘플 명세서 생성</h3>
                <Button variant="outline" onClick={() => setShowCreateStatementModal(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
              {/* 샘플 타입 선택 */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">샘플 타입</h4>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="sampleType"
                      value="photography"
                      checked={sampleType === 'photography'}
                      onChange={(e) => setSampleType(e.target.value as 'photography' | 'sales')}
                      className="mr-2"
                    />
                    촬영용 (무료)
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="sampleType"
                      value="sales"
                      checked={sampleType === 'sales'}
                      onChange={(e) => setSampleType(e.target.value as 'photography' | 'sales')}
                      className="mr-2"
                    />
                    판매용 (유료)
                  </label>
                </div>
              </div>

              {/* 주문 검색 */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900 mb-3">주문 선택</h4>
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="주문번호 또는 고객명으로 검색"
                    value={orderSearchKeyword}
                    onChange={(e) => {
                      setOrderSearchKeyword(e.target.value)
                      searchOrders(e.target.value)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg">
                  {orderSearchResults.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      {orderSearchKeyword ? '검색 결과가 없습니다.' : '주문을 검색해주세요.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {orderSearchResults.map((order) => (
                        <div
                          key={order.id}
                          className={`p-4 hover:bg-gray-50 cursor-pointer ${
                            selectedOrders.some(o => o.id === order.id) ? 'bg-blue-50 border-blue-200' : ''
                          }`}
                          onClick={() => {
                            if (selectedOrders.some(o => o.id === order.id)) {
                              setSelectedOrders(selectedOrders.filter(o => o.id !== order.id))
                            } else {
                              setSelectedOrders([...selectedOrders, order])
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium text-gray-900">{order.order_number}</div>
                              <div className="text-sm text-gray-600">{order.shipping_name}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(order.created_at).toLocaleDateString('ko-KR')} | 
                                총 {order.total_amount?.toLocaleString()}원
                              </div>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={selectedOrders.some(o => o.id === order.id)}
                                onChange={() => {}}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedOrders.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-sm font-medium text-blue-900">
                      선택된 주문: {selectedOrders.length}개
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {selectedOrders.map(order => order.order_number).join(', ')}
                    </div>
                  </div>
                )}
              </div>

              {/* 액션 버튼 */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowCreateStatementModal(false)}>
                  취소
                </Button>
                <Button 
                  onClick={createSampleStatementFromOrder} 
                  disabled={selectedOrders.length === 0}
                  className="bg-green-600 hover:bg-green-700"
                >
                  샘플 명세서 생성 ({selectedOrders.length}개)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 