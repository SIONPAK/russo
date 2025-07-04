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
  ClipboardList
} from 'lucide-react'

interface InventoryOption {
  color: string
  size: string
  stock_quantity: number
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

  // 통계 계산
  const calculateStats = (productList: Product[]) => {
    let totalStock = 0
    let totalValue = 0
    let lowStockCount = 0
    let outOfStockCount = 0

    productList.forEach(product => {
      if (product.inventory_options && product.inventory_options.length > 0) {
        product.inventory_options.forEach(option => {
          const quantity = option.stock_quantity || 0
          totalStock += quantity
          totalValue += quantity * product.price
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
    if (!value || value <= 0) {
      showError('유효한 수량을 입력해주세요.')
      return
    }

    if (!adjustmentReason.trim()) {
      showError('조정 사유를 입력해주세요.')
      return
    }

    const adjustment = adjustmentType === 'add' ? value : -value
    const adjustmentId = `${adjustmentModal.productId}-${adjustmentModal.color || ''}-${adjustmentModal.size || ''}`
    
    try {
      setAdjusting(adjustmentId)
      
      const response = await fetch(`/api/admin/products/${adjustmentModal.productId}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          adjustment,
          color: adjustmentModal.color,
          size: adjustmentModal.size,
          reason: adjustmentReason
        })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(`재고가 ${adjustmentType === 'add' ? '증가' : '감소'}되었습니다.`)
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
  const openHistoryModal = (productId: string, productName: string, color?: string, size?: string) => {
    setHistoryModal({
      isOpen: true,
      productId,
      productName,
      color,
      size
    })
  }

  // 재고 이력 모달 닫기
  const closeHistoryModal = () => {
    setHistoryModal({
      isOpen: false,
      productId: '',
      productName: ''
    })
  }

  // 엑셀 다운로드 함수들
  const downloadInventoryExcel = () => {
    showInfo('재고 현황 다운로드 기능을 준비 중입니다.')
  }

  const downloadStockHistory = () => {
    showInfo('재고 이력 다운로드 기능을 준비 중입니다.')
  }

  const uploadStockData = () => {
    showInfo('재고 일괄 업로드 기능을 준비 중입니다.')
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
                onClick={() => setCurrentTab(tab.id)}
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
                  <Button variant="outline" onClick={uploadStockData}>
                    <Upload className="h-4 w-4 mr-2" />
                    재고 일괄 업로드
                  </Button>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => showInfo('재고 실사 기능을 준비 중입니다.')}>
                    <ClipboardList className="h-4 w-4 mr-2" />
                    재고 실사
                  </Button>
                  <Button onClick={() => showInfo('입고 등록 기능을 준비 중입니다.')}>
                    <Plus className="h-4 w-4 mr-2" />
                    입고 등록
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
                                {(option.stock_quantity || 0).toLocaleString()}개
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(getStockStatus(option.stock_quantity || 0))}`}>
                                  {getStatusText(getStockStatus(option.stock_quantity || 0))}
                                </span>
                              </td>
                              {index === 0 && (
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" rowSpan={product.inventory_options!.length}>
                                  {formatCurrency(product.price)}
                                </td>
                              )}
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                                {formatCurrency((option.stock_quantity || 0) * product.price)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => openAdjustmentModal(product.id, product.name, option.stock_quantity, option.color, option.size)}
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
            <div className="text-center py-12">
              <TrendingUp className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">입고 관리</h3>
              <p className="text-gray-600 mb-4">입고 예정, 입고 처리, 입고 이력을 관리합니다.</p>
              <Button onClick={() => showInfo('입고 관리 기능을 준비 중입니다.')}>
                <Plus className="h-4 w-4 mr-2" />
                입고 등록
              </Button>
            </div>
          )}

          {currentTab === 'outbound' && (
            <div className="text-center py-12">
              <TrendingDown className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">출고 관리</h3>
              <p className="text-gray-600 mb-4">출고 예정, 출고 처리, 출고 이력을 관리합니다.</p>
              <Button onClick={() => showInfo('출고 관리 기능을 준비 중입니다.')}>
                <Truck className="h-4 w-4 mr-2" />
                출고 등록
              </Button>
            </div>
          )}

          {currentTab === 'history' && (
            <div className="text-center py-12">
              <History className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">재고 이력</h3>
              <p className="text-gray-600 mb-4">모든 재고 변동 이력을 조회합니다.</p>
              <Button onClick={downloadStockHistory}>
                <Download className="h-4 w-4 mr-2" />
                이력 다운로드
              </Button>
            </div>
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
                  min="1"
                  placeholder="수량 입력"
                  value={adjustmentValue}
                  onChange={(e) => setAdjustmentValue(e.target.value)}
                  className="mt-1"
                />
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
                    {(adjustmentModal.currentStock + (adjustmentType === 'add' ? parseInt(adjustmentValue) : -parseInt(adjustmentValue))).toLocaleString()}개
                  </p>
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
            
            <div className="text-center py-12 text-gray-500">
              <History className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>재고 이력 기능을 준비 중입니다.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 