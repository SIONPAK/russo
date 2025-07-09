'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { formatCurrency, formatDateTime } from '@/shared/lib/utils'
import { useOrderManagement } from '@/features/admin/order-management/model/use-order-management'
import { 
  downloadOrdersExcel, 
  downloadOrderShippingExcel,
  downloadTrackingNumberTemplate,
  parseTrackingExcel,
  type AdminOrderItem
} from '@/shared/lib/excel-utils'
import { showSuccess, showError, showInfo } from '@/shared/lib/toast'
import { 
  Download,
  FileText,
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
  const [editingItem, setEditingItem] = useState<{orderId: string, itemId: string} | null>(null)
  
  // 다운로드 진행 상태 관리
  const [downloadingPDF, setDownloadingPDF] = useState(false)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState('')

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

  // 운송장 상태 확인
  const getTrackingStatus = (order: any) => {
    if (!order.tracking_number || order.tracking_number.trim() === '') {
      return {
        status: 'not_entered',
        text: '미입력',
        color: 'text-red-600 bg-red-100',
        textColor: 'text-red-600'
      }
    } else {
      return {
        status: 'entered',
        text: '입력완료',
        color: 'text-green-600 bg-green-100',
        textColor: 'text-green-600'
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

  // 운송장 템플릿 다운로드
  const handleDownloadTrackingTemplate = async () => {
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

      downloadTrackingNumberTemplate(adminOrders, `운송장템플릿_${selectedDate}`)
      showSuccess('운송장 템플릿이 다운로드되었습니다.')
    } catch (error) {
      console.error('Template download error:', error)
      showError('운송장 템플릿 다운로드에 실패했습니다.')
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
      const response = await fetch('/api/admin/orders/excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ trackingData })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(`${result.data.success}건의 운송장 번호가 업데이트되었습니다.`)
        if (result.data.errors.length > 0) {
          console.error('운송장 업데이트 오류:', result.data.errors)
        }
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
      
      // 다운로드 후 데이터 새로고침
      await fetchOrders()
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

    // 다운로드 중이면 중단
    if (downloadingPDF) {
      showInfo('PDF 다운로드가 진행 중입니다. 잠시만 기다려주세요.')
      return
    }

    try {
      setDownloadingPDF(true)
      setDownloadProgress('PDF 생성 중입니다... 페이지를 새로고침하지 마세요')
      
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
        setDownloadProgress('PDF 파일 처리 중...')
        
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        // PDF 폴백 확인
        const isPDFFallback = response.headers.get('X-PDF-Fallback') === 'true'
        const fallbackReason = response.headers.get('X-Fallback-Reason')
        
        if (isPDFFallback) {
          // PDF 생성 실패로 Excel로 폴백된 경우
          a.download = `최종명세서_${selectedDate}_${selectedOrders.length}건.zip`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
          
          showSuccess(`PDF 생성에 실패하여 Excel 파일로 다운로드되었습니다. (${selectedOrders.length}건)`)
        } else {
          // 정상적인 PDF 다운로드
          a.download = `최종명세서_${selectedDate}_${selectedOrders.length}건.pdf`
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
          
          showSuccess(`${selectedOrders.length}건의 거래명세서 PDF가 다운로드되었습니다.`)
        }
        
        // 다운로드 후 데이터 새로고침
        await fetchOrders()
      } else {
        const errorData = await response.json()
        console.error('PDF 생성 실패:', errorData)
        showError(`PDF 다운로드 실패: ${errorData.error || '서버 오류가 발생했습니다.'}`)
      }
    } catch (error) {
      console.error('PDF download error:', error)
      showError(`PDF 다운로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      setDownloadingPDF(false)
      setDownloadProgress('')
    }
  }

  // 🎯 최종 명세서 엑셀 일괄 다운로드 (ZIP 파일)
  const handleDownloadShippingStatementExcel = async () => {
    if (selectedOrders.length === 0) {
      showInfo('엑셀 명세서를 출력할 주문을 선택해주세요.')
      return
    }

    // 다운로드 중이면 중단
    if (downloadingExcel) {
      showInfo('Excel 다운로드가 진행 중입니다. 잠시만 기다려주세요.')
      return
    }

    try {
      setDownloadingExcel(true)
      setDownloadProgress('Excel 파일 생성 중입니다... 페이지를 새로고침하지 마세요')
      
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
        setDownloadProgress('ZIP 파일 처리 중...')
        
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
        
        // 다운로드 후 데이터 새로고침
        await fetchOrders()
      } else {
        const errorData = await response.json()
        showError(errorData.error || 'ZIP 파일 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('ZIP download error:', error)
      showError('ZIP 파일 다운로드에 실패했습니다.')
    } finally {
      setDownloadingExcel(false)
      setDownloadProgress('')
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



  // 4. 확정 명세서 생성 및 이메일 발송
  const handleConfirmStatement = async () => {
    if (selectedOrders.length === 0) {
      showInfo('확정 명세서를 생성할 주문을 선택해주세요.')
      return
    }

    if (!confirm(`선택된 ${selectedOrders.length}건의 주문에 대해 확정 명세서를 생성하고 이메일을 발송하시겠습니까?\n\n⚠️ 처리 시 다음 작업이 수행됩니다:\n• 거래명세서 자동 생성\n• 마일리지 차감 처리\n• 고객에게 이메일 발송\n• 주문 상태 '명세서 확정'으로 변경\n\n이미 확정된 주문도 재처리됩니다.`)) {
      return
    }

    try {
      const response = await fetch('/api/admin/orders/confirm-statement', {
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
        if (data.data && data.data.failed > 0) {
          const failedOrders = data.data.results.filter((r: any) => !r.success)
          const failedInfo = failedOrders.map((r: any) => `${r.orderNumber}: ${r.error}`).join('\n')
          showError(`일부 주문 처리 실패:\n${failedInfo}`)
        }
        
        // 주문 목록 새로고침
        fetchTodayOrders()
      } else {
        showError(data.error || '확정 명세서 생성에 실패했습니다.')
      }
    } catch (error) {
      console.error('확정 명세서 생성 오류:', error)
      showError('확정 명세서 생성 중 오류가 발생했습니다.')
    }
  }

  // 5. 운송장 번호 등록 및 출고처리
  const handleShipOrders = async () => {
    if (selectedOrders.length === 0) {
      showInfo('출고처리할 주문을 선택해주세요.')
      return
    }

    const selectedOrdersData = orders.filter(order => selectedOrders.includes(order.id))

    // 운송장 번호 유효성 검사
    const ordersWithoutTracking = selectedOrdersData.filter(order => 
      !order.tracking_number || order.tracking_number.trim() === ''
    )

    if (ordersWithoutTracking.length > 0) {
      const orderNumbers = ordersWithoutTracking.map(order => order.order_number).join(', ')
      showError(`출고처리를 위해서는 모든 주문에 운송장 번호가 필요합니다.\n\n운송장 미입력 주문 (${ordersWithoutTracking.length}건):\n${orderNumbers}\n\n먼저 운송장 번호를 입력해주세요.`)
      return
    }

    // 명세서 확정 상태 확인 (미출고건 제외)
    const unconfirmedOrders = selectedOrdersData.filter(order => {
      // 출고수량이 0인 주문(미출고)은 확정명세서 없이 출고처리 가능
      const totalShipped = order.order_items?.reduce((sum: number, item: any) => sum + (item.shipped_quantity || 0), 0) || 0
      const isUnshipped = totalShipped === 0
      
      return order.status !== 'confirmed' && !isUnshipped
    })
    
    if (unconfirmedOrders.length > 0) {
      const orderNumbers = unconfirmedOrders.map(order => order.order_number).join(', ')
      showError(`출고처리를 위해서는 모든 주문의 명세서가 확정되어야 합니다.\n\n명세서 미확정 주문 (${unconfirmedOrders.length}건):\n${orderNumbers}\n\n먼저 확정 명세서를 생성해주세요.\n\n※ 미출고건(출고수량 0)은 확정명세서 없이 출고처리 가능합니다.`)
      return
    }

    // 미출고건 개수 확인
    const unshippedOrders = selectedOrdersData.filter(order => {
      const totalShipped = order.order_items?.reduce((sum: number, item: any) => sum + (item.shipped_quantity || 0), 0) || 0
      return totalShipped === 0
    })
    const normalOrders = selectedOrdersData.filter(order => {
      const totalShipped = order.order_items?.reduce((sum: number, item: any) => sum + (item.shipped_quantity || 0), 0) || 0
      return totalShipped > 0
    })
    
    let confirmMessage = `선택된 ${selectedOrders.length}건의 주문을 출고처리하시겠습니까?\n\n⚠️ 처리 시 다음 작업이 수행됩니다:\n• 주문 상태 '출고완료'로 변경\n• 출고내역으로 이동`
    
    if (unshippedOrders.length > 0) {
      confirmMessage += `\n\n📦 미출고건 ${unshippedOrders.length}건 포함 (확정명세서 없이 처리)`
    }
    if (normalOrders.length > 0) {
      confirmMessage += `\n📋 일반 출고건 ${normalOrders.length}건 포함 (확정명세서 완료)`
    }
    
    confirmMessage += `\n\n이 작업은 되돌릴 수 없습니다.`
    
    if (!confirm(confirmMessage)) {
      return
    }

    try {
      const response = await fetch('/api/admin/orders/ship-orders', {
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
        if (data.data && data.data.failed > 0) {
          const failedOrders = data.data.results.filter((r: any) => !r.success)
          const failedInfo = failedOrders.map((r: any) => `${r.orderNumber}: ${r.error}`).join('\n')
          showError(`일부 주문 처리 실패:\n${failedInfo}`)
        }
        
        // 주문 목록 새로고침
        fetchTodayOrders()
      } else {
        showError(data.error || '출고처리에 실패했습니다.')
      }
    } catch (error) {
      console.error('출고처리 오류:', error)
      showError('출고처리 중 오류가 발생했습니다.')
    }
  }

  // 날짜 변경 시 오후 3시 기준 조회
  const handleDateChange = (date: string) => {
    setSelectedDate(date)
    updateFilters({ 
      startDate: date,
      is_3pm_based: true,
      status: 'all'  // 모든 상태 조회 (일반 모드에서는 모든 주문 표시)
    })
  }



  // 주문 아이템 수정 함수 (수량만 변경 가능)
  const handleUpdateOrderItem = async (orderId: string, itemId: string, value: number) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/items`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderItemId: itemId,
          quantity: value
        }),
      })

      const result = await response.json()

      if (result.success) {
        showSuccess('주문 수량이 수정되었습니다.')
        // 현재 날짜로 주문 목록 새로고침 (전체 목록 변경 방지)
        await fetchTodayOrders()
      } else {
        showError(result.error || '주문 수량 수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('주문 수량 수정 오류:', error)
      showError('주문 수량 수정 중 오류가 발생했습니다.')
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
      case 'insufficient': return 'text-red-600 bg-red-100'
      default: return 'text-red-600 bg-red-100'
    }
  }

  const getAllocationStatusText = (status: string) => {
    switch (status) {
      case 'allocated': return '완전출고'
      case 'partial': return '부분출고'
      case 'insufficient': return '출고불가'
      default: return '출고불가'
    }
  }

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'processing': return 'text-blue-600 bg-blue-100'
      case 'confirmed': return 'text-green-600 bg-green-100'
      case 'shipped': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getOrderStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '대기중'
      case 'processing': return '작업중'
      case 'confirmed': return '작업중'
      case 'shipped': return '출고완료'
      default: return '대기중'
    }
  }

  // 페이지 초기화 시 오늘 주문 자동 조회
  useEffect(() => {
    fetchTodayOrders()
  }, [])

  return (
    <div className="p-6 max-w-full">
      {/* 다운로드 진행 상태 표시 */}
      {(downloadingPDF || downloadingExcel) && downloadProgress && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3 shadow-lg">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-3"></div>
            <span className="font-medium text-sm">{downloadProgress}</span>
            <span className="ml-3 text-xs opacity-90">⚠️ 창을 닫거나 새로고침하지 마세요</span>
          </div>
        </div>
      )}
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">주문관리</h1>
        <p className="text-sm text-gray-600">
          동대문 도매 특성에 맞춘 발주 관리 시스템 (오후 3시 기준 조회)
        </p>
        <p className="text-sm text-gray-600 font-bold">
          3시 이후 주문은 다음날로 조회가 가능합니다.
        </p>
        
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">📋 새로운 주문 관리 플로우</h2>
          <div className="text-sm text-blue-800 space-y-1">
            <p><strong>1. 확정전 명세서 다운로드</strong> - 엑셀 템플릿 파일 다운로드</p>
            <p><strong>2. 포장 및 재고 체크</strong> - 엑셀 자료 반영 (수동 과정)</p>
            <p><strong>3. 수량 수정</strong> - 필요 시 주문 수량 수정</p>
            <p><strong>4. 확정 명세서 생성 및 이메일 발송</strong> - 마일리지 차감 및 고객 통보</p>
            <p><strong>5. 운송장 번호 등록 및 출고처리</strong> - 엑셀 자료 업로드 후 최종 출고</p>
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">대기중</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</p>
            </div>
            <Users className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">작업중</p>
              <p className="text-2xl font-bold text-blue-600">{stats.processing || 0}</p>
            </div>
            <FileText className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">출고완료</p>
              <p className="text-2xl font-bold text-green-600">{stats.confirmed || 0}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
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
        <div className="flex items-center justify-between gap-4">
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
              '* 오후 3시 기준 조회 (전날 15:00 ~ 당일 14:59)'
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. 확정전 명세서 다운로드 드롭다운 */}
            <div className="relative" id="statement-dropdown">
              <Button
                onClick={() => setIsStatementDropdownOpen(!isStatementDropdownOpen)}
                disabled={selectedOrders.length === 0 || downloadingPDF || downloadingExcel}
                variant="outline"
                className={`text-xs px-3 py-2 ${
                  downloadingPDF || downloadingExcel
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                    : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300'
                }`}
              >
                {downloadingPDF || downloadingExcel ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-600 mr-1"></div>
                ) : (
                  <FileText className="w-3 h-3 mr-1" />
                )}
                {downloadingPDF || downloadingExcel ? '다운로드 중...' : `1. 확정전 명세서 다운로드 (${selectedOrders.length})`}
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
              
              {isStatementDropdownOpen && !downloadingPDF && !downloadingExcel && (
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
                      1. 확정전 명세서 다운로드 (개별)
                    </button>
                    {/* PDF 다운로드 */}
                    <button
                      onClick={() => {
                        handleDownloadShippingStatementPDF()
                        setIsStatementDropdownOpen(false)
                      }}
                      disabled={downloadingPDF}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4 mr-2 text-red-600" />
                      📄 PDF 일괄 다운로드
                    </button>
                    <button
                      onClick={() => {
                        handleDownloadShippingStatementExcel()
                        setIsStatementDropdownOpen(false)
                      }}
                      disabled={downloadingExcel}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center disabled:opacity-50"
                    >
                      <FileText className="w-4 h-4 mr-2 text-blue-600" />
                      📦 ZIP 파일 (여러 영수증)
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* 4. 확정 명세서 생성 */}
            <Button
              onClick={handleConfirmStatement}
              disabled={
                selectedOrders.length === 0 || 
                updating || 
                downloadingPDF || 
                downloadingExcel
              }
              className="bg-blue-600 hover:bg-blue-700 text-xs px-3 py-2 disabled:opacity-50"
            >
              <FileText className="w-3 h-3 mr-1" />
              4. 확정 명세서 생성 ({selectedOrders.length})
            </Button>
            
            {/* 5. 운송장 등록 및 출고처리 */}
            <Button
              onClick={handleShipOrders}
              disabled={selectedOrders.length === 0 || updating || downloadingPDF || downloadingExcel}
              className="bg-green-600 hover:bg-green-700 text-xs px-3 py-2"
            >
              <FileText className="w-3 h-3 mr-1" />
              5. 운송장 등록 및 출고처리 ({selectedOrders.length})
            </Button>
            
            {/* 구분선 */}
            <div className="w-px bg-gray-300 h-6"></div>
            
            {/* 엑셀 관련 버튼들 */}
            <Button
              onClick={handleDownloadExcel}
              disabled={orders.length === 0 || downloadingPDF || downloadingExcel}
              variant="outline"
              className="text-xs px-3 py-2"
            >
              <Download className="w-3 h-3 mr-1" />
              배송정보 엑셀
            </Button>
            <Button
              onClick={handleDownloadTrackingTemplate}
              disabled={orders.length === 0 || downloadingPDF || downloadingExcel}
              variant="outline"
              className="text-xs px-3 py-2"
            >
              <FileText className="w-3 h-3 mr-1" />
              운송장 템플릿
            </Button>
            <div className="relative">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleUploadExcel}
                disabled={downloadingPDF || downloadingExcel}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button
                variant="outline"
                disabled={downloadingPDF || downloadingExcel}
                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300 disabled:opacity-50 text-xs px-3 py-2"
              >
                <Upload className="w-3 h-3 mr-1" />
                운송장번호 업로드
              </Button>
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
                    onChange={() => toggleAllSelection()}
                    disabled={downloadingPDF || downloadingExcel}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  운송장 상태
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
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      <span className="ml-2 text-gray-500">로딩 중...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
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
                          disabled={downloadingPDF || downloadingExcel}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
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
                          {new Date(order.created_at).toLocaleString('ko-KR', {
                            timeZone: 'Asia/Seoul',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
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
                                      {editingItem?.orderId === order.id && editingItem?.itemId === item.id ? (
                                        <input
                                          type="number"
                                          min="0"
                                          defaultValue={item.quantity}
                                          className="w-16 px-1 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          autoFocus
                                          onBlur={(e) => {
                                            const value = parseInt(e.target.value) || 0
                                            if (value !== item.quantity) {
                                              handleUpdateOrderItem(order.id, item.id, value)
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
                                          onClick={() => setEditingItem({orderId: order.id, itemId: item.id})}
                                        >
                                          {item.quantity}개
                                        </span>
                                      )}
                                    </div>
                                    {(item.shipped_quantity || 0) > 0 && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                                          출고: {item.shipped_quantity}개
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
                        {order.status === 'confirmed' || order.status === 'shipped' ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full text-green-600 bg-green-100">
                            할당완료
                          </span>
                        ) : (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAllocationStatusColor(order.allocation_status || 'pending')}`}>
                            {getAllocationStatusText(order.allocation_status || 'pending')}
                          </span>
                        )}
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
                        {(() => {
                          const trackingStatus = getTrackingStatus(order)
                          return (
                            <div className="space-y-1">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${trackingStatus.color}`}>
                                {trackingStatus.text}
                              </span>
                              {order.tracking_number && (
                                <div className="text-xs text-gray-500">
                                  {order.tracking_number}
                                </div>
                              )}
                            </div>
                          )
                        })()}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
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
            <div>
              {(() => {
                const ordersWithoutTracking = selectedOrdersData.filter(order => 
                  !order.tracking_number || order.tracking_number.trim() === ''
                )
                if (ordersWithoutTracking.length > 0) {
                  return (
                    <div>
                      <span className="text-red-700 font-medium">⚠️ 운송장 미입력:</span>
                      <span className="font-medium text-red-900 ml-2">
                        {ordersWithoutTracking.length}건
                      </span>
                    </div>
                  )
                } else {
                  return (
                    <div>
                      <span className="text-green-700">✓ 운송장 입력:</span>
                      <span className="font-medium text-green-900 ml-2">
                        모두 완료
                      </span>
                    </div>
                  )
                }
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 