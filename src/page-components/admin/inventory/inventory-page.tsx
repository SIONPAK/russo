'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { formatCurrency } from '@/shared/lib/utils'
import { showSuccess, showError, showInfo } from '@/shared/lib/toast'
import { 
  Search, 
  Filter, 
  AlertTriangle,
  Download,
  Package,
  TrendingUp,
  TrendingDown,
  Edit,
  Plus,
  Minus,
  X,
  History,
  FileText,
  BarChart3,
  Calendar,
  Upload,
  Eye,
  ArrowUpDown,
  Truck,
  ClipboardList,
  RefreshCw
} from 'lucide-react'
import * as XLSX from 'xlsx'

interface InventoryOption {
  color: string
  size: string
  stock_quantity: number
  additional_price?: number
  physical_stock?: number
  allocated_stock?: number
}

interface Product {
  id: string
  name: string
  code: string
  stock_quantity: number
  price: number
  inventory_options?: InventoryOption[]
  category?: {
    name: string
  }
  images?: Array<{
    image_url: string
    is_main: boolean
  }>
}

interface InventoryStats {
  totalStock: number
  totalValue: number
  lowStockCount: number
  outOfStockCount: number
  totalProducts: number
  todayInbound: number
  todayOutbound: number
}

interface StockAdjustmentModal {
  isOpen: boolean
  productId: string
  productName: string
  color?: string
  size?: string
  currentStock: number
}

interface StockHistoryModal {
  isOpen: boolean
  productId: string
  productName: string
  color?: string
  size?: string
}

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [currentTab, setCurrentTab] = useState('overview') // overview, inbound, outbound, history


  const [stats, setStats] = useState<InventoryStats>({
    totalStock: 0,
    totalValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalProducts: 0,
    todayInbound: 0,
    todayOutbound: 0
  })
  
  // 재고 조정 모달 상태
  const [adjustmentModal, setAdjustmentModal] = useState<StockAdjustmentModal>({
    isOpen: false,
    productId: '',
    productName: '',
    currentStock: 0
  })
  const [adjustmentValue, setAdjustmentValue] = useState('')
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'subtract'>('add')
  const [adjustmentReason, setAdjustmentReason] = useState('')

  // 재고 이력 모달 상태
  const [historyModal, setHistoryModal] = useState<StockHistoryModal>({
    isOpen: false,
    productId: '',
    productName: ''
  })
  const [historyData, setHistoryData] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // 입고 등록 모달 상태
  const [inboundModal, setInboundModal] = useState({
    isOpen: false,
    productId: '',
    productName: ''
  })

  // 재고 이력 관련 상태 추가
  const [stockHistoryData, setStockHistoryData] = useState<any[]>([])
  const [stockHistoryLoading, setStockHistoryLoading] = useState(false)

  // 입고/출고 내역 상태 추가
  const [inboundData, setInboundData] = useState<any[]>([])
  const [outboundData, setOutboundData] = useState<any[]>([])
  const [inboundLoading, setInboundLoading] = useState(false)
  const [outboundLoading, setOutboundLoading] = useState(false)

  // 상품 데이터 가져오기
  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/products?limit=1000')
      const result = await response.json()

      if (result.success) {
        setProducts(result.data || [])
        calculateStats(result.data || [])
      } else {
        showError('상품 데이터를 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('상품 데이터 가져오기 실패:', error)
      showError('상품 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 통계 계산 (새로운 재고 구조 반영)
  const calculateStats = (productList: Product[]) => {
    let totalStock = 0
    let totalValue = 0
    let lowStockCount = 0
    let outOfStockCount = 0

    productList.forEach(product => {
      if (product.inventory_options && product.inventory_options.length > 0) {
        product.inventory_options.forEach(option => {
          // 새로운 구조 우선 확인
          let quantity = 0
          if (option.physical_stock !== undefined && option.allocated_stock !== undefined) {
            quantity = Math.max(0, (option.physical_stock || 0) - (option.allocated_stock || 0))
          } else {
            quantity = option.stock_quantity || 0
          }
          
          totalStock += quantity
          totalValue += quantity * (product.price + (option.additional_price || 0))
          if (quantity === 0) outOfStockCount++
          else if (quantity <= 10) lowStockCount++
        })
      } else {
        const quantity = product.stock_quantity || 0
        totalStock += quantity
        totalValue += quantity * product.price
        if (quantity === 0) outOfStockCount++
        else if (quantity <= 10) lowStockCount++
      }
    })

    setStats({
      totalStock,
      totalValue,
      lowStockCount,
      outOfStockCount,
      totalProducts: productList.length,
      todayInbound: 0, // TODO: 실제 입고 데이터
      todayOutbound: 0 // TODO: 실제 출고 데이터
    })
  }

  // 재고 상태 판단
  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return 'out_of_stock'
    if (quantity <= 10) return 'low'
    return 'normal'
  }

  // 재고 수량 계산 (새로운 구조 반영)
  const getStockQuantity = (option: any) => {
    if (option.physical_stock !== undefined && option.allocated_stock !== undefined) {
      return Math.max(0, (option.physical_stock || 0) - (option.allocated_stock || 0))
    }
    return option.stock_quantity || 0
  }

  // 물리적 재고 표시 (새로운 구조에서만)
  const getPhysicalStock = (option: any) => {
    if (option.physical_stock !== undefined) {
      return option.physical_stock || 0
    }
    return null
  }

  // 할당된 재고 표시 (새로운 구조에서만)
  const getAllocatedStock = (option: any) => {
    if (option.allocated_stock !== undefined) {
      return option.allocated_stock || 0
    }
    return null
  }

  // 재고 상태 판단 (옵션 객체 기준)
  const getStockStatusForOption = (option: any) => {
    const quantity = getStockQuantity(option)
    return getStockStatus(quantity)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-green-600 bg-green-100'
      case 'low': return 'text-yellow-600 bg-yellow-100'
      case 'out_of_stock': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal': return '정상'
      case 'low': return '부족'
      case 'out_of_stock': return '품절'
      default: return '알 수 없음'
    }
  }

  // 재고 조정 모달 열기
  const openAdjustmentModal = (productId: string, productName: string, currentStock: number, color?: string, size?: string) => {
    setAdjustmentModal({
      isOpen: true,
      productId,
      productName,
      color,
      size,
      currentStock
    })
    setAdjustmentValue('')
    setAdjustmentType('add')
    setAdjustmentReason('')
  }

  // 재고 조정 모달 닫기
  const closeAdjustmentModal = () => {
    setAdjustmentModal({
      isOpen: false,
      productId: '',
      productName: '',
      currentStock: 0
    })
    setAdjustmentValue('')
    setAdjustmentReason('')
  }

  // 재고 조정 실행
  const executeAdjustment = async () => {
    const value = parseInt(adjustmentValue)
    
    // 🎯 입력값 검증 (음수 허용)
    if (isNaN(value)) {
      showError('유효한 수량을 입력해주세요.')
      return
    }

    if (!adjustmentReason.trim()) {
      showError('조정 사유를 입력해주세요.')
      return
    }

    // 🎯 음수값 입력 시 최종 결과가 0이 되는 경우 확인 메시지
    if (value < 0) {
      const confirmMessage = '실 재고값을 0으로 설정하시겠습니까?'
      if (!confirm(confirmMessage)) {
        return
      }
      
      // 절대값으로 0 설정
      const requestData = {
        absolute_value: 0,
        color: adjustmentModal.color,
        size: adjustmentModal.size,
        reason: adjustmentReason
      }
      
      await performStockAdjustment(requestData, 0)
      return
    }

    // 🎯 조정수량이 0인 경우 재고를 0으로 설정
    if (value === 0) {
      const confirmMessage = '실 재고값을 0으로 설정하시겠습니까?'
      if (!confirm(confirmMessage)) {
        return
      }
      
      // 절대값으로 0 설정
      const requestData = {
        absolute_value: 0,
        color: adjustmentModal.color,
        size: adjustmentModal.size,
        reason: adjustmentReason
      }
      
      await performStockAdjustment(requestData, 0)
      return
    }

    // 일반적인 증감 처리
    const adjustment = adjustmentType === 'add' ? value : -value
    const expectedStock = adjustmentModal.currentStock + adjustment
    
    // 재고가 0 이하가 되는 경우 확인 메시지 및 조정
    if (expectedStock <= 0) {
      const confirmMessage = '실 재고값을 0으로 설정하시겠습니까?'
      if (!confirm(confirmMessage)) {
        return
      }
      
      // 현재 재고를 모두 출고하도록 조정 (절대값 설정)
      const requestData = {
        absolute_value: 0,
        color: adjustmentModal.color,
        size: adjustmentModal.size,
        reason: adjustmentReason
      }
      
      await performStockAdjustment(requestData, 0)
      return
    }

    // 일반적인 증감 처리
    const requestData = {
      adjustment,
      color: adjustmentModal.color,
      size: adjustmentModal.size,
      reason: adjustmentReason
    }
    
    await performStockAdjustment(requestData, expectedStock)
  }

  // 재고 조정 실제 처리 함수
  const performStockAdjustment = async (requestData: any, expectedStock: number) => {
    const adjustmentId = `${adjustmentModal.productId}-${adjustmentModal.color || ''}-${adjustmentModal.size || ''}`
    
    try {
      setAdjusting(adjustmentId)
      
      console.log('🔄 재고 조정 API 호출 시작:', {
        productId: adjustmentModal.productId,
        requestData,
        adjustmentType,
        expectedStock
      })
      
      const response = await fetch(`/api/admin/products/${adjustmentModal.productId}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      const result = await response.json()
      
      console.log('📦 재고 조정 API 응답:', result)

      if (result.success) {
        let message = expectedStock === 0 
          ? '재고가 0개로 설정되었습니다.'
          : `재고가 ${adjustmentType === 'add' ? '증가' : '감소'}되었습니다.`
        
        // 재할당 결과가 있는 경우 추가 정보 표시
        if (result.data.allocation) {
          const allocation = result.data.allocation
          console.log('🔄 재할당 결과:', allocation)
          
          if (allocation.success) {
            if (adjustmentType === 'add' && allocation.allocations && allocation.allocations.length > 0) {
              message += ` 추가로 ${allocation.allocations.length}건의 주문에 재고가 자동 할당되었습니다.`
            } else if ((adjustmentType === 'subtract' || expectedStock === 0) && allocation.reallocations && allocation.reallocations.length > 0) {
              message += ` ${allocation.reallocations.length}건의 주문이 시간순으로 재할당되었습니다.`
            }
          }
        } else {
          console.log('⚠️ 재할당 결과가 없습니다.')
        }
        
        showSuccess(message)
        showInfo('주문 관리 페이지에서 변경된 재고 할당 상태를 확인하세요.')
        await fetchProducts()
        closeAdjustmentModal()
      } else {
        showError(result.error || '재고 조정에 실패했습니다.')
      }
    } catch (error) {
      console.error('재고 조정 실패:', error)
      showError('재고 조정 중 오류가 발생했습니다.')
    } finally {
      setAdjusting(null)
    }
  }

  // 재고 이력 모달 열기
  const openHistoryModal = async (productId: string, productName: string, color?: string, size?: string) => {
    setHistoryModal({
      isOpen: true,
      productId,
      productName,
      color,
      size
    })
    
    // 재고 이력 데이터 가져오기
    try {
      setHistoryLoading(true)
      const params = new URLSearchParams({
        ...(color && { color }),
        ...(size && { size }),
        limit: '20'
      })
      
      const response = await fetch(`/api/admin/inventory/history/${productId}?${params}`)
      const result = await response.json()
      
      if (result.success) {
        setHistoryData(result.data.history || [])
      } else {
        showError('재고 이력을 불러오는데 실패했습니다.')
        setHistoryData([])
      }
    } catch (error) {
      console.error('재고 이력 조회 실패:', error)
      showError('재고 이력을 불러오는데 실패했습니다.')
      setHistoryData([])
    } finally {
      setHistoryLoading(false)
    }
  }

  // 재고 이력 모달 닫기
  const closeHistoryModal = () => {
    setHistoryModal({
      isOpen: false,
      productId: '',
      productName: ''
    })
    setHistoryData([])
  }

  // 재고 이력 데이터 가져오기
  const fetchStockHistory = async () => {
    try {
      setStockHistoryLoading(true)
      
      const response = await fetch('/api/admin/inventory/history/export')
      const result = await response.json()
      
      if (result.success) {
        // API에서 받은 데이터를 파싱하여 표시용 데이터로 변환
        const parsedData = await parseStockHistoryData(result.data.fileData)
        setStockHistoryData(parsedData)
      } else {
        showError('재고 이력을 불러오는데 실패했습니다.')
        setStockHistoryData([])
      }
    } catch (error) {
      console.error('재고 이력 조회 실패:', error)
      showError('재고 이력을 불러오는데 실패했습니다.')
      setStockHistoryData([])
    } finally {
      setStockHistoryLoading(false)
    }
  }

  // Base64 엑셀 데이터를 파싱하여 배열로 변환
  const parseStockHistoryData = async (base64Data: string): Promise<any[]> => {
    try {
      // Base64를 ArrayBuffer로 변환
      const byteCharacters = atob(base64Data)
      const byteNumbers = new Array(byteCharacters.length)
      
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      
      const byteArray = new Uint8Array(byteNumbers)
      
      // XLSX로 파싱
      const workbook = XLSX.read(byteArray, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      
      // JSON으로 변환
      const jsonData = XLSX.utils.sheet_to_json(worksheet)
      
      // 빈 행 제거
      return jsonData.filter((row: any) => row['번호'] && row['상품명'])
    } catch (error) {
      console.error('엑셀 데이터 파싱 실패:', error)
      return []
    }
  }

  // 재고 이력 탭이 선택될 때 데이터 로드
  useEffect(() => {
    if (currentTab === 'history') {
      fetchStockHistory()
    } else if (currentTab === 'inbound') {
      fetchInboundData()
    } else if (currentTab === 'outbound') {
      fetchOutboundData()
    }
  }, [currentTab])

  // 엑셀 다운로드 함수들
  const downloadInventoryExcel = async () => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/admin/inventory/export')
      if (!response.ok) {
        throw new Error('재고 현황 다운로드에 실패했습니다.')
      }
      
      const result = await response.json()
      if (result.success) {
        // Base64 데이터를 Blob으로 변환
        const base64Data = result.data.fileData
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        })
        
        // 파일 다운로드
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.href = url
        link.download = result.data.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        showSuccess('재고 현황이 다운로드되었습니다.')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('재고 다운로드 실패:', error)
      showError(error instanceof Error ? error.message : '재고 다운로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const downloadStockHistory = async () => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/admin/inventory/history/export')
      if (!response.ok) {
        throw new Error('재고 이력 다운로드에 실패했습니다.')
      }
      
      const result = await response.json()
      if (result.success) {
        // Base64 데이터를 Blob으로 변환하여 다운로드
        const base64Data = result.data.fileData
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        })
        
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.href = url
        link.download = result.data.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        showSuccess('재고 이력이 다운로드되었습니다.')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('재고 이력 다운로드 실패:', error)
      showError(error instanceof Error ? error.message : '재고 이력 다운로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const uploadStockData = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      try {
        // 🎯 엑셀 파일 읽기 및 0인 값 확인
        const arrayBuffer = await file.arrayBuffer()
        const workbook = XLSX.read(arrayBuffer, { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        
        // 헤더 제외하고 데이터 행만 확인
        const dataRows = jsonData.slice(1) as any[]
        const hasZeroOrNegativeQuantity = dataRows.some((row: any[]) => {
          // 수량 컬럼이 0 또는 음수인 행이 있는지 확인 (일반적으로 4번째 컬럼이 수량)
          const quantity = row[3] // 0-based index이므로 4번째 컬럼
          return quantity === 0 || quantity === '0' || quantity < 0
        })
        
        if (hasZeroOrNegativeQuantity) {
          const confirmMessage = '수량이 0 또는 음수로 설정되어 있는 행이 있습니다. 실 재고를 0으로 수정하시겠습니까?'
          if (!confirm(confirmMessage)) {
            return
          }
        }
        
        setLoading(true)
        
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch('/api/admin/inventory/upload', {
          method: 'POST',
          body: formData
        })
        
        const result = await response.json()
        if (result.success) {
          let message = `${result.data.successCount}개의 재고가 업데이트되었습니다.`
          
          // 재할당 결과가 있는 경우 추가 정보 표시
          if (result.data.allocationResults && result.data.allocationResults.length > 0) {
            const totalAllocations = result.data.allocationResults.reduce((sum: number, item: any) => {
              return sum + (item.allocations?.length || 0) + (item.deallocations?.length || 0)
            }, 0)
            
            if (totalAllocations > 0) {
              message += ` ${totalAllocations}건의 주문에 재고 재할당이 수행되었습니다.`
            }
          }
          
          showSuccess(message)
          if (result.data.errorCount > 0) {
            showError(`${result.data.errorCount}개의 오류가 발생했습니다.`)
          }
          showInfo('주문 관리 페이지에서 변경된 재고 할당 상태를 확인하세요.')
          await fetchProducts() // 목록 새로고침
        } else {
          throw new Error(result.error)
        }
      } catch (error) {
        console.error('재고 업로드 실패:', error)
        showError(error instanceof Error ? error.message : '재고 업로드 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }
    input.click()
  }

  const downloadStockTemplate = async () => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/admin/inventory/template')
      if (!response.ok) {
        throw new Error('양식 다운로드에 실패했습니다.')
      }
      
      const result = await response.json()
      if (result.success) {
        // Base64 데이터를 Blob으로 변환
        const base64Data = result.data.fileData
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        })
        
        // 파일 다운로드
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.href = url
        link.download = result.data.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        showSuccess('재고 업로드 양식이 다운로드되었습니다.')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('양식 다운로드 실패:', error)
      showError(error instanceof Error ? error.message : '양식 다운로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const performStockAudit = async () => {
    if (!confirm('재고 실사를 진행하시겠습니까? 현재 재고와 시스템 재고를 비교합니다.')) {
      return
    }
    
    try {
      setLoading(true)
      
      const response = await fetch('/api/admin/inventory/audit', {
        method: 'POST'
      })
      
      const result = await response.json()
      if (result.success) {
        showSuccess(`재고 실사가 완료되었습니다. 차이: ${result.data.discrepancies}건`)
        await fetchProducts() // 목록 새로고침
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('재고 실사 실패:', error)
      showError(error instanceof Error ? error.message : '재고 실사 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const registerInbound = async (productId: string, quantity: number, reason: string, color?: string, size?: string) => {
    try {
      setLoading(true)
      
      const response = await fetch('/api/admin/inventory/inbound', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: productId,
          quantity,
          reason,
          color,
          size
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        showSuccess('입고 등록이 완료되었습니다.')
        fetchInboundData() // 입고 내역 새로고침
        fetchProducts() // 상품 목록 새로고침
        setInboundModal({ isOpen: false, productId: '', productName: '' })
      } else {
        showError(result.error || '입고 등록에 실패했습니다.')
      }
    } catch (error) {
      console.error('입고 등록 실패:', error)
      showError('입고 등록 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 입고 내역 가져오기
  const fetchInboundData = async () => {
    try {
      setInboundLoading(true)
      
      // stock_movements 테이블에서 입고 내역 조회
      const response = await fetch('/api/admin/inventory/movements?type=inbound')
      const result = await response.json()
      
      if (result.success) {
        setInboundData(result.data || [])
      } else {
        showError('입고 내역을 불러오는데 실패했습니다.')
        setInboundData([])
      }
    } catch (error) {
      console.error('입고 내역 조회 실패:', error)
      showError('입고 내역을 불러오는데 실패했습니다.')
      setInboundData([])
    } finally {
      setInboundLoading(false)
    }
  }

  // 출고 내역 가져오기
  const fetchOutboundData = async () => {
    try {
      setOutboundLoading(true)
      
      // stock_movements 테이블에서 출고 내역 조회
      const response = await fetch('/api/admin/inventory/movements?type=outbound')
      const result = await response.json()
      
      if (result.success) {
        setOutboundData(result.data || [])
      } else {
        showError('출고 내역을 불러오는데 실패했습니다.')
        setOutboundData([])
      }
    } catch (error) {
      console.error('출고 내역 조회 실패:', error)
      showError('출고 내역을 불러오는데 실패했습니다.')
      setOutboundData([])
    } finally {
      setOutboundLoading(false)
    }
  }

  // 필터링된 상품 목록
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.code.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (!matchesSearch) return false

    if (statusFilter !== 'all') {
      if (product.inventory_options && product.inventory_options.length > 0) {
        const hasMatchingStatus = product.inventory_options.some(option => 
          getStockStatus(option.stock_quantity || 0) === statusFilter
        )
        if (!hasMatchingStatus) return false
      } else {
        if (getStockStatus(product.stock_quantity || 0) !== statusFilter) return false
      }
    }

    return true
  })

  // 탭 메뉴
  const tabs = [
    { id: 'overview', label: '재고 현황', icon: Package },
    { id: 'inbound', label: '입고 관리', icon: TrendingUp },
    { id: 'outbound', label: '출고 관리', icon: TrendingDown },
    { id: 'history', label: '재고 이력', icon: History }
  ]

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">재고 데이터를 불러오는 중...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">재고 관리</h1>
        <p className="text-gray-600 mt-2">상품 재고 현황 및 입출고 관리</p>
      </div>

      {/* 재고 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <div className="flex items-center">
            <Package className="h-6 w-6 text-blue-600" />
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">총 재고</p>
              <p className="text-lg font-bold text-gray-900">{stats.totalStock.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
          <div className="flex items-center">
            <BarChart3 className="h-6 w-6 text-green-600" />
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">재고 가치</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(stats.totalValue)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">부족 재고</p>
              <p className="text-lg font-bold text-yellow-600">{stats.lowStockCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
          <div className="flex items-center">
            <TrendingDown className="h-6 w-6 text-red-600" />
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">품절</p>
              <p className="text-lg font-bold text-red-600">{stats.outOfStockCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-purple-500">
          <div className="flex items-center">
            <TrendingUp className="h-6 w-6 text-purple-600" />
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">금일 입고</p>
              <p className="text-lg font-bold text-purple-600">{stats.todayInbound}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
          <div className="flex items-center">
            <Truck className="h-6 w-6 text-orange-600" />
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">금일 출고</p>
              <p className="text-lg font-bold text-orange-600">{stats.todayOutbound}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-gray-500">
          <div className="flex items-center">
            <ClipboardList className="h-6 w-6 text-gray-600" />
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600">총 상품</p>
              <p className="text-lg font-bold text-gray-600">{stats.totalProducts}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setCurrentTab(tab.id)
                  // 탭 변경 시 해당 데이터 로드
                  if (tab.id === 'inbound') {
                    fetchInboundData()
                  } else if (tab.id === 'outbound') {
                    fetchOutboundData()
                  } else if (tab.id === 'history') {
                    fetchStockHistory()
                  }
                }}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  currentTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* 탭 컨텐츠 */}
        <div className="p-6">
          {currentTab === 'overview' && (
            <>
              {/* 액션 버튼 */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={downloadInventoryExcel}>
                    <Download className="h-4 w-4 mr-2" />
                    재고 현황 다운로드
                  </Button>
                  <Button variant="outline" onClick={downloadStockTemplate}>
                    <FileText className="h-4 w-4 mr-2" />
                    업로드 양식 다운로드
                  </Button>
                  <Button variant="outline" onClick={uploadStockData}>
                    <Upload className="h-4 w-4 mr-2" />
                    재고 일괄 업로드
                  </Button>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={performStockAudit}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    재고 실사
                  </Button>
                </div>
              </div>

              {/* 검색 및 필터 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="상품명, 상품코드 검색"
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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
                    <option value="normal">정상</option>
                    <option value="low">부족</option>
                    <option value="out_of_stock">품절</option>
                  </select>
                </div>
              </div>

              {/* 재고 목록 */}
              <div className="bg-gray-50 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200 bg-white rounded-t-lg">
                  <h3 className="text-lg font-semibold text-gray-900">
                    재고 현황 ({filteredProducts.length}개 상품)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          상품정보
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          옵션
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          재고수량
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          상태
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          단가
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          추가가격
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          재고가치
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          관리
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredProducts.map((product) => {
                        if (product.inventory_options && product.inventory_options.length > 0) {
                          return product.inventory_options.map((option, index) => (
                            <tr key={`${product.id}-${option.color}-${option.size}`} className="hover:bg-gray-50">
                              {index === 0 && (
                                <td className="px-6 py-4 whitespace-nowrap" rowSpan={product.inventory_options!.length}>
                                  <div className="flex items-center">
                                    {product.images?.[0] && (
                                      <img 
                                        src={product.images[0].image_url} 
                                        alt={product.name}
                                        className="w-12 h-12 rounded-lg object-cover mr-4"
                                      />
                                    )}
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                      <div className="text-sm text-gray-500">{product.code}</div>
                                    </div>
                                  </div>
                                </td>
                              )}
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {option.color} / {option.size}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                {getStockQuantity(option).toLocaleString()}개
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(getStockStatusForOption(option))}`}>
                                  {getStatusText(getStockStatusForOption(option))}
                                </span>
                              </td>
                              {index === 0 && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" rowSpan={product.inventory_options!.length}>
                                  {formatCurrency(product.price)}
                                </td>
                              )}
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                {option.additional_price ? formatCurrency(option.additional_price) : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                {formatCurrency(getStockQuantity(option) * (product.price + (option.additional_price || 0)))}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openAdjustmentModal(product.id, product.name, getStockQuantity(option), option.color, option.size)}
                                  disabled={adjusting === `${product.id}-${option.color}-${option.size}`}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  조정
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openHistoryModal(product.id, product.name, option.color, option.size)}
                                >
                                  <History className="h-3 w-3 mr-1" />
                                  이력
                                </Button>
                              </td>
                            </tr>
                          ))
                        } else {
                          return (
                            <tr key={product.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  {product.images?.[0] && (
                                    <img 
                                      src={product.images[0].image_url} 
                                      alt={product.name}
                                      className="w-12 h-12 rounded-lg object-cover mr-4"
                                    />
                                  )}
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">{product.name}</div>
                                    <div className="text-sm text-gray-500">{product.code}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                일반 상품
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                {product.stock_quantity.toLocaleString()}개
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(getStockStatus(product.stock_quantity))}`}>
                                  {getStatusText(getStockStatus(product.stock_quantity))}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(product.price)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                -
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                {formatCurrency(product.stock_quantity * product.price)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openAdjustmentModal(product.id, product.name, product.stock_quantity)}
                                  disabled={adjusting === product.id}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  조정
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openHistoryModal(product.id, product.name)}
                                >
                                  <History className="h-3 w-3 mr-1" />
                                  이력
                                </Button>
                              </td>
                            </tr>
                          )
                        }
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredProducts.length === 0 && (
                  <div className="p-12 text-center text-gray-500 bg-white">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>조건에 맞는 상품이 없습니다.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {currentTab === 'inbound' && (
            <>
              {/* 액션 버튼 */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">입고 관리</h3>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={fetchInboundData} disabled={inboundLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${inboundLoading ? 'animate-spin' : ''}`} />
                    새로고침
                  </Button>
                  <Button onClick={() => setInboundModal({ isOpen: true, productId: '', productName: '' })}>
                    <Plus className="h-4 w-4 mr-2" />
                    입고 등록
                  </Button>
                </div>
              </div>

              {/* 입고 내역 목록 */}
              <div className="bg-gray-50 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200 bg-white rounded-t-lg">
                  <h4 className="text-md font-medium text-gray-900">
                    입고 내역 ({inboundData.length}건)
                  </h4>
                </div>
                
                {inboundLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">입고 내역을 불러오는 중...</p>
                  </div>
                ) : inboundData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            상품정보
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            입고수량
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            입고 후 수량
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            입고유형
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            사유
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            입고일시
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {inboundData.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                                <div className="text-sm text-gray-500">{item.product_code}</div>
                                {item.color && item.size && (
                                  <div className="text-sm text-gray-500">{item.color} / {item.size}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-green-600">
                                +{item.quantity}개
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-green-600">
                                {item.stock_quantity}개
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                                {item.movement_type === 'adjustment' ? '재고조정' : 
                                 item.movement_type === 'purchase' ? '신규입고' :
                                 item.movement_type === 'return' ? '반품입고' :
                                 item.movement_type === 'sample_return' ? '샘플반납' : '기타'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.notes || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.created_at ? new Date(item.created_at).toISOString().slice(0, 19).replace('T', ' ') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>입고 내역이 없습니다.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {currentTab === 'outbound' && (
            <>
              {/* 액션 버튼 */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">출고 관리</h3>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={fetchOutboundData} disabled={outboundLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${outboundLoading ? 'animate-spin' : ''}`} />
                    새로고침
                  </Button>
                </div>
              </div>

              {/* 출고 내역 목록 */}
              <div className="bg-gray-50 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200 bg-white rounded-t-lg">
                  <h4 className="text-md font-medium text-gray-900">
                    출고 내역 ({outboundData.length}건)
                  </h4>
                </div>
                
                {outboundLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">출고 내역을 불러오는 중...</p>
                  </div>
                ) : outboundData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            상품정보
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            출고수량
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            출고 후 수량
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            출고유형
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            주문정보
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            출고일시
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {outboundData.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                                <div className="text-sm text-gray-500">{item.product_code}</div>
                                {item.color && item.size && (
                                  <div className="text-sm text-gray-500">{item.color} / {item.size}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-red-600">
                                -{Math.abs(item.quantity)}개
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-green-600">
                                {item.stock_quantity}개
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                                {item.movement_type === 'order_shipment' ? '주문출고' :
                                 item.movement_type === 'sample_out' ? '샘플출고' :
                                 item.movement_type === 'adjustment' ? '재고조정' : '기타'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.reference_type === 'order' ? (
                                <div>
                                  <div className="font-medium">{item.order_number || '-'}</div>
                                  <div>{item.customer_name || '-'}</div>
                                </div>
                              ) : item.reference_type === 'sample' ? (
                                <div>
                                  <div className="font-medium">샘플: {item.sample_number || '-'}</div>
                                  <div>{item.customer_name || '-'}</div>
                                </div>
                              ) : (
                                <div>{item.notes || item.reason || '-'}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.created_at ? new Date(item.created_at).toISOString().slice(0, 19).replace('T', ' ') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <TrendingDown className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>출고 내역이 없습니다.</p>
                  </div>
                )}
              </div>
            </>
          )}

          {currentTab === 'history' && (
            <>
              {/* 액션 버튼 */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-gray-900">재고 이력</h3>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={fetchStockHistory} disabled={stockHistoryLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${stockHistoryLoading ? 'animate-spin' : ''}`} />
                    새로고침
                  </Button>
                  <Button onClick={downloadStockHistory}>
                    <Download className="h-4 w-4 mr-2" />
                    이력 다운로드
                  </Button>
                </div>
              </div>

              {/* 재고 이력 목록 */}
              <div className="bg-gray-50 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200 bg-white rounded-t-lg">
                  <h4 className="text-md font-medium text-gray-900">
                    재고 변동 이력 ({stockHistoryData.length}건)
                  </h4>
                </div>
                
                {stockHistoryLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">재고 이력을 불러오는 중...</p>
                  </div>
                ) : stockHistoryData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            번호
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            상품정보
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            옵션
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            변경유형
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            수량
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            주문정보
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            변경일시
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {stockHistoryData.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {item['번호']}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{item['상품명']}</div>
                                <div className="text-sm text-gray-500">{item['상품코드']}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item['색상']} / {item['사이즈']}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                item['변경유형'] === '출고' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {item['변경유형']}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div>
                                <div>주문: {item['주문수량']}개</div>
                                <div>출고: {item['출고수량']}개</div>
                                {item['변경수량'] !== '-' && (
                                  <div className="text-red-600 font-medium">변경: {item['변경수량']}개</div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div>
                                <div className="font-medium">{item['주문번호']}</div>
                                <div>{item['고객사']}</div>
                                <div className="text-xs">{item['주문상태']}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.created_at ? new Date(item.created_at).toISOString().slice(0, 19).replace('T', ' ') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>재고 변동 이력이 없습니다.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 재고 조정 모달 */}
      {adjustmentModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">재고 조정</h3>
              <Button variant="outline" size="sm" onClick={closeAdjustmentModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">상품명</p>
                <p className="font-medium">{adjustmentModal.productName}</p>
                {adjustmentModal.color && adjustmentModal.size && (
                  <p className="text-sm text-gray-500">{adjustmentModal.color} / {adjustmentModal.size}</p>
                )}
              </div>
              
              <div>
                <p className="text-sm text-gray-600">현재 재고</p>
                <p className="font-medium text-lg">{adjustmentModal.currentStock.toLocaleString()}개</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-600">조정 유형</label>
                <div className="flex space-x-2 mt-1">
                  <Button
                    variant={adjustmentType === 'add' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAdjustmentType('add')}
                    className="flex-1"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    입고
                  </Button>
                  <Button
                    variant={adjustmentType === 'subtract' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAdjustmentType('subtract')}
                    className="flex-1"
                  >
                    <Minus className="h-3 w-3 mr-1" />
                    출고
                  </Button>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-600">조정 수량</label>
                <Input
                  type="number"
                  placeholder="수량 입력 (0 또는 음수 입력시 재고 0으로 설정)"
                  value={adjustmentValue}
                  onChange={(e) => setAdjustmentValue(e.target.value)}
                  className="mt-1"
                />
                {(parseInt(adjustmentValue) === 0 || parseInt(adjustmentValue) < 0) && (
                  <p className="text-xs text-orange-600 mt-1">
                    ⚠️ 재고가 0으로 설정됩니다.
                  </p>
                )}
                {adjustmentType === 'subtract' && parseInt(adjustmentValue) > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    현재 재고({adjustmentModal.currentStock}개) 이상 입력 시 재고가 0이 됩니다.
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm text-gray-600">조정 사유</label>
                <Input
                  placeholder="조정 사유를 입력하세요"
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              {adjustmentValue && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-600">조정 후 예상 재고</p>
                  <p className="font-medium text-lg">
                    {(() => {
                      const value = parseInt(adjustmentValue) || 0
                      
                      // 0 또는 음수 입력시 재고 0으로 설정
                      if (value === 0 || value < 0) {
                        return '0'
                      }
                      
                      const change = adjustmentType === 'add' ? value : -value
                      const result = adjustmentModal.currentStock + change
                      return Math.max(0, result).toLocaleString()
                    })()}개
                  </p>
                  {parseInt(adjustmentValue) === 0 && (
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠️ 재고가 0으로 설정됩니다.
                    </p>
                  )}
                  {adjustmentType === 'subtract' && parseInt(adjustmentValue) > 0 && parseInt(adjustmentValue) >= adjustmentModal.currentStock && (
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠️ 재고가 0으로 설정됩니다.
                    </p>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex space-x-2 mt-6">
              <Button variant="outline" onClick={closeAdjustmentModal} className="flex-1">
                취소
              </Button>
              <Button
                onClick={executeAdjustment}
                disabled={!adjustmentValue || !adjustmentReason.trim() || adjusting !== null}
                className="flex-1"
              >
                {adjusting ? '처리중...' : '조정 실행'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 재고 이력 모달 */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">재고 이력</h3>
              <Button variant="outline" size="sm" onClick={closeHistoryModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="mb-4">
              <p className="font-medium">{historyModal.productName}</p>
              {historyModal.color && historyModal.size && (
                <p className="text-sm text-gray-500">{historyModal.color} / {historyModal.size}</p>
              )}
            </div>
            
            {historyLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">재고 이력을 불러오는 중...</p>
              </div>
            ) : historyData.length > 0 ? (
              <div className="space-y-4">
                <div className="max-h-96 overflow-y-auto">
                  {historyData.map((item, index) => (
                    <div key={index} className="border-b border-gray-200 pb-3 mb-3 last:border-b-0">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              item.quantity < 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {item.quantity < 0 ? '출고' : '입고'}
                            </span>
                            <span className="text-sm text-gray-600">{item.description}</span>
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            주문번호: {item.order_number || 'N/A'} | 상태: {item.order_status || 'N/A'}
                          </div>
                          {(item.color || item.size) && (
                            <div className="mt-1 text-sm text-gray-500">
                              옵션: {item.color || '-'} / {item.size || '-'}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-medium ${
                            item.quantity < 0 ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {item.quantity > 0 ? '+' : ''}{item.quantity}개
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.created_at ? new Date(item.created_at).toISOString().slice(0, 19).replace('T', ' ') : '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>재고 변동 이력이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 입고 등록 모달 */}
      {inboundModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">입고 등록</h3>
              <Button variant="outline" size="sm" onClick={() => setInboundModal({ isOpen: false, productId: '', productName: '' })}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <InboundRegistrationForm
              products={products}
              onSubmit={registerInbound}
              onCancel={() => setInboundModal({ isOpen: false, productId: '', productName: '' })}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// 입고 등록 폼 컴포넌트
function InboundRegistrationForm({ 
  products, 
  onSubmit, 
  onCancel 
}: { 
  products: Product[]
  onSubmit: (productId: string, quantity: number, reason: string, color?: string, size?: string) => void
  onCancel: () => void
}) {
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [selectedColor, setSelectedColor] = useState('')
  const [selectedSize, setSelectedSize] = useState('')

  // 선택된 상품의 옵션 정보
  const selectedProductData = products.find(p => p.id === selectedProduct)
  const hasOptions = selectedProductData?.inventory_options && selectedProductData.inventory_options.length > 0

  // 사용 가능한 색상 목록
  const availableColors = hasOptions 
    ? [...new Set(selectedProductData!.inventory_options!.map(opt => opt.color))]
    : []

  // 선택된 색상에 따른 사이즈 목록
  const availableSizes = hasOptions && selectedColor
    ? selectedProductData!.inventory_options!
        .filter(opt => opt.color === selectedColor)
        .map(opt => opt.size)
    : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedProduct || !quantity || !reason.trim()) {
      showError('모든 필드를 입력해주세요.')
      return
    }

    // 옵션이 있는 상품인 경우 색상/사이즈 필수 체크
    if (hasOptions && (!selectedColor || !selectedSize)) {
      showError('색상과 사이즈를 선택해주세요.')
      return
    }

    const qty = parseInt(quantity)
    if (qty <= 0) {
      showError('올바른 수량을 입력해주세요.')
      return
    }

    onSubmit(selectedProduct, qty, reason, selectedColor || undefined, selectedSize || undefined)
  }

  // 상품 변경 시 옵션 초기화
  const handleProductChange = (productId: string) => {
    setSelectedProduct(productId)
    setSelectedColor('')
    setSelectedSize('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">상품 선택</label>
        <select
          value={selectedProduct}
          onChange={(e) => handleProductChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          <option value="">상품을 선택하세요</option>
          {products.map(product => (
            <option key={product.id} value={product.id}>
              [{product.code}] {product.name}
            </option>
          ))}
        </select>
      </div>

      {/* 색상/사이즈 옵션 (옵션이 있는 상품인 경우만 표시) */}
      {hasOptions && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">색상</label>
            <select
              value={selectedColor}
              onChange={(e) => {
                setSelectedColor(e.target.value)
                setSelectedSize('') // 색상 변경 시 사이즈 초기화
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">색상을 선택하세요</option>
              {availableColors.map(color => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사이즈</label>
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              disabled={!selectedColor}
            >
              <option value="">사이즈를 선택하세요</option>
              {availableSizes.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">입고 수량</label>
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="입고할 수량을 입력하세요"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">입고 사유</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          rows={3}
          placeholder="입고 사유를 입력하세요"
          required
        />
      </div>

      <div className="flex space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          취소
        </Button>
        <Button type="submit" className="flex-1">
          입고 등록
        </Button>
      </div>
    </form>
  )
}