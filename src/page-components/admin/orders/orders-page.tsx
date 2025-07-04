'use client'

import { useState, useRef } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { formatCurrency, formatDateTime } from '@/shared/lib/utils'
import { useOrderManagement } from '@/features/admin/order-management/model/use-order-management'
import { BulkTrackingModal } from '@/features/admin/order-management/ui/bulk-tracking-modal'
import { ShippingQuantityModal } from '@/features/admin/order-management/ui/shipping-quantity-modal'
import { 
  downloadOrdersExcel, 
  downloadOrderShippingExcel,
  downloadTrackingTemplate, 
  parseTrackingExcel,
  type AdminOrderItem,
  type TrackingUploadData
} from '@/shared/lib/excel-utils'
import { showSuccess, showError, showInfo } from '@/shared/lib/toast'
import { 
  Search, 
  Filter, 
  Eye,
  Truck,
  Package,
  Package2,
  CheckCircle,
  XCircle,
  Download,
  FileText,
  MoreHorizontal,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  Upload
} from 'lucide-react'

export function OrdersPage() {
  const {
    orders,
    stats,
    loading,
    updating,
    selectedOrders,
    pagination,
    filters,
    updateOrdersStatus,
    updateSingleOrder,
    toggleOrderSelection,
    toggleAllSelection,
    updateFilters,
    changePage,
    resetFilters
  } = useOrderManagement()

  const [bulkTrackingModalOpen, setBulkTrackingModalOpen] = useState(false)
  const [shippingQuantityModalOpen, setShippingQuantityModalOpen] = useState(false)
  const [selectedOrderForShipping, setSelectedOrderForShipping] = useState<any>(null)
  const [searchValue, setSearchValue] = useState(filters.search)
  const [statusFilter, setStatusFilter] = useState(filters.status)
  const [startDate, setStartDate] = useState(filters.startDate)
  const [endDate, setEndDate] = useState(filters.endDate)
  const [uploadingTracking, setUploadingTracking] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'confirmed': return 'text-blue-600 bg-blue-100'
      case 'shipped': return 'text-purple-600 bg-purple-100'
      case 'delivered': return 'text-green-600 bg-green-100'
      case 'cancelled': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '주문접수'
      case 'confirmed': return '주문확정'
      case 'shipped': return '배송중'
      case 'delivered': return '배송완료'
      case 'cancelled': return '주문취소'
      default: return '알 수 없음'
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ 
      search: searchValue,
      status: statusFilter,
      startDate,
      endDate
    })
  }

  const handleReset = () => {
    setSearchValue('')
    setStatusFilter('all')
    setStartDate('')
    setEndDate('')
    resetFilters()
  }

  const handleBulkConfirm = () => {
    if (selectedOrders.length === 0) return
    updateOrdersStatus(selectedOrders, 'confirmed')
  }

  const handleBulkShipping = () => {
    if (selectedOrders.length === 0) return
    setBulkTrackingModalOpen(true)
  }

  const handleBulkCancel = () => {
    if (selectedOrders.length === 0) return
    if (confirm(`선택된 ${selectedOrders.length}건의 주문을 취소하시겠습니까?`)) {
      updateOrdersStatus(selectedOrders, 'cancelled')
    }
  }

  // 주문 내역 엑셀 다운로드
  const handleDownloadExcel = () => {
    try {
      // orders 데이터를 AdminOrderItem 형식으로 변환
      const adminOrders: AdminOrderItem[] = orders.map(order => ({
        id: order.id,
        order_number: order.order_number,
        user: {
          company_name: order.users?.company_name || '',
          representative_name: order.users?.representative_name || '',
          phone: order.users?.phone || '',
          address: ''
        },
        total_amount: order.total_amount,
        shipping_fee: order.shipping_fee || 0,
        status: order.status,
        tracking_number: order.tracking_number,
        shipping_name: order.shipping_name,
        shipping_phone: order.shipping_phone,
        shipping_address: order.shipping_address,
        notes: order.notes,
        created_at: order.created_at,
        order_items: order.order_items?.map(item => ({
          product_name: item.product_name,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        })) || []
      }))

      downloadOrdersExcel(adminOrders)
      showSuccess('주문 내역이 다운로드되었습니다.')
    } catch (error) {
      console.error('Excel download error:', error)
      showError('엑셀 다운로드 중 오류가 발생했습니다.')
    }
  }

  // 배송 정보 엑셀 다운로드 (사용자 요청 형식)
  const handleDownloadShippingExcel = () => {
    try {
      // orders 데이터를 AdminOrderItem 형식으로 변환
      const adminOrders: AdminOrderItem[] = orders.map(order => ({
        id: order.id,
        order_number: order.order_number,
        user: {
          company_name: order.users?.company_name || '',
          representative_name: order.users?.representative_name || '',
          phone: order.users?.phone || '',
          address: ''
        },
        total_amount: order.total_amount,
        shipping_fee: order.shipping_fee || 0,
        status: order.status,
        tracking_number: order.tracking_number,
        shipping_name: order.shipping_name,
        shipping_phone: order.shipping_phone,
        shipping_address: order.shipping_address,
        notes: order.notes,
        created_at: order.created_at,
        order_items: order.order_items?.map(item => ({
          product_name: item.product_name,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        })) || []
      }))

      downloadOrderShippingExcel(adminOrders)
      showSuccess('배송 정보가 다운로드되었습니다.')
    } catch (error) {
      console.error('Shipping Excel download error:', error)
      showError('배송 정보 다운로드 중 오류가 발생했습니다.')
    }
  }

  // 운송장 템플릿 다운로드
  const handleDownloadTemplate = () => {
    try {
      const adminOrders: AdminOrderItem[] = orders.map(order => ({
        id: order.id,
        order_number: order.order_number,
        user: {
          company_name: order.users?.company_name || '',
          representative_name: order.users?.representative_name || '',
          phone: order.users?.phone || '',
          address: ''
        },
        total_amount: order.total_amount,
        shipping_fee: order.shipping_fee || 0,
        status: order.status,
        tracking_number: order.tracking_number,
        shipping_name: order.shipping_name,
        shipping_phone: order.shipping_phone,
        shipping_address: order.shipping_address,
        notes: order.notes,
        created_at: order.created_at,
        order_items: []
      }))

      downloadTrackingTemplate(adminOrders)
      showSuccess('운송장 등록 템플릿이 다운로드되었습니다.')
    } catch (error) {
      console.error('Template download error:', error)
      showError('템플릿 다운로드 중 오류가 발생했습니다.')
    }
  }

  // 운송장 엑셀 업로드
  const handleTrackingUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingTracking(true)

    try {
      // 엑셀 파일 파싱
      const trackingData: TrackingUploadData[] = await parseTrackingExcel(file)
      
      if (trackingData.length === 0) {
        showInfo('업로드할 운송장 데이터가 없습니다.')
        return
      }

      // API로 일괄 업데이트 요청
      const response = await fetch('/api/admin/orders/bulk-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ trackingData })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '운송장 업데이트에 실패했습니다.')
      }

      const { summary, results } = result.data

      // 결과 메시지 표시
      if (summary.failed > 0) {
        showInfo(`${result.message}\n\n실패한 주문:\n${results.failed.map((item: any) => `${item.orderNumber}: ${item.error}`).join('\n')}`)
      } else {
        showSuccess(result.message)
      }

      // 주문 목록 새로고침 (실제 구현에서는 refetch 함수 호출)
      window.location.reload()

    } catch (error) {
      console.error('Tracking upload error:', error)
      showError(error instanceof Error ? error.message : '운송장 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploadingTracking(false)
      // 파일 입력 초기화
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 송장 양식 생성
  const handleGenerateShippingLabels = async () => {
    if (selectedOrders.length === 0) return

    try {
      const response = await fetch('/api/admin/orders/shipping-label', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          orderIds: selectedOrders,
          shippingCompany: 'CJ대한통운'
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '송장 양식 생성에 실패했습니다.')
      }

      showSuccess(`${result.data.totalOrders}개 주문의 송장 양식이 생성되었습니다.`)
      
      // 파일 다운로드 (실제로는 생성된 파일 URL로 다운로드)
      const link = document.createElement('a')
      link.href = result.data.fileUrl
      link.download = result.data.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (error) {
      console.error('Shipping label generation error:', error)
      showError(error instanceof Error ? error.message : '송장 양식 생성 중 오류가 발생했습니다.')
    }
  }

  // 반품 명세서 생성
  const handleGenerateReturnStatement = async () => {
    if (selectedOrders.length === 0) return

    const orderNumber = prompt('반품 처리할 주문번호를 입력하세요:')
    if (!orderNumber) return

    const returnReason = prompt('반품 사유를 입력하세요:')
    if (!returnReason) return

    const mileageCompensation = prompt('마일리지 보상 금액을 입력하세요 (선택사항):')

    try {
      const response = await fetch('/api/admin/orders/return-statement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderNumber,
          customerId: selectedOrdersData[0]?.user_id || 1,
          items: selectedOrdersData[0]?.order_items?.map((item: any) => ({
            productId: item.product_id || 1,
            productName: item.product_name,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            color: item.color,
            size: item.size,
            reason: returnReason
          })) || [],
          returnReason,
          returnType: 'refund',
          mileageCompensation: mileageCompensation ? parseInt(mileageCompensation) : 0,
          notes: ''
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || '반품 명세서 생성에 실패했습니다.')
      }

      showSuccess(`반품 명세서가 생성되었습니다. (${result.data.returnNumber})`)
      
      // 파일 다운로드 (실제로는 생성된 파일 URL로 다운로드)
      const link = document.createElement('a')
      link.href = result.data.fileUrl
      link.download = `return-statement-${result.data.returnNumber}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

    } catch (error) {
      console.error('Return statement generation error:', error)
      showError(error instanceof Error ? error.message : '반품 명세서 생성 중 오류가 발생했습니다.')
    }
  }

  // 사업자번호 검증
  const handleValidateBusinessNumber = async (businessNumber: string) => {
    try {
      const response = await fetch('/api/auth/validate-business', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ businessNumber })
      })

      const result = await response.json()

      if (!result.success) {
        showError(result.error || '사업자번호 검증에 실패했습니다.')
        return false
      }

      if (result.data.companyInfo) {
        showSuccess(`유효한 사업자번호입니다.\n업체명: ${result.data.companyInfo.companyName || '정보 없음'}`)
      } else {
        showSuccess('유효한 사업자번호입니다.')
      }

      return true
    } catch (error) {
      console.error('Business number validation error:', error)
      showError('사업자번호 검증 중 오류가 발생했습니다.')
      return false
    }
  }

  // 출고 수량 관리 함수
  const handleShippingQuantityUpdate = async (orderId: string, items: Array<{ id: string; shipped_quantity: number }>) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/shipping-quantity`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess('출고 수량이 업데이트되었습니다.')
        // 주문 목록 새로고침
        await updateFilters({})
        return true
      } else {
        showError(result.error || '출고 수량 업데이트에 실패했습니다.')
        return false
      }
    } catch (error) {
      console.error('출고 수량 업데이트 실패:', error)
      showError('출고 수량 업데이트에 실패했습니다.')
      return false
    }
  }

  const selectedOrdersData = orders.filter(order => selectedOrders.includes(order.id))

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">주문 관리</h1>
        <p className="text-gray-600 mt-2">주문 접수, 확정, 배송 처리 및 송장 관리</p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-2">
          {selectedOrders.length > 0 && (
            <>
              <Button 
                onClick={handleBulkConfirm}
                disabled={updating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                선택 주문 확정 ({selectedOrders.length})
              </Button>
              <Button 
                onClick={handleBulkShipping}
                disabled={updating}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Truck className="h-4 w-4 mr-2" />
                배송 처리 ({selectedOrders.length})
              </Button>
              <Button 
                onClick={handleBulkCancel}
                disabled={updating}
                variant="destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                주문 취소 ({selectedOrders.length})
              </Button>
            </>
          )}
        </div>
        
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleDownloadExcel}>
            <Download className="h-4 w-4 mr-2" />
            주문 내역 다운로드
          </Button>
          <Button variant="outline" onClick={handleDownloadShippingExcel}>
            <FileText className="h-4 w-4 mr-2" />
            배송 정보 다운로드
          </Button>
          <Button variant="outline" onClick={handleDownloadTemplate}>
            <FileText className="h-4 w-4 mr-2" />
            운송장 템플릿 다운로드
          </Button>
          <Button 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingTracking}
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploadingTracking ? '업로드 중...' : '운송장 일괄 업로드'}
          </Button>
          {selectedOrders.length > 0 && (
            <>
              <Button 
                variant="outline" 
                onClick={handleGenerateShippingLabels}
                disabled={updating}
                className="bg-orange-50 hover:bg-orange-100 text-orange-700"
              >
                <Truck className="h-4 w-4 mr-2" />
                송장 양식 생성 ({selectedOrders.length})
              </Button>
              <Button 
                variant="outline" 
                onClick={handleGenerateReturnStatement}
                disabled={updating}
                className="bg-red-50 hover:bg-red-100 text-red-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                반품 명세서 생성
              </Button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleTrackingUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* 주문 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">신규 주문</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}건</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">주문 확정</p>
              <p className="text-2xl font-bold text-blue-600">{stats.confirmed}건</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <div className="flex items-center">
            <Truck className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">배송중</p>
              <p className="text-2xl font-bold text-purple-600">{stats.shipped}건</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">배송 완료</p>
              <p className="text-2xl font-bold text-green-600">{stats.delivered}건</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-gray-500">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-gray-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">전체 주문</p>
              <p className="text-2xl font-bold text-gray-600">{stats.total}건</p>
            </div>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <form onSubmit={handleSearch}>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="주문번호, 업체명 검색"
                className="pl-10"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <select 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">전체 상태</option>
                <option value="pending">주문접수</option>
                <option value="confirmed">주문확정</option>
                <option value="shipped">배송중</option>
                <option value="delivered">배송완료</option>
                <option value="cancelled">주문취소</option>
              </select>
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input 
                type="date" 
                placeholder="시작일" 
                className="pl-10"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input 
                type="date" 
                placeholder="종료일" 
                className="pl-10"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              검색
            </Button>
            <Button type="button" variant="outline" onClick={handleReset}>
              초기화
            </Button>
          </div>
        </form>
      </div>

      {/* 주문 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              주문 목록 ({pagination.totalCount}건)
            </h2>
            {orders.length > 0 && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectedOrders.length === orders.length}
                  onChange={toggleAllSelection}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-600">전체 선택</span>
              </div>
            )}
          </div>
        </div>
        
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">주문 목록을 불러오는 중...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>조건에 맞는 주문이 없습니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    선택
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주문번호
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    업체명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주문금액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상품수
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    송장번호
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주문일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{order.order_number}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.users?.company_name || '알 수 없음'}
                      </div>
                      <div className="text-sm text-gray-500">{order.shipping_name}</div>
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {order.shipping_address}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.order_items.length}개
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.tracking_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateTime(order.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <Button size="sm" variant="outline">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {order.status === 'pending' && (
                        <Button 
                          size="sm" 
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => updateSingleOrder(order.id, 'confirmed')}
                          disabled={updating}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      {order.status === 'confirmed' && (
                        <>
                          <Button 
                            size="sm" 
                            className="bg-purple-600 hover:bg-purple-700"
                            onClick={() => setBulkTrackingModalOpen(true)}
                            disabled={updating}
                            title="배송 처리"
                          >
                            <Truck className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => {
                              setSelectedOrderForShipping(order)
                              setShippingQuantityModalOpen(true)
                            }}
                            disabled={updating}
                            title="출고 수량 관리"
                          >
                            <Package2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {(order.status === 'pending' || order.status === 'confirmed') && (
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => updateSingleOrder(order.id, 'cancelled')}
                          disabled={updating}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {pagination.totalCount}건 중 {((pagination.currentPage - 1) * 20) + 1}-{Math.min(pagination.currentPage * 20, pagination.totalCount)}건 표시
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => changePage(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage || loading}
                >
                  이전
                </Button>
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, pagination.currentPage - 2) + i
                  if (pageNum <= pagination.totalPages) {
                    return (
                      <Button
                        key={pageNum}
                        variant={pageNum === pagination.currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => changePage(pageNum)}
                        disabled={loading}
                      >
                        {pageNum}
                      </Button>
                    )
                  }
                  return null
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => changePage(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage || loading}
                >
                  다음
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 운송장 일괄 등록 모달 */}
      <BulkTrackingModal
        isOpen={bulkTrackingModalOpen}
        onClose={() => setBulkTrackingModalOpen(false)}
        selectedOrders={selectedOrdersData}
        onUpdate={updateOrdersStatus}
      />

      {/* 출고 수량 관리 모달 */}
      <ShippingQuantityModal
        isOpen={shippingQuantityModalOpen}
        onClose={() => {
          setShippingQuantityModalOpen(false)
          setSelectedOrderForShipping(null)
        }}
        order={selectedOrderForShipping}
        onUpdate={handleShippingQuantityUpdate}
      />
    </div>
  )
} 