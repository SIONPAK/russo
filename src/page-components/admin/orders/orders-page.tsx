'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { formatCurrency, formatDateTime } from '@/shared/lib/utils'
import { useOrderManagement } from '@/features/admin/order-management/model/use-order-management'
import { 
  downloadOrdersExcel, 
  downloadOrderShippingExcel,
  parseTrackingExcel,
  type AdminOrderItem
} from '@/shared/lib/excel-utils'
import { showSuccess, showError, showInfo } from '@/shared/lib/toast'
import { 
  Download,
  FileText,
  Package,
  Calendar,
  Users,
  TrendingUp,
  Upload,
  ChevronDown
} from 'lucide-react'

export function OrdersPage() {
  const {
    orders,
    stats,
    loading,
    updating,
    selectedOrders,
    filters,
    fetchOrders,
    fetchTodayOrders,
    allocateInventory,
    toggleOrderSelection,
    toggleAllSelection,
    updateFilters
  } = useOrderManagement()

  const [selectedDate, setSelectedDate] = useState(() => {
    // 한국 시간 기준으로 오늘 날짜
    const now = new Date()
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
    return koreaTime.toISOString().split('T')[0]
  })

  const [sortBy, setSortBy] = useState<'company_name' | 'created_at' | 'total_amount'>('company_name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [isStatementDropdownOpen, setIsStatementDropdownOpen] = useState(false) // 명세서 드롭다운 상태
  const [editingItem, setEditingItem] = useState<{orderId: string, itemId: string, field: 'quantity' | 'shipped_quantity'} | null>(null)

  // 정렬된 주문 목록
  const sortedOrders = [...orders].sort((a, b) => {
    let aValue: any, bValue: any
    
    switch (sortBy) {
      case 'company_name':
        aValue = a.users?.company_name || ''
        bValue = b.users?.company_name || ''
        break
      case 'created_at':
        aValue = new Date(a.created_at).getTime()
        bValue = new Date(b.created_at).getTime()
        break
      case 'total_amount':
        aValue = a.total_amount
        bValue = b.total_amount
        break
      default:
        return 0
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1
    } else {
      return aValue < bValue ? 1 : -1
    }
  })

  // 정렬 변경 핸들러
  const handleSort = (field: 'company_name' | 'created_at' | 'total_amount') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  // 선택된 주문들의 상세 데이터
  const selectedOrdersData = orders.filter(order => selectedOrders.includes(order.id))

  // 실제 출고 수량 확인
  const getShippingStatus = (order: any) => {
    const totalOrdered = order.order_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0
    const totalShipped = order.order_items?.reduce((sum: number, item: any) => sum + (item.shipped_quantity || 0), 0) || 0
    
    if (totalShipped === 0) {
      return { 
        status: 'not_shipped', 
        text: '미출고', 
        color: 'text-gray-500',
        detail: `0/${totalOrdered}개`
      }
    } else if (totalShipped < totalOrdered) {
      return { 
        status: 'partial_shipped', 
        text: '부분출고', 
        color: 'text-orange-600',
        detail: `${totalShipped}/${totalOrdered}개`
      }
    } else {
      return { 
        status: 'fully_shipped', 
        text: '전량출고', 
        color: 'text-green-600',
        detail: `${totalShipped}/${totalOrdered}개`
      }
    }
  }

  // 주문 내역 엑셀 다운로드 (CJ대한통운 송장 출력용)
  const handleDownloadExcel = async () => {
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
        shipping_postal_code: order.shipping_postal_code,
        notes: order.notes,
        created_at: order.created_at,
        order_items: order.order_items?.map(item => ({
          id: item.id,
          product_name: item.product_name,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          shipped_quantity: item.shipped_quantity || 0,
          unit_price: item.unit_price,
          total_price: item.total_price,
          product_code: item.products?.code || ''
        })) || []
      }))

      await downloadOrderShippingExcel(adminOrders, `주문배송정보_${selectedDate}`)
      showSuccess('엑셀 파일이 다운로드되었습니다.')
    } catch (error) {
      console.error('Excel download error:', error)
      showError('엑셀 다운로드에 실패했습니다.')
    }
  }

  // 엑셀 업로드로 운송장 번호 업데이트
  const handleUploadExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

      // API 호출하여 운송장 번호 업데이트
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
        // 주문 목록 새로고침
        fetchTodayOrders()
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

  // 최종 명세서 출력 (배송 시 동봉용)
  const handleDownloadShippingStatement = async () => {
    if (selectedOrders.length === 0) {
      showInfo('명세서를 출력할 주문을 선택해주세요.')
      return
    }

    try {
      // 각 주문에 대해 개별 거래명세서 생성
      for (const orderId of selectedOrders) {
        const response = await fetch(`/api/admin/orders/${orderId}/statement`)

        if (response.ok) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `거래명세서_${orderId}_${selectedDate}.xlsx`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      }
      
      showSuccess(`${selectedOrders.length}건의 거래명세서가 다운로드되었습니다.`)
    } catch (error) {
      console.error('Shipping statement error:', error)
      showError('명세서 생성에 실패했습니다.')
    }
  }

  // 🎯 최종 명세서 PDF 일괄 다운로드
  const handleDownloadShippingStatementPDF = async () => {
    if (selectedOrders.length === 0) {
      showInfo('PDF 명세서를 출력할 주문을 선택해주세요.')
      return
    }

    try {
      showInfo('PDF 생성 중입니다. 잠시만 기다려주세요...')
      
      const response = await fetch('/api/admin/orders/shipping-statement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderIds: selectedOrders,
          format: 'pdf'
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `최종명세서_${selectedDate}_${selectedOrders.length}건.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        showSuccess(`${selectedOrders.length}건의 거래명세서 PDF가 다운로드되었습니다.`)
      } else {
        const errorData = await response.json()
        console.error('PDF 생성 실패:', errorData)
        
        // PDF 생성 실패 시 Excel 다운로드를 제안
        const userConfirm = confirm(`PDF 생성에 실패했습니다.\n\n오류: ${errorData.error || 'PDF 생성 서버 오류'}\n\n대신 Excel 파일로 다운로드 하시겠습니까?`)
        
        if (userConfirm) {
          // Excel 다운로드 실행
          handleDownloadShippingStatementExcel()
        }
      }
    } catch (error) {
      console.error('PDF download error:', error)
      
      // 네트워크 오류 또는 기타 오류 시 Excel 다운로드 제안
      const userConfirm = confirm(`PDF 다운로드 중 오류가 발생했습니다.\n\n오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}\n\n대신 Excel 파일로 다운로드 하시겠습니까?`)
      
      if (userConfirm) {
        handleDownloadShippingStatementExcel()
      }
    }
  }

  // 🎯 최종 명세서 엑셀 일괄 다운로드 (ZIP 파일)
  const handleDownloadShippingStatementExcel = async () => {
    if (selectedOrders.length === 0) {
      showInfo('엑셀 명세서를 출력할 주문을 선택해주세요.')
      return
    }

    try {
      const response = await fetch('/api/admin/orders/shipping-statement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderIds: selectedOrders,
          format: 'excel'
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `receipts_bulk_download_${selectedDate}_${selectedOrders.length}건.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        showSuccess(`${selectedOrders.length}건의 영수증 ZIP 파일이 다운로드되었습니다.`)
      } else {
        const errorData = await response.json()
        showError(errorData.error || 'ZIP 파일 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('ZIP download error:', error)
      showError('ZIP 파일 다운로드에 실패했습니다.')
    }
  }

  // 재고 할당 처리
  const handleAllocateInventory = async () => {
    if (selectedOrders.length === 0) {
      showInfo('재고를 할당할 주문을 선택해주세요.')
      return
    }

    if (!confirm(`선택된 ${selectedOrders.length}건의 주문에 재고를 할당하시겠습니까?\n\n시간순차적으로 할당되며, 재고 부족 시 가능한 수량만 할당됩니다.`)) {
      return
    }

    await allocateInventory(selectedOrders)
  }

  // 일괄 출고 처리 (출고내역조회로 이동)
  const handleBulkShipping = async () => {
    if (selectedOrders.length === 0) {
      showInfo('출고 처리할 주문을 선택해주세요.')
      return
    }

    const selectedOrdersData = orders.filter(order => selectedOrders.includes(order.id))

    if (!confirm(`선택된 ${selectedOrders.length}건의 주문을 출고 처리하시겠습니까?\n\n⚠️ 출고 처리 시:\n• 주문이 출고내역조회로 이동됩니다\n• 주문 상태가 '출고완료'로 변경됩니다\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      const response = await fetch('/api/admin/orders/move-to-shipped', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderIds: selectedOrders
        }),
      })

      const data = await response.json()

      if (data.success) {
        showSuccess(`${selectedOrders.length}건의 주문이 출고 처리되어 출고내역조회로 이동되었습니다.`)
        
        // 주문 목록 새로고침
        fetchTodayOrders()
      } else {
        showError(data.error || '일괄 출고 처리에 실패했습니다.')
      }
    } catch (error) {
      console.error('일괄 출고 처리 오류:', error)
      showError('일괄 출고 처리 중 오류가 발생했습니다.')
    }
  }

  // 최종 명세서 확정 처리
  const handleFinalizeStatements = async () => {
    if (selectedOrders.length === 0) {
      showInfo('최종 명세서를 확정할 주문을 선택해주세요.')
      return
    }

    if (!confirm(`선택된 ${selectedOrders.length}건의 주문에 대해 최종 명세서를 확정하시겠습니까?\n\n⚠️ 확정 시 다음 작업이 수행됩니다:\n• 거래명세서 자동 생성\n• 마일리지 차감 처리\n• 주문 상태 변경\n\n이 작업은 되돌릴 수 없습니다.`)) {
      return
    }

    try {
      const response = await fetch('/api/admin/orders/finalize-statements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderIds: selectedOrders
        }),
      })

      const data = await response.json()

      if (data.success) {
        showSuccess(data.message)
        
        // 결과 상세 정보 표시
        if (data.data.failed > 0) {
          const failedOrders = data.data.results.filter((r: any) => !r.success)
          const failedInfo = failedOrders.map((r: any) => `${r.orderNumber}: ${r.error}`).join('\n')
          showError(`일부 주문 처리 실패:\n${failedInfo}`)
        }
        
        // 주문 목록 새로고침
        fetchTodayOrders()
      } else {
        showError(data.error || '최종 명세서 확정에 실패했습니다.')
      }
    } catch (error) {
      console.error('최종 명세서 확정 오류:', error)
      showError('최종 명세서 확정 중 오류가 발생했습니다.')
    }
  }

  // 날짜 변경 시 오후 3시 기준 조회
  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    updateFilters({ 
      startDate: date,
      is_3pm_based: true,
      page: 1
    })
  }

  // 주문 아이템 수정 함수
  const handleUpdateOrderItem = async (orderId: string, itemId: string, field: 'quantity' | 'shipped_quantity', value: number) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/items`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderItemId: itemId,
          [field]: value
        }),
      })

      const result = await response.json()

      if (result.success) {
        showSuccess('주문 아이템이 수정되었습니다.')
        // 주문 목록 새로고침
        await fetchOrders()
      } else {
        showError(result.error || '주문 아이템 수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('주문 아이템 수정 오류:', error)
      showError('주문 아이템 수정 중 오류가 발생했습니다.')
    } finally {
      setEditingItem(null)
    }
  }

  // 초기 로딩 시 오늘 날짜로 조회
  useEffect(() => {
    fetchTodayOrders()
  }, [])

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isStatementDropdownOpen) {
        const dropdown = document.getElementById('statement-dropdown')
        if (dropdown && !dropdown.contains(event.target as Node)) {
          setIsStatementDropdownOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isStatementDropdownOpen])

  const getStockStatusColor = (item: any) => {
    const available = item.available_stock || 0
    const required = item.quantity

    if (available >= required) {
      return 'text-green-600'
    } else if (available > 0) {
      return 'text-orange-600'
    } else {
      return 'text-red-600'
    }
  }

  const getStockStatusText = (item: any) => {
    const available = item.available_stock || 0
    const required = item.quantity

    if (available >= required) {
      return '재고충분'
    } else if (available > 0) {
      return '재고부족'
    } else {
      return '재고없음'
    }
  }

  const getAllocationStatusColor = (status: string) => {
    switch (status) {
      case 'allocated': return 'text-green-600 bg-green-100'
      case 'partial': return 'text-orange-600 bg-orange-100'
      case 'partial_shipped': return 'text-blue-600 bg-blue-100'
      case 'shipped': return 'text-green-800 bg-green-200'
      case 'insufficient': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getAllocationStatusText = (status: string) => {
    switch (status) {
      case 'allocated': return '할당완료'
      case 'partial': return '부분할당'
      case 'partial_shipped': return '부분출고'
      case 'shipped': return '출고완료'
      case 'insufficient': return '재고부족'
      default: return '대기중'
    }
  }

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'confirmed': return 'text-blue-600 bg-blue-100'
      case 'processing': return 'text-orange-600 bg-orange-100'
      case 'shipped': return 'text-green-600 bg-green-100'
      case 'delivered': return 'text-green-800 bg-green-200'
      case 'cancelled': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getOrderStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기중'
      case 'confirmed': return '주문확인'
      case 'processing': return '처리중'
      case 'shipped': return '배송중'
      case 'delivered': return '배송완료'
      case 'cancelled': return '취소'
      default: return '알 수 없음'
    }
  }

  return (
    <div className="p-6 max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">주문관리</h1>
        <p className="text-sm text-gray-600">
          동대문 도매 특성에 맞춘 발주 관리 시스템 (오후 3시 기준 조회)
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">전체 주문</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">재고 할당 완료</p>
              <p className="text-2xl font-bold text-green-600">{stats.allocated}</p>
            </div>
            <Package className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">재고 부족</p>
              <p className="text-2xl font-bold text-red-600">{stats.insufficient_stock}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">선택된 주문</p>
              <p className="text-2xl font-bold text-purple-600">{selectedOrders.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* 조회 날짜 및 액션 버튼 */}
      <div className="bg-white p-4 rounded-lg shadow border mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              <label className="text-sm font-medium text-gray-700">조회 날짜:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="text-xs text-gray-500">
              * 오후 3시 기준 조회 (전날 15:00 ~ 당일 14:59)
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleFinalizeStatements}
              disabled={selectedOrders.length === 0 || updating}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <FileText className="w-4 h-4 mr-2" />
              최종 명세서 확정 ({selectedOrders.length})
            </Button>
            <Button
              onClick={handleBulkShipping}
              disabled={selectedOrders.length === 0 || updating}
              className="bg-green-600 hover:bg-green-700"
            >
              <Package className="w-4 h-4 mr-2" />
              일괄 출고 처리 ({selectedOrders.length})
            </Button>
            
            {/* 구분선 */}
            <div className="w-px bg-gray-300 mx-2"></div>
            
            <Button
              onClick={handleDownloadExcel}
              disabled={orders.length === 0}
              variant="outline"
            >
              <Download className="w-4 h-4 mr-2" />
              배송정보 엑셀
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUploadExcel}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button
                variant="outline"
                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
              >
                <Upload className="w-4 h-4 mr-2" />
                운송장번호 업로드
              </Button>
            </div>
            
            {/* 구분선 */}
            <div className="w-px bg-gray-300 mx-2"></div>
            
            {/* 명세서 다운로드 드롭다운 */}
            <div className="relative" id="statement-dropdown">
              <Button
                onClick={() => setIsStatementDropdownOpen(!isStatementDropdownOpen)}
                disabled={selectedOrders.length === 0}
                variant="outline"
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
              >
                <FileText className="w-4 h-4 mr-2" />
                명세서 다운로드 ({selectedOrders.length})
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
              
              {isStatementDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleDownloadShippingStatement()
                        setIsStatementDropdownOpen(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <FileText className="w-4 h-4 mr-2 text-orange-600" />
                      확정 전 명세서 출력 (개별)
                    </button>
                    <button
                      onClick={() => {
                        handleDownloadShippingStatementPDF()
                        setIsStatementDropdownOpen(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <FileText className="w-4 h-4 mr-2 text-red-600" />
                      📄 PDF 일괄 다운로드
                    </button>
                    <button
                      onClick={() => {
                        handleDownloadShippingStatementExcel()
                        setIsStatementDropdownOpen(false)
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                    >
                      <FileText className="w-4 h-4 mr-2 text-blue-600" />
                      📦 ZIP 파일 (여러 영수증)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 주문 목록 테이블 */}
      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selectedOrders.length === orders.length}
                    onChange={toggleAllSelection}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('company_name')}
                >
                  <div className="flex items-center gap-1">
                    업체명
                    {sortBy === 'company_name' && (
                      <span className="text-blue-600">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  발주번호
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center gap-1">
                    주문시간
                    {sortBy === 'created_at' && (
                      <span className="text-blue-600">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상품 정보
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  주문 상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  할당 상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  출고 상태
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('total_amount')}
                >
                  <div className="flex items-center gap-1">
                    총 금액
                    {sortBy === 'total_amount' && (
                      <span className="text-blue-600">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-gray-500">로딩 중...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    선택한 날짜에 주문이 없습니다.
                  </td>
                </tr>
              ) : (
                sortedOrders.map((order) => {
                  const shippingStatus = getShippingStatus(order)
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => toggleOrderSelection(order.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {order.users?.company_name || '업체명 없음'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {order.users?.representative_name || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{order.order_number}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDateTime(order.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          {order.order_items?.map((item, index) => (
                            <div key={index} className="text-sm border-b border-gray-100 pb-2 last:border-b-0">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">
                                    {item.products?.code || 'N/A'} | {item.product_name}
                                  </div>
                                  <div className="text-gray-600">
                                    {item.color} / {item.size}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-700">수량:</span>
                                      {editingItem?.orderId === order.id && editingItem?.itemId === item.id && editingItem?.field === 'quantity' ? (
                                        <input
                                          type="number"
                                          min="0"
                                          defaultValue={item.quantity}
                                          className="w-16 px-1 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          autoFocus
                                          onBlur={(e) => {
                                            const value = parseInt(e.target.value) || 0
                                            if (value !== item.quantity) {
                                              handleUpdateOrderItem(order.id, item.id, 'quantity', value)
                                            } else {
                                              setEditingItem(null)
                                            }
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.currentTarget.blur()
                                            } else if (e.key === 'Escape') {
                                              setEditingItem(null)
                                            }
                                          }}
                                        />
                                      ) : (
                                        <span 
                                          className="text-gray-700 cursor-pointer hover:text-blue-600 hover:underline"
                                          onClick={() => setEditingItem({orderId: order.id, itemId: item.id, field: 'quantity'})}
                                        >
                                          {item.quantity}개
                                        </span>
                                      )}
                                    </div>
                                    {(item.shipped_quantity || 0) > 0 && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                                          출고: 
                                          {editingItem?.orderId === order.id && editingItem?.itemId === item.id && editingItem?.field === 'shipped_quantity' ? (
                                            <input
                                              type="number"
                                              min="0"
                                              max={item.quantity}
                                              defaultValue={item.shipped_quantity}
                                              className="w-12 ml-1 px-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                              autoFocus
                                              onBlur={(e) => {
                                                const value = parseInt(e.target.value) || 0
                                                if (value !== item.shipped_quantity) {
                                                  handleUpdateOrderItem(order.id, item.id, 'shipped_quantity', value)
                                                } else {
                                                  setEditingItem(null)
                                                }
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.currentTarget.blur()
                                                } else if (e.key === 'Escape') {
                                                  setEditingItem(null)
                                                }
                                              }}
                                            />
                                          ) : (
                                            <span 
                                              className="cursor-pointer hover:underline ml-1"
                                              onClick={() => setEditingItem({orderId: order.id, itemId: item.id, field: 'shipped_quantity'})}
                                            >
                                              {item.shipped_quantity}개
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    )}
                                    {(item.shipped_quantity || 0) < item.quantity && (
                                      <span className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700">
                                        미출고: {item.quantity - (item.shipped_quantity || 0)}개
                                      </span>
                                    )}
                                    <span className={`text-xs px-2 py-1 rounded ${getStockStatusColor(item)}`}>
                                      현재고: {item.available_stock || 0}개
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getOrderStatusColor(order.status)}`}>
                          {getOrderStatusText(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAllocationStatusColor(order.allocation_status || 'pending')}`}>
                          {getAllocationStatusText(order.allocation_status || 'pending')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${shippingStatus.color}`}>
                          {shippingStatus.text}
                        </div>
                        <div className="text-xs text-gray-500">
                          {shippingStatus.detail}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(order.total_amount)}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 선택된 주문 정보 */}
      {selectedOrders.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            선택된 주문 정보 ({selectedOrders.length}건)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-blue-700">총 주문 금액:</span>
              <span className="font-medium text-blue-900 ml-2">
                {formatCurrency(
                  selectedOrdersData.reduce((sum, order) => sum + order.total_amount, 0)
                )}
              </span>
            </div>
            <div>
              <span className="text-blue-700">총 상품 수량:</span>
              <span className="font-medium text-blue-900 ml-2">
                {selectedOrdersData.reduce((sum, order) => 
                  sum + (order.order_items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0
                )}개
              </span>
            </div>
            <div>
              <span className="text-blue-700">업체 수:</span>
              <span className="font-medium text-blue-900 ml-2">
                {new Set(selectedOrdersData.map(order => order.users?.company_name)).size}개
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 