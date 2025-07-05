'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { formatCurrency, formatDateTime } from '@/shared/lib/utils'
import { downloadSampleShippingExcel, downloadOrderShippingExcel, parseTrackingExcel } from '@/shared/lib/excel-utils'
import { showSuccess, showError, showInfo } from '@/shared/lib/toast'
import { 
  Search, 
  Filter, 
  Eye,
  Send,
  Undo,
  Download,
  Plus,
  Package,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Upload,
  FileText,
  X
} from 'lucide-react'

interface SampleItem {
  id: string
  productId: string
  productCode: string
  productName: string
  color: string
  size: string
  quantity: number
  unitPrice: number
  supplyAmount: number
  vat: number
}

export function SamplesPage() {
  const [samples, setSamples] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const [filters, setFilters] = useState({
    search: '',
    status: 'all'
  })
  const [selectedSamples, setSelectedSamples] = useState<string[]>([])
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedSampleDetail, setSelectedSampleDetail] = useState<any>(null)
  
  // 샘플 생성 관련 상태
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [sampleItems, setSampleItems] = useState<SampleItem[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerSearchKeyword, setCustomerSearchKeyword] = useState('')
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([])
  const [showProductSearch, setShowProductSearch] = useState(false)
  const [productSearchKeyword, setProductSearchKeyword] = useState('')
  const [productSearchResults, setProductSearchResults] = useState<any[]>([])
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  
  const fetchSamples = async (params: {
    page?: number
    status?: string
    search?: string
  } = {}) => {
    setLoading(true)
    try {
      const searchParams = new URLSearchParams({
        page: (params.page || pagination.page).toString(),
        limit: pagination.limit.toString(),
      })

      if (params.status && params.status !== 'all') searchParams.append('status', params.status)
      if (params.search) searchParams.append('search', params.search)

      const response = await fetch(`/api/admin/samples?${searchParams}`)
      const result = await response.json()

      if (result.success) {
        setSamples(result.data || [])
        setPagination(result.pagination)
      } else {
        console.error('샘플 조회 실패:', result.error)
        setSamples([])
      }
    } catch (error) {
      console.error('샘플 조회 중 오류:', error)
      setSamples([])
    } finally {
      setLoading(false)
    }
  }

  const handleBulkStatusUpdate = async (status: string, trackingData?: { sampleId: string, trackingNumber: string }[]) => {
    try {
      const response = await fetch('/api/admin/samples', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'bulk_status_update',
          sampleIds: selectedSamples,
          status,
          trackingData
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert(`${selectedSamples.length}개 샘플의 상태가 업데이트되었습니다.`)
        await fetchSamples(filters)
        setSelectedSamples([])
        setShowTrackingModal(false)
      } else {
        alert(result.error || '상태 업데이트에 실패했습니다.')
      }
    } catch (error) {
      console.error('일괄 상태 업데이트 중 오류:', error)
      alert('상태 업데이트 중 오류가 발생했습니다.')
    }
  }

  const handleStatusUpdate = async (sampleId: string, newStatus: string, trackingNumber?: string) => {
    try {
      const response = await fetch('/api/admin/samples', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sampleId,
          status: newStatus,
          trackingNumber,
          outgoingDate: newStatus === 'shipped' ? new Date().toISOString() : undefined
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert('샘플 상태가 업데이트되었습니다.')
        await fetchSamples(filters)
      } else {
        alert(result.error || '상태 업데이트에 실패했습니다.')
      }
    } catch (error) {
      console.error('상태 업데이트 중 오류:', error)
      alert('상태 업데이트 중 오류가 발생했습니다.')
    }
  }

  // 개별 상태 변경 함수들
  const handleApprove = async (sampleId: string) => {
    console.log('handleApprove called with:', sampleId)
    if (confirm('이 샘플 요청을 승인하시겠습니까?')) {
      await handleStatusUpdate(sampleId, 'approved')
    }
  }

  const handleReject = async (sampleId: string) => {
    console.log('handleReject called with:', sampleId)
    if (confirm('이 샘플 요청을 거절하시겠습니까?')) {
      await handleStatusUpdate(sampleId, 'rejected')
    }
  }

  const handlePrepare = async (sampleId: string) => {
    console.log('handlePrepare called with:', sampleId)
    if (confirm('이 샘플을 준비 상태로 변경하시겠습니까?')) {
      await handleStatusUpdate(sampleId, 'preparing')
    }
  }

  const handleShip = async (sampleId: string) => {
    console.log('handleShip called with:', sampleId)
    const trackingNumber = prompt('운송장 번호를 입력하세요:')
    if (trackingNumber) {
      await handleStatusUpdate(sampleId, 'shipped', trackingNumber)
    }
  }

  const handleDeliver = async (sampleId: string) => {
    console.log('handleDeliver called with:', sampleId)
    if (confirm('이 샘플을 배송완료 상태로 변경하시겠습니까?')) {
      await handleStatusUpdate(sampleId, 'delivered')
    }
  }

  const handleReturn = async (sampleId: string) => {
    console.log('handleReturn called with:', sampleId)
    if (confirm('이 샘플을 회수완료 상태로 변경하시겠습니까?')) {
      await handleStatusUpdate(sampleId, 'returned')
    }
  }

  // 상세보기 함수
  const handleViewDetail = (sample: any) => {
    console.log('handleViewDetail called with:', sample)
    setSelectedSampleDetail(sample)
    setShowDetailModal(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-orange-600 bg-orange-100'
      case 'approved': return 'text-blue-600 bg-blue-100'
      case 'preparing': return 'text-yellow-600 bg-yellow-100'
      case 'shipped': return 'text-purple-600 bg-purple-100'
      case 'delivered': return 'text-green-600 bg-green-100'
      case 'returned': return 'text-green-600 bg-green-100'
      case 'overdue': return 'text-red-600 bg-red-100'
      case 'charged': return 'text-purple-600 bg-purple-100'
      case 'rejected': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '승인 대기'
      case 'approved': return '승인됨'
      case 'preparing': return '배송 준비'
      case 'shipped': return '배송 중'
      case 'delivered': return '배송 완료'
      case 'returned': return '회수 완료'
      case 'overdue': return '기한 초과'
      case 'charged': return '샘플 결제'
      case 'rejected': return '거절됨'
      default: return status
    }
  }

  const getDaysRemainingColor = (days: number) => {
    if (days > 7) return 'text-green-600'
    if (days > 3) return 'text-yellow-600'
    if (days > 0) return 'text-orange-600'
    return 'text-red-600'
  }

  // product_options에서 색상과 사이즈 파싱하는 함수
  const parseProductOptions = (productOptions: string) => {
    if (!productOptions) return { color: '-', size: '-' }
    
    const colorMatch = productOptions.match(/색상\s*:\s*([^,]+)/i)
    const sizeMatch = productOptions.match(/사이즈\s*:\s*([^,]+)/i)
    
    return {
      color: colorMatch ? colorMatch[1].trim() : '-',
      size: sizeMatch ? sizeMatch[1].trim() : '-'
    }
  }

  // 초기 데이터 로드
  useEffect(() => {
    fetchSamples()
  }, [])

  // 필터 변경 시 자동 검색 (상태 변경만)
  useEffect(() => {
    if (filters.status !== 'all') {
      fetchSamples({ ...filters, page: 1 })
    } else {
      fetchSamples({ search: filters.search, page: 1 })
    }
  }, [filters.status])

  const handleSearch = () => {
    fetchSamples(filters)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSamples(samples.map(s => s.id))
    } else {
      setSelectedSamples([])
    }
  }

  const handleSelectSample = (sampleId: string, checked: boolean) => {
    if (checked) {
      setSelectedSamples([...selectedSamples, sampleId])
    } else {
      setSelectedSamples(selectedSamples.filter(id => id !== sampleId))
    }
  }

  // 샘플 명세서 생성 함수
  const handleCreateSampleStatement = async () => {
    try {
      const response = await fetch('/api/admin/samples', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_statement',
          samples: samples.map(sample => {
            const { color, size } = parseProductOptions(sample.product_options || '')
            return {
              id: sample.id,
              product_code: sample.product_code || sample.sample_number,
              product_name: sample.product_name,
              color,
              size,
              quantity: sample.quantity,
              unit_price: sample.unit_price,
              customer_name: sample.customer_name,
              customer_id: sample.customer_id
            }
          })
        })
      })

      const result = await response.json()

      if (result.success) {
        alert('샘플 명세서가 생성되었습니다. 고객 화면에서 확인할 수 있습니다.')
        await fetchSamples(filters)
      } else {
        alert(result.error || '샘플 명세서 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('샘플 명세서 생성 중 오류:', error)
      alert('샘플 명세서 생성 중 오류가 발생했습니다.')
    }
  }

  // 배송 정보 엑셀 다운로드 함수
  const handleDownloadShippingExcel = async () => {
    const approvedSamples = samples.filter(sample => 
      sample.status === 'approved' || sample.status === 'preparing' || sample.status === 'shipped'
    )
    
    if (approvedSamples.length === 0) {
      showInfo('다운로드할 샘플이 없습니다.')
      return
    }
    
    try {
      // 샘플 데이터를 주문관리와 동일한 형식으로 변환
      const sampleOrderData = await Promise.all(
        approvedSamples.map(async (sample) => {
          // 해당 회사명의 배송지 정보 조회
          let shippingInfo = {
            recipient_name: sample.customer_name,
            phone: sample.users?.phone || '',
            address: sample.delivery_address || '',
            postal_code: ''
          }

          // shipping_addresses에서 해당 사용자의 기본 배송지 조회
          if (sample.customer_id) {
            try {
              const response = await fetch(`/api/shipping-addresses?user_id=${sample.customer_id}`)
              if (response.ok) {
                const addresses = await response.json()
                const defaultAddress = addresses.find((addr: any) => addr.is_default) || addresses[0]
                if (defaultAddress) {
                  shippingInfo = {
                    recipient_name: defaultAddress.recipient_name,
                    phone: defaultAddress.phone,
                    address: defaultAddress.address,
                    postal_code: defaultAddress.postal_code
                  }
                }
              }
            } catch (error) {
              console.warn('배송지 조회 실패:', error)
            }
          }

          const { color, size } = parseProductOptions(sample.product_options || '')
          
          return {
            id: sample.id,
            order_number: sample.sample_number,
            user: {
              company_name: sample.customer_name
            },
            shipping_name: shippingInfo.recipient_name,
            shipping_phone: shippingInfo.phone,
            shipping_address: shippingInfo.address,
            shipping_postal_code: shippingInfo.postal_code,
            notes: sample.notes || '',
            order_items: [{
              product_name: sample.product_name,
              color: color,
              size: size,
              quantity: sample.quantity
            }]
          }
        })
      )
      
      // 주문관리와 동일한 downloadOrderShippingExcel 함수 사용
      downloadOrderShippingExcel(sampleOrderData as any, `샘플배송정보_${new Date().toISOString().split('T')[0]}`)
      showSuccess('배송정보 엑셀이 다운로드되었습니다.')
    } catch (error) {
      console.error('Excel download error:', error)
      showError('엑셀 다운로드에 실패했습니다.')
    }
  }

  // 운송장 번호 엑셀 업로드
  const handleUploadTrackingExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      // 엑셀 파일 파싱
      const trackingData = await parseTrackingExcel(file)
      
      if (trackingData.length === 0) {
        showError('유효한 데이터가 없습니다.')
        return
      }

      if (!confirm(`${trackingData.length}건의 운송장 번호를 업데이트하시겠습니까?`)) {
        return
      }

      // 주문관리와 동일한 API 호출
      const response = await fetch('/api/admin/orders/bulk-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ trackingData })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(`${result.data.updated}건의 운송장 번호가 업데이트되었습니다.`)
        // 샘플 목록 새로고침
        await fetchSamples(filters)
      } else {
        showError(result.error || '운송장 번호 업데이트에 실패했습니다.')
      }
    } catch (error) {
      console.error('Excel upload error:', error)
      showError('엑셀 업로드에 실패했습니다.')
    }

    // 파일 input 초기화
    event.target.value = ''
  }

  // 샘플 아이템 관리 함수들
  const addSampleItem = () => {
    const newItem: SampleItem = {
      id: Date.now().toString(),
      productId: '',
      productCode: '',
      productName: '',
      color: '',
      size: '',
      quantity: 1,
      unitPrice: 0,
      supplyAmount: 0,
      vat: 0
    }
    setSampleItems([...sampleItems, newItem])
  }

  const removeSampleItem = (index: number) => {
    const newItems = sampleItems.filter((_, i) => i !== index)
    setSampleItems(newItems)
  }

  const updateSampleQuantity = (index: number, quantity: number) => {
    const updatedItems = [...sampleItems]
    const item = updatedItems[index]
    const supplyAmount = item.unitPrice * quantity
    const vat = Math.floor(supplyAmount * 0.1)

    updatedItems[index] = {
      ...item,
      quantity,
      supplyAmount,
      vat
    }

    setSampleItems(updatedItems)
  }

  // 고객 검색
  const searchCustomers = async (keyword: string) => {
    if (!keyword.trim()) {
      setCustomerSearchResults([])
      return
    }

    try {
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(keyword)}&limit=10`)
      const result = await response.json()

      if (result.success) {
        setCustomerSearchResults(result.data || [])
      } else {
        setCustomerSearchResults([])
      }
    } catch (error) {
      console.error('고객 검색 오류:', error)
      setCustomerSearchResults([])
    }
  }

  // 상품 검색
  const searchProducts = async (keyword: string) => {
    if (!keyword.trim()) {
      setProductSearchResults([])
      return
    }

    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(keyword)}&limit=20`)
      const result = await response.json()

      if (result.success) {
        setProductSearchResults(result.data || [])
      } else {
        setProductSearchResults([])
      }
    } catch (error) {
      console.error('상품 검색 오류:', error)
      setProductSearchResults([])
    }
  }

  // 상품 선택
  const selectProduct = (product: any, color: string, size: string) => {
    if (selectedRowIndex === null) return

    // 샘플 주문은 항상 0원 고정
    const supplyAmount = 0
    const vat = 0

    const updatedItems = [...sampleItems]
    updatedItems[selectedRowIndex] = {
      ...updatedItems[selectedRowIndex],
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      color,
      size,
      unitPrice: 0, // 샘플 주문은 0원 고정
      supplyAmount,
      vat
    }

    setSampleItems(updatedItems)
    setShowProductSearch(false)
    setSelectedRowIndex(null)
  }

  // 샘플 생성
  const createSample = async () => {
    if (!selectedCustomer) {
      alert('고객을 선택해주세요.')
      return
    }

    if (sampleItems.length === 0) {
      alert('샘플 상품을 추가해주세요.')
      return
    }

    if (sampleItems.some(item => !item.productId || item.quantity <= 0)) {
      alert('모든 상품 정보를 입력해주세요.')
      return
    }

    try {
      const response = await fetch('/api/admin/samples', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'create_sample',
          customerId: selectedCustomer.id,
          customerName: selectedCustomer.company_name,
          items: sampleItems.map(item => ({
            productId: item.productId,
            productCode: item.productCode,
            productName: item.productName,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            unitPrice: 0 // 샘플 주문은 항상 0원 고정
          }))
        })
      })

      const result = await response.json()

      if (result.success) {
        alert('샘플이 생성되었습니다.')
        setShowCreateModal(false)
        setSampleItems([])
        setSelectedCustomer(null)
        await fetchSamples(filters)
      } else {
        alert(result.error || '샘플 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('샘플 생성 중 오류:', error)
      alert('샘플 생성 중 오류가 발생했습니다.')
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
          <Button onClick={handleCreateSampleStatement} className="bg-blue-600 hover:bg-blue-700">
            <FileText className="h-4 w-4 mr-2" />
            샘플 명세서 생성
          </Button>
          <Button variant="outline" onClick={handleDownloadShippingExcel}>
            <Download className="h-4 w-4 mr-2" />
            배송정보 다운로드
          </Button>
          <div className="relative">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleUploadTrackingExcel}
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
          <Button variant="outline" onClick={() => setShowTrackingModal(true)}>
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">승인 대기</p>
              <p className="text-2xl font-bold text-blue-600">
                {samples.filter(s => s.status === 'pending').length}건
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <div className="flex items-center">
            <Send className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">배송 중</p>
              <p className="text-2xl font-bold text-purple-600">
                {samples.filter(s => s.status === 'shipped').length}건
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">기한 초과</p>
              <p className="text-2xl font-bold text-red-600">
                {samples.filter(s => s.status === 'overdue').length}건
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-orange-500">
          <div className="flex items-center">
            <X className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">샘플 결제</p>
              <p className="text-2xl font-bold text-orange-600">
                {samples.filter(s => s.status === 'charged').length}건
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">회수 완료</p>
              <p className="text-2xl font-bold text-green-600">
                {samples.filter(s => s.status === 'returned').length}건
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
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-sm"
            >
              <option value="all">전체 상태</option>
              <option value="pending">승인 대기</option>
              <option value="approved">승인됨</option>
              <option value="preparing">배송 준비</option>
              <option value="shipped">배송 중</option>
              <option value="delivered">배송 완료</option>
              <option value="returned">회수 완료</option>
              <option value="overdue">기한 초과</option>
              <option value="charged">샘플 결제</option>
              <option value="rejected">거절됨</option>
            </select>

            <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
              <Search className="h-4 w-4 mr-2" />
              검색
            </Button>
          </div>
        </div>
      </div>

      {/* 일괄 처리 버튼 */}
      {selectedSamples.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-blue-800 font-medium">
              {selectedSamples.length}개 샘플 선택됨
            </span>
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkStatusUpdate('approved')}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                일괄 승인
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkStatusUpdate('preparing')}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                일괄 준비
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkStatusUpdate('delivered')}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                일괄 배송완료
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkStatusUpdate('returned')}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                일괄 회수
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 샘플 목록 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-12 px-4 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedSamples.length === samples.length && samples.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  품목코드
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
                  공급가액
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
                  상태
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {samples.map((sample) => {
                const supplyAmount = (sample.unit_price || 0) * (sample.quantity || 0)
                const vat = Math.floor(supplyAmount * 0.1)
                
                return (
                  <tr key={sample.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedSamples.includes(sample.id)}
                        onChange={(e) => handleSelectSample(sample.id, e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {sample.product_code || sample.sample_number}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {sample.product_name}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {parseProductOptions(sample.product_options || '').color}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {parseProductOptions(sample.product_options || '').size}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {sample.quantity || 0}개
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(sample.unit_price || 0)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(supplyAmount)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(vat)}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {sample.customer_name}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className={`text-sm ${getDaysRemainingColor(sample.days_remaining || 0)}`}>
                        {sample.outgoing_date ? (
                          sample.days_remaining > 0 ? `D-${sample.days_remaining}` :
                          sample.days_remaining === 0 ? 'D-Day' : `D+${Math.abs(sample.days_remaining)}`
                        ) : '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sample.status)}`}>
                        {getStatusText(sample.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {/* 상태 변경 드롭다운 */}
                      <select
                        value={sample.status}
                        onChange={(e) => {
                          const newStatus = e.target.value
                          if (newStatus === sample.status) return
                          
                          if (newStatus === 'shipped') {
                            const trackingNumber = prompt('운송장 번호를 입력하세요:')
                            if (trackingNumber) {
                              handleStatusUpdate(sample.id, newStatus, trackingNumber)
                            }
                          } else if (newStatus === 'charged') {
                            if (confirm(`샘플 결제로 변경하시겠습니까?\n고객의 마일리지에서 샘플 금액이 차감됩니다.`)) {
                              handleStatusUpdate(sample.id, newStatus)
                            }
                          } else {
                            const statusLabels: {[key: string]: string} = {
                              'pending': '승인 대기',
                              'approved': '승인됨', 
                              'preparing': '배송 준비',
                              'shipped': '배송 중',
                              'delivered': '배송 완료',
                              'returned': '회수 완료',
                              'overdue': '기한 초과',
                              'rejected': '거절됨'
                            }
                            if (confirm(`상태를 "${statusLabels[newStatus]}"로 변경하시겠습니까?`)) {
                              handleStatusUpdate(sample.id, newStatus)
                            }
                          }
                        }}
                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="pending">승인 대기</option>
                        <option value="approved">승인됨</option>
                        <option value="preparing">배송 준비</option>
                        <option value="shipped">배송 중</option>
                        <option value="delivered">배송 완료</option>
                        <option value="returned">회수 완료</option>
                        <option value="overdue">기한 초과</option>
                        <option value="charged">샘플 결제</option>
                        <option value="rejected">거절됨</option>
                      </select>
                      
                      {/* 상세보기 버튼 */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-600 hover:bg-gray-50 p-1 h-7 w-7"
                        onClick={() => handleViewDetail(sample)}
                        title="상세보기"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
                )
              })}
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
        {!loading && samples.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">등록된 샘플이 없습니다.</p>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSamples({ ...filters, page: pagination.page - 1 })}
            disabled={pagination.page <= 1}
            className="text-gray-600 border-gray-200"
          >
            이전
          </Button>
          
          <div className="flex space-x-1">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const page = i + 1
              return (
                <Button
                  key={page}
                  variant={pagination.page === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => fetchSamples({ ...filters, page })}
                  className={pagination.page === page ? "bg-blue-600 text-white" : "text-gray-600 border-gray-200"}
                >
                  {page}
                </Button>
              )
            })}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSamples({ ...filters, page: pagination.page + 1 })}
            disabled={pagination.page >= pagination.totalPages}
            className="text-gray-600 border-gray-200"
          >
            다음
          </Button>
        </div>
      )}

      {/* 운송장 일괄 등록 모달 */}
      {showTrackingModal && (
        <TrackingBulkModal
          selectedSamples={selectedSamples}
          samples={samples}
          onClose={() => setShowTrackingModal(false)}
          onSubmit={handleBulkStatusUpdate}
        />
      )}

      {/* 샘플 상세보기 모달 */}
      {showDetailModal && selectedSampleDetail && (
        <SampleDetailModal
          sample={selectedSampleDetail}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedSampleDetail(null)
          }}
          onStatusUpdate={handleStatusUpdate}
        />
      )}

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
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">공급가액</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">부가세</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sampleItems.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
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
                                  {item.productCode || '더블클릭하여 선택'}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{item.productName}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{item.color}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{item.size}</td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => updateSampleQuantity(index, parseInt(e.target.value) || 1)}
                                  className="w-20 px-2 py-1 text-center border border-gray-300 rounded"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(0)}</td>
                              <td className="px-4 py-3 text-sm text-gray-900 font-medium">{formatCurrency(0)}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(0)}</td>
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
                            <td colSpan={7} className="px-4 py-3 text-right text-sm text-gray-900">합계:</td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatCurrency(0)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatCurrency(0)}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-blue-600">
                              {formatCurrency(0)}
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
                  onClick={createSample} 
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
    </div>
  )
}

// 샘플 상세보기 모달 컴포넌트
function SampleDetailModal({ sample, onClose, onStatusUpdate }: any) {
  const [adminNotes, setAdminNotes] = useState(sample.admin_notes || '')

  const handleSaveNotes = async () => {
    try {
      const response = await fetch(`/api/admin/samples/${sample.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_notes: adminNotes
        })
      })

      if (response.ok) {
        alert('메모가 저장되었습니다.')
      } else {
        alert('메모 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('메모 저장 중 오류:', error)
      alert('메모 저장 중 오류가 발생했습니다.')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'approved': return 'bg-green-100 text-green-800'
      case 'preparing': return 'bg-blue-100 text-blue-800'
      case 'shipped': return 'bg-purple-100 text-purple-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'returned': return 'bg-gray-100 text-gray-800'
      case 'overdue': return 'bg-red-100 text-red-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '승인 대기'
      case 'approved': return '승인됨'
      case 'preparing': return '배송 준비'
      case 'shipped': return '배송 중'
      case 'delivered': return '배송 완료'
      case 'returned': return '회수 완료'
      case 'overdue': return '기한 초과'
      case 'rejected': return '거절됨'
      default: return status
    }
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ko-KR')
  }

  // product_options에서 색상과 사이즈 파싱하는 함수
  const parseProductOptions = (productOptions: string) => {
    if (!productOptions) return { color: '-', size: '-' }
    
    const colorMatch = productOptions.match(/색상\s*:\s*([^,]+)/i)
    const sizeMatch = productOptions.match(/사이즈\s*:\s*([^,]+)/i)
    
    return {
      color: colorMatch ? colorMatch[1].trim() : '-',
      size: sizeMatch ? sizeMatch[1].trim() : '-'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">샘플 상세 정보</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 기본 정보 */}
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">기본 정보</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">샘플 번호:</span>
                    <span className="font-medium">{sample.sample_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">샘플 유형:</span>
                    <span className="font-medium">
                      {sample.sample_type === 'photography' ? '촬영용 (무료)' : '판매용 (유료)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">상태:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sample.status)}`}>
                      {getStatusText(sample.status)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">생성일:</span>
                    <span className="font-medium">{formatDateTime(sample.created_at)}</span>
                  </div>
                </div>
              </div>

              {/* 고객 정보 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">고객 정보</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">회사명:</span>
                    <span className="font-medium">{sample.customer_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">고객 ID:</span>
                    <span className="font-medium text-xs">{sample.customer_id}</span>
                  </div>
                </div>
              </div>

              {/* 배송 정보 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">배송 정보</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">주문일:</span>
                    <span className="font-medium">
                      {sample.created_at ? formatDateTime(sample.created_at) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">운송장 번호:</span>
                    <span className="font-medium">{sample.tracking_number || '-'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-gray-600">배송 주소:</span>
                    <div className="font-medium text-sm bg-white p-2 rounded border">
                      {sample.delivery_address || '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 상품 정보 */}
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">상품 정보</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">상품명:</span>
                    <span className="font-medium">{sample.product_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">색상:</span>
                    <span className="font-medium">{parseProductOptions(sample.product_options || '').color}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">사이즈:</span>
                    <span className="font-medium">{parseProductOptions(sample.product_options || '').size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">수량:</span>
                    <span className="font-medium">{sample.quantity}개</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">청구 금액:</span>
                    <span className="font-medium">
                      {sample.sample_type === 'photography' ? '₩0 (무료)' : `₩${sample.charge_amount?.toLocaleString() || '0'}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* 일정 정보 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">일정 정보</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">승인일:</span>
                    <span className="font-medium">
                      {sample.approved_at ? formatDateTime(sample.approved_at) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">배송일:</span>
                    <span className="font-medium">
                      {sample.shipped_at ? formatDateTime(sample.shipped_at) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">배송완료일:</span>
                    <span className="font-medium">
                      {sample.delivered_at ? formatDateTime(sample.delivered_at) : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">반납일:</span>
                    <span className="font-medium">
                      {sample.return_date ? formatDateTime(sample.return_date) : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 메모 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">메모</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-600">고객 메모:</label>
                    <p className="text-sm bg-white p-2 rounded border mt-1">
                      {sample.notes || '없음'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">관리자 메모:</label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="w-full p-2 border rounded mt-1 text-sm"
                      rows={3}
                      placeholder="관리자 메모를 입력하세요..."
                    />
                    <Button 
                      size="sm" 
                      onClick={handleSaveNotes}
                      className="mt-2 bg-blue-600 hover:bg-blue-700"
                    >
                      메모 저장
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          {sample.status === 'pending' && (
            <>
              <Button 
                onClick={() => {
                  onStatusUpdate(sample.id, 'approved')
                  onClose()
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                승인
              </Button>
              <Button 
                onClick={() => {
                  onStatusUpdate(sample.id, 'rejected')
                  onClose()
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                거절
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// 운송장 일괄 등록 모달 컴포넌트
function TrackingBulkModal({ selectedSamples, samples, onClose, onSubmit }: any) {
  const [trackingData, setTrackingData] = useState<{[key: string]: string}>({})

  const selectedSampleData = samples.filter((s: any) => selectedSamples.includes(s.id))

  const handleSubmit = () => {
    const trackingArray = Object.entries(trackingData)
      .filter(([_, trackingNumber]) => trackingNumber.trim())
      .map(([sampleId, trackingNumber]) => ({ sampleId, trackingNumber }))

    if (trackingArray.length === 0) {
      alert('운송장 번호를 입력해주세요.')
      return
    }

    onSubmit('shipped', trackingArray)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">운송장 번호 일괄 등록</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          선택된 {selectedSampleData.length}개의 샘플에 운송장 번호를 등록하고 배송 상태로 변경합니다.
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {selectedSampleData.map((sample: any) => (
            <div key={sample.id} className="flex items-center space-x-4 p-4 border rounded-lg bg-gray-50">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{sample.sample_number}</div>
                <div className="text-sm text-gray-600">{sample.customer_name}</div>
                <div className="text-xs text-gray-500">{sample.product_name} × {sample.quantity}개</div>
              </div>
              <div className="flex-1">
                <Input
                  placeholder="운송장 번호 입력"
                  value={trackingData[sample.id] || ''}
                  onChange={(e) => setTrackingData({
                    ...trackingData,
                    [sample.id]: e.target.value
                  })}
                  className="w-full"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
            <Send className="h-4 w-4 mr-2" />
            운송장 등록 및 배송 시작
          </Button>
        </div>
      </div>
    </div>
  )
} 