'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
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
  availableColors?: string[]
  availableSizes?: string[]
}

interface ProductSearchResult {
  id: string
  code: string
  name: string
  colors: string[]
  sizes: string[]
  price: number
  stock: number
  inventory_options?: any[]
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
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create')
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [isProductSearchOpen, setIsProductSearchOpen] = useState(false)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<{product: ProductSearchResult, color: string, size: string}[]>([])
  const [shippingAddresses, setShippingAddresses] = useState<any[]>([])
  const [selectedShippingAddress, setSelectedShippingAddress] = useState<any>(null)
  const [isShippingModalOpen, setIsShippingModalOpen] = useState(false)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    // 한국 시간(UTC+9)으로 변환
    const koreaTime = new Date(today.getTime() + (9 * 60 * 60 * 1000))
    return koreaTime.toISOString().split('T')[0]
  })
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  
  // 로컬 스토리지 키
  const STORAGE_KEY = 'order-management-items'

  // 로컬 스토리지에 발주 상품 저장
  const saveOrderItemsToStorage = (items: OrderItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (error) {
      console.error('로컬 스토리지 저장 오류:', error)
    }
  }

  // 로컬 스토리지에서 발주 상품 복원
  const loadOrderItemsFromStorage = () => {
    try {
      const savedItems = localStorage.getItem(STORAGE_KEY)
      if (savedItems) {
        return JSON.parse(savedItems) as OrderItem[]
      }
    } catch (error) {
      console.error('로컬 스토리지 복원 오류:', error)
    }
    return []
  }

  // 로컬 스토리지에서 발주 상품 삭제
  const clearOrderItemsFromStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.error('로컬 스토리지 삭제 오류:', error)
    }
  }

  // 발주 상품 상태 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    if (orderItems.length > 0) {
      saveOrderItemsToStorage(orderItems)
    }
  }, [orderItems])

  // 페이지 로드 시 로컬 스토리지에서 발주 상품 복원
  useEffect(() => {
    if (isAuthenticated && activeTab === 'create') {
      const savedItems = loadOrderItemsFromStorage()
      if (savedItems.length > 0) {
        setOrderItems(savedItems)
      }
    }
  }, [isAuthenticated, activeTab])

  // 사용자 배송지 목록 가져오기
  useEffect(() => {
    const fetchShippingAddresses = async () => {
      if (!isAuthenticated || !user) return

      try {
        const response = await fetch(`/api/shipping-addresses?userId=${user.id}`)
        const result = await response.json()

        

        if (result.success && result.data.length > 0) {
          setShippingAddresses(result.data)
          // 기본 배송지를 선택된 배송지로 설정
          const defaultAddress = result.data.find((addr: any) => addr.is_default) || result.data[0]
          setSelectedShippingAddress(defaultAddress)
          
        } else {
          
          setShippingAddresses([])
          setSelectedShippingAddress(null)
        }
      } catch (error) {
        console.error('배송지 정보 조회 오류:', error)
      }
    }

    fetchShippingAddresses()
  }, [isAuthenticated, user])

  // 발주 내역 조회 (오후 3시 기준, 한국 시간)
  const fetchPurchaseOrders = async (date: string) => {
    if (!isAuthenticated || !user) return

    setIsLoadingOrders(true)
    try {
      // 한국 시간 기준으로 계산
      const selectedDateTime = new Date(date + 'T00:00:00+09:00')
      
      // 전날 오후 3시 (한국 시간)
      const startDate = new Date(selectedDateTime)
      startDate.setDate(startDate.getDate() - 1)
      startDate.setHours(15, 0, 0, 0)
      
      // 당일 오후 2시 59분 59초 (한국 시간)
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

  // URL 파라미터로 전달된 상품 자동 추가
  useEffect(() => {
    const productId = searchParams.get('product')
    if (productId && isAuthenticated && activeTab === 'create' && orderItems.length === 0) {
      addProductFromUrl(productId)
    }
  }, [searchParams, isAuthenticated, activeTab])

  // URL 파라미터로 전달된 상품 추가
  const addProductFromUrl = async (productId: string) => {
    try {
      const response = await fetch(`/api/products/${productId}`)
      const result = await response.json()
      
      if (result.success && result.data) {
        const product = result.data
        
        // 색상/사이즈 옵션 추출
        const availableColors = product.inventory_options && Array.isArray(product.inventory_options) 
          ? [...new Set(product.inventory_options.map((opt: any) => opt.color))] as string[]
          : []
        const availableSizes = product.inventory_options && Array.isArray(product.inventory_options)
          ? [...new Set(product.inventory_options.map((opt: any) => opt.size))] as string[]
          : []
        
        // 상품 정보를 발주서 행에 추가
        const newItem: OrderItem = {
          id: Date.now().toString(),
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          color: '',
          size: '',
          quantity: 1,
          unitPrice: product.is_on_sale && product.sale_price ? product.sale_price : product.price,
          supplyAmount: product.is_on_sale && product.sale_price ? product.sale_price : product.price,
          vat: Math.round((product.is_on_sale && product.sale_price ? product.sale_price : product.price) * 0.1),
          availableColors,
          availableSizes
        }
        
        setOrderItems([newItem])
        // URL 파라미터로 전달된 경우 토스트 표시하지 않음 (상세페이지에서 이미 표시됨)
      }
    } catch (error) {
      console.error('상품 추가 오류:', error)
      showError('상품 추가 중 오류가 발생했습니다.')
    }
  }

  // 탭 변경 시 데이터 조회
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
    setSelectedProducts([])  // 팝업 열 때 선택된 상품들 초기화
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
            stock: product.stock_quantity || 0,
            inventory_options: product.inventory_options || []
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

  // 상품 선택/해제 (다중 선택)
  const toggleProductSelection = (product: ProductSearchResult, color: string, size: string) => {
    const selectionKey = `${product.id}-${color}-${size}`
    const existingIndex = selectedProducts.findIndex(
      item => `${item.product.id}-${item.color}-${item.size}` === selectionKey
    )

    if (existingIndex >= 0) {
      // 이미 선택된 상품이면 제거
      setSelectedProducts(prev => prev.filter((_, index) => index !== existingIndex))
    } else {
      // 새로운 상품이면 추가
      setSelectedProducts(prev => [...prev, { product, color, size }])
    }
  }

  // 선택된 상품들을 모두 행에 추가
  const addSelectedProductsToRows = () => {
    if (selectedProducts.length === 0) return

    const updatedItems = [...orderItems]
    let duplicateCount = 0

    selectedProducts.forEach(({ product, color, size }) => {
      // 같은 상품이 이미 있는지 확인 (상품명, 컬러, 사이즈가 모두 동일)
      const existingItemIndex = updatedItems.findIndex(item => 
        item.productName === product.name &&
        item.color === color &&
        item.size === size
      )

      if (existingItemIndex !== -1) {
        // 기존 상품이 있으면 수량 증가
        const existingItem = updatedItems[existingItemIndex]
        const newQuantity = existingItem.quantity + 1
        const supplyAmount = existingItem.unitPrice * newQuantity
        const vat = Math.floor(supplyAmount * 0.1)

        updatedItems[existingItemIndex] = {
          ...existingItem,
          quantity: newQuantity,
          supplyAmount,
          vat
        }
        duplicateCount++
      } else {
        // 새로운 상품이면 행 추가
        // 옵션별 추가 가격 계산
        const matchingOption = product.inventory_options?.find(
          (opt: any) => opt.color === color && opt.size === size
        )
        const additionalPrice = matchingOption?.additional_price || 0
        const unitPrice = product.price + additionalPrice
        
        const supplyAmount = unitPrice
        const vat = Math.floor(supplyAmount * 0.1)

        const newItem = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          color,
          size,
          quantity: 1,
          unitPrice: unitPrice,
          supplyAmount,
          vat,
          availableColors: product.colors || [],
          availableSizes: product.sizes || []
        }

        // 기존 행이 선택되어 있으면 해당 행 업데이트, 아니면 새 행 추가
        if (selectedRowIndex !== null && updatedItems[selectedRowIndex] && 
            !updatedItems[selectedRowIndex].productName) {
          // 선택된 행이 빈 행이면 해당 행을 업데이트
          updatedItems[selectedRowIndex] = newItem
        } else {
          // 새 행으로 추가
          updatedItems.push(newItem)
        }
      }
    })

    // 빈 행들 제거 (상품명이 없는 행들)
    const finalItems = updatedItems.filter(item => item.productName && item.productName.trim() !== '')

    setOrderItems(finalItems)
    saveOrderItemsToStorage(finalItems) // 로컬 스토리지에 저장

    // 팝업 닫기 및 상태 초기화
    setIsProductSearchOpen(false)
    setSelectedRowIndex(null)
    setSelectedProducts([])
    
    if (duplicateCount > 0) {
      showSuccess(`${selectedProducts.length}개 상품 처리 완료 (${duplicateCount}개 중복 상품 수량 증가)`)
    } else {
      showSuccess(`${selectedProducts.length}개 상품이 추가되었습니다.`)
    }
  }

  // 선택된 상품인지 확인
  const isProductSelected = (product: ProductSearchResult, color: string, size: string) => {
    const selectionKey = `${product.id}-${color}-${size}`
    return selectedProducts.some(
      item => `${item.product.id}-${item.color}-${item.size}` === selectionKey
    )
  }

  // 수량 변경 시 금액 계산 (음수 허용 - 반품 요청)
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

    // 빈 행들 제거 (상품명이 없는 행들)
    const finalItems = updatedItems.filter(item => item.productName && item.productName.trim() !== '')

    setOrderItems(finalItems)
    saveOrderItemsToStorage(finalItems)
  }

  // 옵션별 추가 가격을 반영한 단가 계산
  const calculateUnitPriceWithOptions = async (productId: string, color: string, size: string, basePrice: number) => {
    if (!productId || !color || !size) return basePrice

    try {
      const response = await fetch(`/api/products/${productId}`)
      const result = await response.json()
      
      if (result.success && result.data && result.data.inventory_options) {
        const matchingOption = result.data.inventory_options.find(
          (opt: any) => opt.color === color && opt.size === size
        )
        
        if (matchingOption && matchingOption.additional_price) {
          return basePrice + matchingOption.additional_price
        }
      }
    } catch (error) {
      console.error('옵션별 가격 조회 오류:', error)
    }
    
    return basePrice
  }

  // 색상/사이즈 변경 시 단가 업데이트
  const updateItemOption = async (index: number, field: 'color' | 'size', value: string) => {
    const updatedItems = [...orderItems]
    const item = updatedItems[index]
    
    // 옵션 업데이트
    updatedItems[index] = {
      ...item,
      [field]: value
    }
    
    // 색상과 사이즈가 모두 선택된 경우 추가 가격 반영
    const updatedItem = updatedItems[index]
    if (updatedItem.productId && updatedItem.color && updatedItem.size) {
      try {
        const response = await fetch(`/api/products/${updatedItem.productId}`)
        const result = await response.json()
        
        if (result.success && result.data) {
          const product = result.data
          const basePrice = product.is_on_sale && product.sale_price ? product.sale_price : product.price
          
          // 옵션별 추가 가격 찾기
          const matchingOption = product.inventory_options?.find(
            (opt: any) => opt.color === updatedItem.color && opt.size === updatedItem.size
          )
          const additionalPrice = matchingOption?.additional_price || 0
          const newUnitPrice = basePrice + additionalPrice
          
          const supplyAmount = newUnitPrice * updatedItem.quantity
          const vat = Math.floor(supplyAmount * 0.1)
          
          updatedItems[index] = {
            ...updatedItem,
            unitPrice: newUnitPrice,
            supplyAmount,
            vat
          }
        }
      } catch (error) {
        console.error('옵션별 가격 조회 오류:', error)
      }
    }
    
    setOrderItems(updatedItems)
    saveOrderItemsToStorage(updatedItems)
  }

  // 발주서 저장
  const saveOrder = async () => {
    if (orderItems.length === 0) {
      showError('발주 상품을 추가해주세요.')
      return
    }

    if (!selectedShippingAddress) {
      showError('배송지를 선택해주세요.')
      return
    }

    try {
      const orderData = {
        user_id: user?.id,
        items: orderItems.map(item => ({
          product_id: item.productId,
          product_code: item.productCode,
          product_name: item.productName,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          unit_price: item.unitPrice
        })),
        shipping_address_id: selectedShippingAddress.id,
        shipping_address: selectedShippingAddress.address,
        shipping_postal_code: selectedShippingAddress.postal_code,
        shipping_name: selectedShippingAddress.recipient_name,
        shipping_phone: selectedShippingAddress.phone
      }

      let response
      if (editingOrderId) {
        // 수정 모드: 기존 발주서 업데이트
        response = await fetch(`/api/orders/purchase/${editingOrderId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderData)
        })
      } else {
        // 새 발주서 생성
        response = await fetch('/api/orders/purchase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(orderData)
        })
      }

      const result = await response.json()

      if (result.success) {
        showSuccess(editingOrderId ? '발주서가 수정되었습니다.' : '발주서가 저장되었습니다.')
        setOrderItems([])
        setEditingOrderId(null) // 수정 모드 해제
        clearOrderItemsFromStorage()
        setActiveTab('list')
        fetchPurchaseOrders(selectedDate)
      } else {
        showError(result.message || '발주서 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('발주서 저장 오류:', error)
      showError('발주서 저장 중 오류가 발생했습니다.')
    }
  }

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

  // 오후 3시 이전인지 확인하는 함수
  const isEditableTime = (orderDate: string) => {
    // 현재 한국시간 직접 계산
    const nowKorea = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
    const [datePart, timePart] = nowKorea.split(' ')
    const [year, month, day] = datePart.split('.').map(s => parseInt(s.trim()))
    const [hourMinSec, ampm] = timePart.split(' ')
    const [hour, minute, second] = hourMinSec.split(':').map(s => parseInt(s))
    
    // 24시간 형식으로 변환
    let hour24 = hour
    if (ampm === '오후' && hour !== 12) hour24 += 12
    if (ampm === '오전' && hour === 12) hour24 = 0
    
    // 주문일 파싱
    const orderTime = new Date(orderDate)
    const orderYear = orderTime.getFullYear()
    const orderMonth = orderTime.getMonth()
    const orderDay = orderTime.getDate()
    
    // 오늘 날짜와 주문일이 같은지 확인
    const today = new Date(year, month - 1, day)
    const orderDay2 = new Date(orderYear, orderMonth, orderDay)
    const isSameDay = today.getTime() === orderDay2.getTime()
    
    // 같은 날이고 15시(오후 3시) 이전인 경우만 수정 가능
    return isSameDay && hour24 < 15
  }

  // 발주서 삭제
  const handleDeleteOrder = async (order: PurchaseOrder) => {
    if (!confirm(`발주번호 ${order.order_number}를 삭제하시겠습니까?`)) {
      return
    }

    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        showSuccess('발주서가 삭제되었습니다.')
        fetchPurchaseOrders(selectedDate) // 목록 새로고침
      } else {
        showError(`발주서 삭제 실패: ${result.error}`)
      }
    } catch (error) {
      console.error('발주서 삭제 오류:', error)
      showError('발주서 삭제 중 오류가 발생했습니다.')
    }
  }

  // 발주서 수정 (발주서 작성 탭으로 이동하여 수정)
  const handleEditOrder = async (order: PurchaseOrder) => {
    try {
      // 주문 상세 정보 가져오기
      const response = await fetch(`/api/orders?orderNumber=${order.order_number}`)
      const result = await response.json()

      if (result.success && result.data.order_items) {
        // 발주서 작성 탭으로 이동
        setActiveTab('create')
        setEditingOrderId(order.id) // 수정 모드 설정
        
        // 기존 발주서 데이터를 발주서 작성 폼에 로드 (공급가액과 부가세 재계산, 배송비 제외)
        const filteredItems = result.data.order_items.filter((item: any) => 
          item.product_name !== '배송비' && 
          !item.product_name?.includes('배송비') &&
          item.product_code !== 'SHIPPING'
        )
        
        // 각 상품의 정확한 품목코드를 가져오기 위해 상품 정보 조회
        const editItems: OrderItem[] = await Promise.all(
          filteredItems.map(async (item: any, index: number) => {
            const unitPrice = item.unit_price || 0
            const quantity = item.quantity || 0
            const supplyAmount = unitPrice * quantity
            const vat = Math.floor(supplyAmount * 0.1)
            
            let productCode = item.product_code || ''
            
            // product_id가 있으면 실제 상품 정보에서 품목코드 가져오기
            if (item.product_id) {
              try {
                const productResponse = await fetch(`/api/products/${item.product_id}`)
                const productResult = await productResponse.json()
                if (productResult.success && productResult.data) {
                  productCode = productResult.data.code || productCode
                }
              } catch (error) {
                console.warn('상품 정보 조회 실패:', error)
              }
            }
            
            return {
              id: `edit-${index}`,
              productId: item.product_id || '',
              productCode: productCode,
              productName: item.product_name || item.products?.name || '',
              color: item.color || '',
              size: item.size || '',
              quantity: quantity,
              unitPrice: unitPrice,
              supplyAmount: supplyAmount,
              vat: vat
            }
          })
        )
        
        setOrderItems(editItems)
        clearOrderItemsFromStorage() // 기존 로컬 스토리지 초기화
        showInfo('발주서 수정 모드로 전환되었습니다. 수정 후 저장해주세요.')
      } else {
        showError('발주서 정보를 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('발주서 수정 조회 오류:', error)
      showError('발주서 정보를 불러오는데 실패했습니다.')
    }
  }

  // 총합 계산 (발주와 반품 구분)
  const totals = orderItems.reduce((acc, item) => {
    if (item.quantity > 0) {
      // 발주 항목
      return {
        ...acc,
        orderSupplyAmount: acc.orderSupplyAmount + item.supplyAmount,
        orderVat: acc.orderVat + item.vat,
        orderTotal: acc.orderTotal + item.supplyAmount + item.vat
      }
    } else if (item.quantity < 0) {
      // 반품 항목
      return {
        ...acc,
        returnSupplyAmount: acc.returnSupplyAmount + Math.abs(item.supplyAmount),
        returnVat: acc.returnVat + Math.abs(item.vat),
        returnTotal: acc.returnTotal + Math.abs(item.supplyAmount) + Math.abs(item.vat)
      }
    }
    return acc
  }, { 
    orderSupplyAmount: 0, 
    orderVat: 0, 
    orderTotal: 0,
    returnSupplyAmount: 0,
    returnVat: 0,
    returnTotal: 0
  })

  // 최종 총합 (발주 - 반품)
  const finalTotals = {
    supplyAmount: totals.orderSupplyAmount - totals.returnSupplyAmount,
    vat: totals.orderVat - totals.returnVat,
    total: totals.orderTotal - totals.returnTotal
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">발주관리</h1>
        <p className="text-gray-600 mb-4">B2B 발주서 작성 및 관리</p>
        
        {/* 안내 문구 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <div className="space-y-2">
            <p><strong>*주문 마감은 오후 3시입니다.</strong></p>
            <p>이전까지는 수정 및 삭제가 가능하고, 이후로는 불가능합니다.</p>
            <p><strong>*'행추가'버튼을 누르고 발주하실 상품을 추가 후, 발주서 저장을 눌러주세요.</strong></p>
            <p><strong>*반품의 경우, 수량에 (-)음수 값을 입력하여 발주서를 생성해주세요.</strong></p>
            <p><strong>*협의되지 않은 반품은 불가능하며, 즉시 착불 반송처리 됩니다.</strong></p>
          </div>
        </div>
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
            <div className="flex space-x-3">
              <Button onClick={addEmptyRow} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                행 추가
              </Button>
              <Button 
                onClick={() => {
                  if (confirm('모든 발주 상품을 초기화하시겠습니까?')) {
                    setOrderItems([])
                    clearOrderItemsFromStorage()
                    showInfo('발주 상품이 초기화되었습니다.')
                  }
                }}
                variant="outline"
                className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
              >
                <X className="h-4 w-4 mr-2" />
                전체 초기화
              </Button>
              {editingOrderId && (
                <Button 
                  onClick={() => {
                    setEditingOrderId(null)
                    setOrderItems([])
                    clearOrderItemsFromStorage()
                    showInfo('수정 모드가 취소되었습니다.')
                  }}
                  variant="outline"
                  className="text-gray-600 hover:text-gray-700"
                >
                  <X className="h-4 w-4 mr-2" />
                  수정 취소
                </Button>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {editingOrderId && (
                <span className="text-sm text-blue-600 font-medium">
                  수정 모드
                </span>
              )}
              <Button onClick={saveOrder} disabled={orderItems.length === 0} className="bg-green-600 hover:bg-green-700">
                <Save className="h-4 w-4 mr-2" />
                {editingOrderId ? '발주서 수정' : '발주서 저장'}
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1300px] table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">No.</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">품목코드</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">품목명</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">컬러</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">사이즈</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">수량</th>
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
                        <td className="px-3 py-3 text-sm text-gray-900 truncate" title={item.productName}>{item.productName}</td>
                        <td className="px-3 py-3">
                          {item.availableColors && item.availableColors.length > 0 ? (
                            <select
                              value={item.color}
                              onChange={(e) => updateItemOption(index, 'color', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">색상 선택</option>
                              {item.availableColors.map((color) => (
                                <option key={color} value={color}>
                                  {color}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm text-gray-900">{item.color}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {item.availableSizes && item.availableSizes.length > 0 ? (
                            <select
                              value={item.size}
                              onChange={(e) => updateItemOption(index, 'size', e.target.value)}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">사이즈 선택</option>
                              {item.availableSizes.map((size) => (
                                <option key={size} value={size}>
                                  {size}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm text-gray-900">{item.size}</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-center">
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(index, parseInt(e.target.value) || 0)}
                              className={`w-16 text-center text-sm ${
                                item.quantity < 0 ? 'bg-red-100 border-red-300 text-red-700' : ''
                              }`}
                              placeholder="수량"
                            />
                            {item.quantity < 0 && (
                              <span className="text-xs text-red-600 mt-1">반품요청</span>
                            )}
                          </div>
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
                    {/* 발주 항목 합계 */}
                    {totals.orderTotal > 0 && (
                      <tr className="text-sm">
                        <td colSpan={7} className="px-4 py-2 text-right text-gray-600">
                          발주 소계:
                        </td>
                        <td className="px-4 py-2 text-gray-600 text-right">{formatCurrency(totals.orderSupplyAmount)}</td>
                        <td className="px-4 py-2 text-gray-600 text-right">{formatCurrency(totals.orderVat)}</td>
                        <td className="px-4 py-2 text-gray-600 text-right">{formatCurrency(totals.orderTotal)}</td>
                      </tr>
                    )}
                    
                    {/* 반품 항목 합계 */}
                    {totals.returnTotal > 0 && (
                      <tr className="text-sm">
                        <td colSpan={7} className="px-4 py-2 text-right text-red-600">
                          반품 소계:
                        </td>
                        <td className="px-4 py-2 text-red-600 text-right">-{formatCurrency(totals.returnSupplyAmount)}</td>
                        <td className="px-4 py-2 text-red-600 text-right">-{formatCurrency(totals.returnVat)}</td>
                        <td className="px-4 py-2 text-red-600 text-right">-{formatCurrency(totals.returnTotal)}</td>
                      </tr>
                    )}
                    
                    {/* 최종 합계 */}
                    <tr className="font-medium border-t-2 border-gray-300">
                      <td colSpan={7} className="px-4 py-3 text-right text-gray-900">
                        최종 합계:
                      </td>
                      <td className="px-4 py-3 text-gray-900 text-right">{formatCurrency(finalTotals.supplyAmount)}</td>
                      <td className="px-4 py-3 text-gray-900 text-right">{formatCurrency(finalTotals.vat)}</td>
                      <td className="px-4 py-3 font-bold text-blue-600 text-right">{formatCurrency(finalTotals.total)}</td>
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
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewDetail(order)}>
                              <FileText className="h-4 w-4 mr-1" />
                              상세
                            </Button>
                            {isEditableTime(order.created_at) && (
                              <>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleEditOrder(order)}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  수정
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  onClick={() => handleDeleteOrder(order)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[85vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-medium text-gray-900">상품 검색</h3>
                <p className="text-sm text-gray-600 mt-1">상품명의 일부를 입력하여 검색하세요.</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setIsProductSearchOpen(false)
                  setSelectedProducts([])
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
                  placeholder="상품명 또는 상품코드로 검색..."
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchProducts(searchKeyword)}
                  className="flex-1 h-12"
                  autoFocus
                />
                <Button onClick={() => searchProducts(searchKeyword)} disabled={isSearching} className="h-12 px-6">
                  <Search className="h-4 w-4 mr-2" />
                  {isSearching ? '검색중...' : '검색'}
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
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {product.colors.map((color) =>
                            product.sizes.map((size) => {
                              const isSelected = isProductSelected(product, color, size)
                              
                              // 해당 옵션의 추가 가격 찾기
                              const matchingOption = product.inventory_options?.find(
                                (opt: any) => opt.color === color && opt.size === size
                              )
                              const additionalPrice = matchingOption?.additional_price || 0
                              
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
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center">
                                      {isSelected && <span className="mr-2">✓</span>}
                                      <span>{color} / {size}</span>
                                    </div>
                                    {additionalPrice > 0 && (
                                      <span className="text-xs font-medium">
                                        +{additionalPrice.toLocaleString()}원
                                      </span>
                                    )}
                                  </div>
                                </Button>
                              )
                            })
                          )}
                        </div>
                      </div>
                    ))}
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
                    size="sm"
                    onClick={() => setSelectedProducts([])}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    선택 초기화
                  </Button>
                )}
              </div>
              <div className="flex space-x-3">
                <Button variant="outline" onClick={() => {
                  setIsProductSearchOpen(false)
                  setSelectedProducts([])
                }}>
                  취소
                </Button>
                {selectedProducts.length > 0 && (
                  <Button 
                    onClick={addSelectedProductsToRows}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    선택한 상품 추가 ({selectedProducts.length}개)
                  </Button>
                )}
              </div>
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