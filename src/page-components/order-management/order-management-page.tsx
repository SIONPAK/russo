'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { showSuccess, showError, showInfo } from '@/shared/lib/toast'
import { formatCurrency } from '@/shared/lib/utils'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { 
  Plus, 
  Save, 
  FileText, 
  Search, 
  Package,
  Trash2,
  Calendar,
  List,
  X
} from 'lucide-react'

interface OrderItem {
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

interface ProductSearchResult {
  id: string
  code: string
  name: string
  colors: string[]
  sizes: string[]
  price: number
  stock: number
}

interface PurchaseOrder {
  id: string
  order_number: string
  total_amount: number
  status: string
  created_at: string
  shipping_address: string
  shipping_name?: string
  shipping_phone?: string
  shipping_postal_code?: string
  order_items: any[]
}

export function OrderManagementPage() {
  const { user, isAuthenticated } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create')
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [shippingAddresses, setShippingAddresses] = useState<any[]>([])
  const [selectedShippingAddress, setSelectedShippingAddress] = useState<any>(null)
  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false)
  
  // 발주 내역 관련 상태
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // 사용자 배송지 목록 가져오기
  useEffect(() => {
    const fetchShippingAddresses = async () => {
      if (!isAuthenticated || !user) return

      try {
        const response = await fetch(`/api/shipping-addresses?userId=${user.id}`)
        const result = await response.json()

        console.log('배송지 API 응답:', result)

        if (result.success && result.data.length > 0) {
          setShippingAddresses(result.data)
          // 기본 배송지를 선택된 배송지로 설정
          const defaultAddress = result.data.find((addr: any) => addr.is_default) || result.data[0]
          setSelectedShippingAddress(defaultAddress)
          console.log('선택된 기본 배송지:', defaultAddress)
        } else {
          console.log('배송지 정보 없음')
          setShippingAddresses([])
          setSelectedShippingAddress(null)
        }
      } catch (error) {
        console.error('배송지 정보 조회 오류:', error)
      }
    }

    fetchShippingAddresses()
  }, [isAuthenticated, user])

  // 발주 내역 조회 (오후 3시 기준)
  const fetchPurchaseOrders = async (date: string) => {
    if (!isAuthenticated || !user) return

    setIsLoadingOrders(true)
    try {
      const selectedDateTime = new Date(date)
      
      const startDate = new Date(selectedDateTime)
      startDate.setDate(startDate.getDate() - 1)
      startDate.setHours(15, 0, 0, 0)
      
      const endDate = new Date(selectedDateTime)
      endDate.setHours(14, 59, 59, 999)

      const response = await fetch(
        `/api/orders?userId=${user.id}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&type=purchase`
      )
      const result = await response.json()

      if (result.success) {
        setPurchaseOrders(result.data || [])
      } else {
        showError('발주 내역 조회에 실패했습니다.')
      }
    } catch (error) {
      console.error('발주 내역 조회 오류:', error)
      showError('발주 내역 조회 중 오류가 발생했습니다.')
    } finally {
      setIsLoadingOrders(false)
    }
  }

  // 탭 변경 시 발주 내역 조회
  useEffect(() => {
    if (activeTab === 'list') {
      fetchPurchaseOrders(selectedDate)
    }
  }, [activeTab, selectedDate, isAuthenticated, user])

  // 빈 행 추가
  const addEmptyRow = () => {
    const newItem: OrderItem = {
      id: Date.now().toString(),
      productId: '',
      productCode: '',
      productName: '',
      color: '',
      size: '',
      quantity: 0,
      unitPrice: 0,
      supplyAmount: 0,
      vat: 0
    }
    setOrderItems([...orderItems, newItem])
  }

  // 행 삭제
  const removeRow = (index: number) => {
    const newItems = orderItems.filter((_, i) => i !== index)
    setOrderItems(newItems)
  }

  // 품목코드 더블클릭 시 상품 검색 팝업 열기
  const handleProductCodeDoubleClick = (index: number) => {
    setSelectedRowIndex(index)
    setIsProductSearchOpen(true)
    setSearchKeyword('')
    setSearchResults([])
  }

  // 상품 검색
  const searchProducts = async (keyword: string) => {
    if (!keyword.trim()) return

    setIsSearching(true)
    try {
      const response = await fetch(`/api/products?search=${encodeURIComponent(keyword)}`)
      const result = await response.json()

      if (result.success && Array.isArray(result.data)) {
        const products: ProductSearchResult[] = result.data.map((product: any) => {
          const colors = product.inventory_options 
            ? [...new Set(product.inventory_options.map((opt: any) => opt.color).filter(Boolean))]
            : ['기본']
          
          const sizes = product.inventory_options 
            ? [...new Set(product.inventory_options.map((opt: any) => opt.size).filter(Boolean))]
            : ['기본']

          return {
            id: product.id,
            code: product.code,
            name: product.name,
            colors: colors.length > 0 ? colors : ['기본'],
            sizes: sizes.length > 0 ? sizes : ['기본'],
            price: product.price,
            stock: product.stock_quantity || 0
          }
        })
        setSearchResults(products)
      } else {
        setSearchResults([])
        showError('상품을 찾을 수 없습니다.')
      }
    } catch (error) {
      console.error('Product search error:', error)
      setSearchResults([])
      showError('상품 검색 중 오류가 발생했습니다.')
    } finally {
      setIsSearching(false)
    }
  }

  // 상품 선택
  const selectProduct = (product: ProductSearchResult, color: string, size: string) => {
    if (selectedRowIndex === null) return

    const supplyAmount = product.price
    const vat = Math.floor(supplyAmount * 0.1)

    const updatedItems = [...orderItems]
    updatedItems[selectedRowIndex] = {
      ...updatedItems[selectedRowIndex],
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      color,
      size,
      unitPrice: product.price,
      supplyAmount,
      vat
    }

    setOrderItems(updatedItems)
    setIsProductSearchOpen(false)
    setSelectedRowIndex(null)
  }

  // 수량 변경 시 금액 계산
  const updateQuantity = (index: number, quantity: number) => {
    const updatedItems = [...orderItems]
    const item = updatedItems[index]
    const supplyAmount = item.unitPrice * quantity
    const vat = Math.floor(supplyAmount * 0.1)

    updatedItems[index] = {
      ...item,
      quantity,
      supplyAmount,
      vat
    }

    setOrderItems(updatedItems)
  }

  // 발주서 저장
  const saveOrder = async () => {
    if (!isAuthenticated || !user) {
      showError('로그인이 필요합니다.')
      return
    }

    const validItems = orderItems.filter(item => 
      item.productId && item.productCode && item.productName && item.quantity > 0
    )

    if (validItems.length === 0) {
      showError('발주할 상품을 추가해주세요.')
      return
    }

    try {
      const requestData = {
        userId: user.id,
        items: validItems,
        totalAmount: validItems.reduce((sum, item) => sum + item.supplyAmount + item.vat, 0),
        shippingInfo: selectedShippingAddress ? {
          shipping_name: selectedShippingAddress.recipient_name,
          shipping_phone: selectedShippingAddress.phone,
          shipping_address: selectedShippingAddress.address,
          shipping_postal_code: selectedShippingAddress.postal_code
        } : {
          shipping_name: (user as any).company_name || (user as any).representative_name || '',
          shipping_phone: (user as any).phone || '',
          shipping_address: (user as any).address || '',
          shipping_postal_code: (user as any).postal_code || ''
        }
      }

      console.log('발주서 저장 요청 데이터:', requestData)
      console.log('현재 배송지 상태:', selectedShippingAddress)

      const response = await fetch('/api/orders/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      })

      const result = await response.json()

      if (result.success) {
        showSuccess('발주서가 저장되었습니다.')
        setOrderItems([])
        setActiveTab('list')
        fetchPurchaseOrders(selectedDate)
      } else {
        showError(result.error || '발주서 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('Save order error:', error)
      showError('발주서 저장 중 오류가 발생했습니다.')
    }
  }

  // 발주서 상세보기
  const handleViewDetail = async (order: PurchaseOrder) => {
    try {
      // 주문 상세 정보 가져오기
      const response = await fetch(`/api/orders?orderNumber=${order.order_number}`)
      const result = await response.json()

      if (result.success) {
        setSelectedOrder({
          ...order,
          order_items: result.data.order_items || []
        })
        setIsDetailModalOpen(true)
      } else {
        showError('발주서 상세 정보를 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('발주서 상세 조회 오류:', error)
      showError('발주서 상세 정보를 불러오는데 실패했습니다.')
    }
  }

  // 총합 계산
  const totals = orderItems.reduce((acc, item) => ({
    supplyAmount: acc.supplyAmount + item.supplyAmount,
    vat: acc.vat + item.vat,
    total: acc.total + item.supplyAmount + item.vat
  }), { supplyAmount: 0, vat: 0, total: 0 })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">발주관리</h1>
        <p className="text-gray-600">B2B 발주서 작성 및 관리</p>
      </div>

      {/* 탭 메뉴 */}
      <div className="flex space-x-1 mb-6">
        <Button
          variant={activeTab === 'create' ? 'default' : 'outline'}
          onClick={() => setActiveTab('create')}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>발주서 작성</span>
        </Button>
        <Button
          variant={activeTab === 'list' ? 'default' : 'outline'}
          onClick={() => setActiveTab('list')}
          className="flex items-center space-x-2"
        >
          <List className="h-4 w-4" />
          <span>발주 내역</span>
        </Button>
      </div>

      {/* 발주서 작성 탭 */}
      {activeTab === 'create' && (
        <>
          {/* 배송지 선택 섹션 */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-lg font-medium mb-4">배송지 선택</h3>
            {selectedShippingAddress ? (
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{selectedShippingAddress.recipient_name}</span>
                      {selectedShippingAddress.is_default && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">기본</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {selectedShippingAddress.phone}
                    </div>
                    <div className="text-sm text-gray-600">
                      ({selectedShippingAddress.postal_code}) {selectedShippingAddress.address}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsShippingModalOpen(true)}
                    className="ml-4"
                  >
                    배송지 변경
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">등록된 배송지가 없습니다.</p>
                <Button
                  onClick={() => setIsShippingModalOpen(true)}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  배송지 등록
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mb-6">
            <Button onClick={addEmptyRow} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              행 추가
            </Button>
            <Button onClick={saveOrder} disabled={orderItems.length === 0} className="bg-green-600 hover:bg-green-700">
              <Save className="h-4 w-4 mr-2" />
              발주서 저장
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">No.</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">품목코드</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[200px]">품목명</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">컬러</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">사이즈</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">수량</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">단가</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">공급가액</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">부가세</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">액션</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orderItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                        <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>발주할 상품을 추가해주세요.</p>
                      </td>
                    </tr>
                  ) : (
                    orderItems.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-sm text-gray-900 text-center">{index + 1}</td>
                        <td className="px-3 py-3">
                          <div
                            className="text-sm text-blue-600 cursor-pointer hover:text-blue-800 font-medium truncate"
                            onDoubleClick={() => handleProductCodeDoubleClick(index)}
                            title="더블클릭하여 상품 검색"
                          >
                            {item.productCode || '더블클릭하여 선택'}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900">{item.productName}</td>
                        <td className="px-3 py-3 text-sm text-gray-900 text-center">{item.color}</td>
                        <td className="px-3 py-3 text-sm text-gray-900 text-center">{item.size}</td>
                        <td className="px-3 py-3">
                          <Input
                            type="number"
                            min="0"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 0)}
                            className="w-16 text-center text-sm"
                          />
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-3 py-3 text-sm text-gray-900 font-medium text-right">{formatCurrency(item.supplyAmount)}</td>
                        <td className="px-3 py-3 text-sm text-gray-900 text-right">{formatCurrency(item.vat)}</td>
                        <td className="px-3 py-3 text-center">
                          <Button size="sm" variant="destructive" onClick={() => removeRow(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                
                {orderItems.length > 0 && (
                  <tfoot className="bg-gray-50">
                    <tr className="font-medium">
                      <td colSpan={7} className="px-4 py-3 text-right text-sm text-gray-900">합계:</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(totals.supplyAmount)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(totals.vat)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-blue-600">{formatCurrency(totals.total)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* 발주 내역 탭 */}
      {activeTab === 'list' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-gray-500" />
                <label className="text-sm font-medium text-gray-700">조회 날짜:</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="text-sm text-gray-500">
                * 선택한 날짜 기준 전날 15:00 ~ 당일 14:59 발주 내역
              </div>
            </div>
            <Button onClick={() => fetchPurchaseOrders(selectedDate)} disabled={isLoadingOrders}>
              <Search className="h-4 w-4 mr-2" />
              조회
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">발주번호</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">발주일시</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총 금액</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">배송지</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">액션</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isLoadingOrders ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="mt-4">조회 중...</p>
                      </td>
                    </tr>
                  ) : purchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>해당 기간에 발주 내역이 없습니다.</p>
                      </td>
                    </tr>
                  ) : (
                    purchaseOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-blue-600">{order.order_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{new Date(order.created_at).toLocaleString('ko-KR')}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{formatCurrency(order.total_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.status === 'pending' ? '대기' : 
                             order.status === 'processing' ? '처리중' :
                             order.status === 'completed' ? '완료' : order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {order.shipping_name && order.shipping_address 
                            ? `${order.shipping_name} - ${order.shipping_address}`
                            : order.shipping_address || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="outline" onClick={() => handleViewDetail(order)}>
                            <FileText className="h-4 w-4 mr-1" />
                            상세
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 상품 검색 팝업 */}
      {isProductSearchOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">상품 검색</h3>
              <p className="text-sm text-gray-600 mt-1">상품명의 일부를 입력하여 검색하세요.</p>
            </div>
            
            <div className="p-6">
              <div className="flex space-x-2 mb-4">
                <Input
                  type="text"
                  placeholder="상품명 검색..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchProducts(searchKeyword)}
                  className="flex-1"
                />
                <Button onClick={() => searchProducts(searchKeyword)} disabled={isSearching}>
                  <Search className="h-4 w-4 mr-2" />
                  검색
                </Button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {isSearching ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">검색 중...</p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>검색 결과가 없습니다.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {searchResults.map((product) => (
                      <div key={product.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium text-gray-900">{product.name}</h4>
                            <p className="text-sm text-gray-600">코드: {product.code}</p>
                            <p className="text-sm text-gray-600">가격: {formatCurrency(product.price)}</p>
                            <p className="text-sm text-gray-600">재고: {product.stock}개</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {product.colors.map((color) =>
                            product.sizes.map((size) => (
                              <Button
                                key={`${color}-${size}`}
                                variant="outline"
                                onClick={() => selectProduct(product, color, size)}
                                className="text-left justify-start"
                              >
                                {color} / {size}
                              </Button>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <Button variant="outline" onClick={() => setIsProductSearchOpen(false)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 발주서 상세보기 모달 */}
      {isDetailModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">발주서 상세보기</h3>
                <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                  닫기
                </Button>
              </div>
            </div>
            
            <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
              {/* 발주서 기본 정보 */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">발주 정보</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">발주번호:</span> {selectedOrder.order_number}</div>
                    <div><span className="font-medium">발주일시:</span> {new Date(selectedOrder.created_at).toLocaleString('ko-KR')}</div>
                    <div><span className="font-medium">총 금액:</span> {formatCurrency(selectedOrder.total_amount)}</div>
                    <div>
                      <span className="font-medium">상태:</span>
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        selectedOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        selectedOrder.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        selectedOrder.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedOrder.status === 'pending' ? '대기' : 
                         selectedOrder.status === 'processing' ? '처리중' :
                         selectedOrder.status === 'completed' ? '완료' : selectedOrder.status}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">배송 정보</h4>
                  <div className="space-y-2 text-sm">
                    {selectedOrder.shipping_name && (
                      <div><span className="font-medium">수령인:</span> {selectedOrder.shipping_name}</div>
                    )}
                    {selectedOrder.shipping_phone && (
                      <div><span className="font-medium">연락처:</span> {selectedOrder.shipping_phone}</div>
                    )}
                    {selectedOrder.shipping_address && (
                      <div><span className="font-medium">주소:</span> {selectedOrder.shipping_address}</div>
                    )}
                    {selectedOrder.shipping_postal_code && (
                      <div><span className="font-medium">우편번호:</span> {selectedOrder.shipping_postal_code}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* 발주 상품 목록 */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">발주 상품</h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품명</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">옵션</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수량</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">단가</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총액</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {selectedOrder.order_items?.map((item: any, index: number) => (
                        <tr key={index}>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.product_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {item.color && item.size ? `${item.color} / ${item.size}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(item.unit_price)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{formatCurrency(item.total_price)}</td>
                        </tr>
                      )) || (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            상품 정보를 불러오는 중...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 배송지 선택 모달 */}
      {isShippingModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">배송지 선택</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsShippingModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {shippingAddresses.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">등록된 배송지가 없습니다.</p>
                  <p className="text-sm text-gray-400">마이페이지에서 배송지를 등록해주세요.</p>
                </div>
              ) : (
                shippingAddresses.map((address) => (
                  <div
                    key={address.id}
                    onClick={() => {
                      setSelectedShippingAddress(address)
                      setIsShippingModalOpen(false)
                    }}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedShippingAddress?.id === address.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{address.recipient_name}</span>
                          {address.is_default && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">기본</span>
                          )}
                          {selectedShippingAddress?.id === address.id && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">선택됨</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {address.phone}
                        </div>
                        <div className="text-sm text-gray-600">
                          ({address.postal_code}) {address.address}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setIsShippingModalOpen(false)}
              >
                취소
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 