'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, ArrowLeft, MapPin, Plus } from 'lucide-react'
import { MainLayout } from '@/widgets/layout/main-layout'
import { Button } from '@/shared/ui/button'
import { AddressSearch } from '@/shared/ui/address-search'
import { useOrder, OrderItem } from '@/features/order/model/use-order'
import { useOrderForm, OrderFormData } from '@/features/order/model/use-order-form'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { ShippingAddress } from '@/entities/user/model/user-store'
import { formatCurrency } from '@/shared/lib/utils'
import { generateReceipt, formatDate, ReceiptData } from '@/shared/lib/receipt-utils'
import { showInfo, showSuccess } from '@/shared/lib/toast'

interface OrderPageProps {
  cartItems?: any[]
  orderType?: 'normal' | 'sample'
}

export function OrderPage({ cartItems = [], orderType: initialOrderType = 'normal' }: OrderPageProps) {
  const router = useRouter()
  const { createOrder, isLoading: isOrderLoading } = useOrder()
  const { isAuthenticated, user } = useAuthStore()
  
  const {
    formData,
    isLoading: isFormLoading,
    profile,
    shippingAddresses,
    defaultShippingAddress,
    updateOrderInfo,
    updateShippingInfo,
    updateAllShippingInfo,
    toggleUseSameAddress,
    selectShippingAddress,
    updateOrderNotes,
    validateForm
  } = useOrderForm(user?.id || '')

  // 주문 타입 관련 상태 (샘플은 촬영용만)
  const [orderType, setOrderType] = useState<'normal' | 'sample'>(initialOrderType)

  // 배송 메모 관련 상태
  const [selectedMemoOption, setSelectedMemoOption] = useState('')
  const [customMemo, setCustomMemo] = useState('')

  // 배송 메모 옵션들
  const memoOptions = [
    '배송 전에 미리 연락바랍니다.',
    '부재 시 경비실에 맡겨주세요.',
    '부재 시 문 앞에 놓아주세요.',
    '빠른 배송 부탁드립니다.',
    '택배함에 보관해 주세요.',
    '직접 입력'
  ]

  // 섹션 접기/펼치기 상태
  const [expandedSections, setExpandedSections] = useState({
    orderType: true,
    orderInfo: true,
    shipping: true,
    products: true,
    payment: true
  })

  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !isAuthenticated) {
      showInfo('로그인이 필요합니다.')
      router.push('/auth/login')
    }
  }, [mounted, isAuthenticated, router])

  // URL에서 장바구니 데이터 가져오기 (실제로는 상태 관리나 API로 처리)
  useEffect(() => {
    // 장바구니가 비어있으면 장바구니 페이지로 리다이렉트
    if (mounted && cartItems.length === 0) {
      showInfo('주문할 상품이 없습니다.')
      router.push('/cart')
    }
  }, [mounted, cartItems, router])

  // 배송 메모 변경 처리
  useEffect(() => {
    if (selectedMemoOption === '직접 입력') {
      updateOrderNotes(customMemo)
    } else {
      updateOrderNotes(selectedMemoOption)
      setCustomMemo('')
    }
  }, [selectedMemoOption, customMemo, updateOrderNotes])

  // 주문자 정보 업데이트 (배송지 동기화 포함)
  const handleOrderInfoUpdate = (field: keyof OrderFormData['orderInfo'], value: string) => {
    updateOrderInfo(field, value)
    
    // "주문자 정보와 동일" 선택 시 배송지 정보도 함께 업데이트
    if (formData.useSameAddress && (field === 'name' || field === 'phone')) {
      updateShippingInfo(field, value)
    }
  }

  // 배송지 동일 설정 토글 (현재 주문자 정보 반영)
  const handleUseSameAddressToggle = (useSame: boolean) => {
    if (useSame) {
      // 주문자 정보를 배송지에 한 번에 설정
      const shippingInfo = {
        name: formData.orderInfo.name,
        phone: formData.orderInfo.phone,
        address: defaultShippingAddress?.address || profile?.address || '',
        postalCode: defaultShippingAddress?.postal_code || profile?.postal_code || ''
      }
      
      updateAllShippingInfo(shippingInfo)
    } else {
      // 새로운 배송지 등록 선택 시 배송지 필드들을 비움
      const emptyShippingInfo = {
        name: '',
        phone: '',
        address: '',
        postalCode: ''
      }
      
      updateAllShippingInfo(emptyShippingInfo)
    }
    
    // 상태 토글
    toggleUseSameAddress(useSame)
  }

  // 주문 상품 정보 계산 (샘플 주문은 0원)
  const orderItems: OrderItem[] = cartItems.map(item => {
    let adjustedPrice = item.price
    
    // 샘플 주문은 촬영용으로 0원
    if (orderType === 'sample') {
      adjustedPrice = 0
    }
    
    return {
      productId: item.id,
      productName: item.name,
      productCode: item.code || '',
      quantity: item.quantity,
      unitPrice: adjustedPrice,
      totalPrice: adjustedPrice * item.quantity,
      color: item.color || '기본',
      size: item.size || '기본',
      options: item.options,
      originalPrice: item.price // 원래 가격 보관
    }
  })

  const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0)
  const shippingFee = orderType === 'sample' ? 0 : 3000 // 샘플 주문은 무료배송
  const totalAmount = subtotal + shippingFee

  // 섹션 토글
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // 카카오 주소 검색 결과 처리
  const handleAddressSelect = (addressData: {
    zonecode: string
    address: string
    detailAddress?: string
  }) => {
    updateShippingInfo('postalCode', addressData.zonecode)
    updateShippingInfo('address', addressData.address)
  }

  // 주문 생성
  const handleSubmit = async () => {
    try {
      const validationError = validateForm()
      if (validationError) {
        alert(validationError)
        return
      }

      if (!user?.id) {
        showInfo('로그인이 필요합니다.')
        router.push('/auth/login')
        return
      }

      let createdOrder: any

      if (orderType === 'sample') {
        // 샘플 주문 API 호출
        const sampleOrderData = {
          user_id: user.id, // 사용자 ID 직접 전달
          product_id: orderItems[0].productId, // 샘플은 단일 상품만
          quantity: orderItems[0].quantity,
          sample_type: 'photography', // 촬영용 샘플
          delivery_address: `${formData.shippingInfo.address} (${formData.shippingInfo.postalCode})`,
          notes: formData.orderNotes || '', // 요청사항만 저장
          product_options: `색상: ${orderItems[0].color}, 사이즈: ${orderItems[0].size}` // 상품 옵션 정보
        }

        const response = await fetch('/api/orders/sample', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(sampleOrderData),
        })

        const result = await response.json()

        if (!result.success) {
          throw new Error(result.error || '샘플 주문에 실패했습니다.')
        }

        createdOrder = {
          order_number: result.data.sample_number,
          id: result.data.id
        }
      } else {
        // 일반 주문 API 호출
        const orderData = {
          userId: user.id,
          orderType,
          items: orderItems.map(item => ({
            productId: item.productId,
            productName: item.productName,
            productCode: item.productCode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            color: item.color,
            size: item.size,
            options: item.options
          })),
          shippingInfo: {
            name: formData.shippingInfo.name,
            phone: formData.shippingInfo.phone,
            address: formData.shippingInfo.address,
            postalCode: formData.shippingInfo.postalCode
          },
          totalAmount,
          shippingFee,
          notes: formData.orderNotes || undefined
        }

        createdOrder = await createOrder(orderData)
      }
      
      // 영수증 데이터 준비
      const receiptData: ReceiptData = {
        orderNumber: createdOrder.order_number,
        orderDate: formatDate(new Date()),
        customerName: (user as any)?.company_name || formData.orderInfo.name,
        customerPhone: formData.orderInfo.phone,
        customerEmail: formData.orderInfo.email,
        shippingName: formData.shippingInfo.name,
        shippingPhone: formData.shippingInfo.phone,
        shippingAddress: formData.shippingInfo.address,
        shippingPostalCode: formData.shippingInfo.postalCode,
        items: orderItems.map(item => ({
          productName: item.productName,
          productCode: item.productCode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          color: item.color,
          size: item.size,
          options: item.options
        })),
        subtotal,
        shippingFee,
        totalAmount,
        notes: formData.orderNotes
      }
      
      // 영수증 다운로드
      const receiptGenerated = await generateReceipt(receiptData)
      
      if (receiptGenerated) {
        showSuccess(`${orderType === 'sample' ? '샘플 주문' : '주문'}이 완료되었습니다. 영수증이 다운로드됩니다.`)
      } else {
        showInfo(`${orderType === 'sample' ? '샘플 주문' : '주문'}은 완료되었으나 영수증 다운로드에 실패했습니다.`)
      }
      
      // 주문 완료 페이지로 이동
      if (orderType === 'sample') {
        router.push('/mypage/sample-orders')
      } else {
        router.push(`/order/complete?orderNumber=${createdOrder.order_number}`)
      }
      
    } catch (error) {
      console.error('주문 생성 실패:', error)
      alert(error instanceof Error ? error.message : '주문 처리 중 오류가 발생했습니다.')
    }
  }

  if (!mounted) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      </MainLayout>
    )
  }

  if (!isAuthenticated || cartItems.length === 0) {
    return null // useEffect에서 리다이렉트 처리
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 헤더 */}
          <div className="mb-8">
            <button
              onClick={() => router.back()}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              뒤로가기
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {orderType === 'sample' ? '샘플 주문/결제' : '주문/결제'}
            </h1>
          </div>

          {isFormLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 주문 타입 선택 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <button
                  onClick={() => toggleSection('orderType')}
                  className="w-full bg-gray-50 p-4 flex items-center justify-between text-left rounded-t-lg"
                >
                  <span className="font-medium text-lg">주문 타입</span>
                  {expandedSections.orderType ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                
                {expandedSections.orderType && (
                  <div className="p-6 space-y-4">
                    <div className="flex items-center space-x-6">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={orderType === 'normal'}
                          onChange={() => setOrderType('normal')}
                          className="mr-3"
                        />
                        <span className="text-lg">일반 주문</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={orderType === 'sample'}
                          onChange={() => setOrderType('sample')}
                          className="mr-3"
                        />
                        <span className="text-lg">샘플 주문</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* 주문 정보 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <button
                  onClick={() => toggleSection('orderInfo')}
                  className="w-full bg-gray-50 p-4 flex items-center justify-between text-left rounded-t-lg"
                >
                  <span className="font-medium text-lg">주문 정보</span>
                  {expandedSections.orderInfo ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                
                {expandedSections.orderInfo && (
                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">주문자 *</label>
                        <input
                          type="text"
                          value={formData.orderInfo.name}
                          onChange={(e) => handleOrderInfoUpdate('name', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3"
                          placeholder="이름을 입력하세요"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">휴대폰 *</label>
                        <input
                          type="tel"
                          value={formData.orderInfo.phone}
                          onChange={(e) => handleOrderInfoUpdate('phone', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3"
                          placeholder="010-0000-0000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">이메일</label>
                      <input
                        type="email"
                        value={formData.orderInfo.email}
                        onChange={(e) => updateOrderInfo('email', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3"
                        placeholder="example@email.com"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 배송지 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <button
                  onClick={() => toggleSection('shipping')}
                  className="w-full bg-gray-50 p-4 flex items-center justify-between text-left"
                >
                  <span className="font-medium text-lg">배송지</span>
                  {expandedSections.shipping ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                
                {expandedSections.shipping && (
                  <div className="p-6 space-y-4">
                    <div className="flex items-center space-x-6">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={formData.useSameAddress}
                          onChange={() => handleUseSameAddressToggle(true)}
                          className="mr-2"
                        />
                        주문자 정보와 동일
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={!formData.useSameAddress}
                          onChange={() => handleUseSameAddressToggle(false)}
                          className="mr-2"
                        />
                        새로운 배송지 등록
                      </label>
                    </div>

                    {/* 저장된 배송지 목록 */}
                    {!formData.useSameAddress && shippingAddresses.length > 0 && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium">저장된 배송지</label>
                        <div className="grid gap-3">
                          {shippingAddresses.map((address) => (
                            <div
                              key={address.id}
                              onClick={() => selectShippingAddress(address)}
                              className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3">
                                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <span className="font-medium">{address.name}</span>
                                      {address.is_default && (
                                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">기본</span>
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
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">받는사람 *</label>
                        <input
                          type="text"
                          value={formData.shippingInfo.name}
                          onChange={(e) => updateShippingInfo('name', e.target.value)}
                          disabled={formData.useSameAddress}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 disabled:bg-gray-100"
                          placeholder="받는 분 이름"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">휴대폰 *</label>
                        <input
                          type="tel"
                          value={formData.shippingInfo.phone}
                          onChange={(e) => updateShippingInfo('phone', e.target.value)}
                          disabled={formData.useSameAddress}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 disabled:bg-gray-100"
                          placeholder="010-0000-0000"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">우편번호 *</label>
                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={formData.shippingInfo.postalCode}
                            onChange={(e) => updateShippingInfo('postalCode', e.target.value)}
                            disabled={formData.useSameAddress}
                            className="w-40 border border-gray-300 rounded-lg px-4 py-3 disabled:bg-gray-100 text-center"
                            placeholder="우편번호"
                            readOnly
                          />
                          {!formData.useSameAddress && (
                            <AddressSearch
                              onAddressSelect={handleAddressSelect}
                              buttonText="주소검색"
                              className="h-[52px] px-4 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium border-0"
                            />
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">주소 *</label>
                        <input
                          type="text"
                          value={formData.shippingInfo.address}
                          onChange={(e) => updateShippingInfo('address', e.target.value)}
                          disabled={formData.useSameAddress}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 disabled:bg-gray-100"
                          placeholder="상세주소를 입력하세요"
                        />
                      </div>
                    </div>

                    {/* 배송 메모 */}
                    <div className="space-y-3">
                      <label className="block text-sm font-medium">배송 메모</label>
                      <select
                        value={selectedMemoOption}
                        onChange={(e) => setSelectedMemoOption(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3"
                      >
                        <option value="">-- 메시지 선택 (선택사항) --</option>
                        {memoOptions.map((option, index) => (
                          <option key={index} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>

                      {selectedMemoOption === '직접 입력' && (
                        <textarea
                          value={customMemo}
                          onChange={(e) => setCustomMemo(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-4 py-3 h-24 resize-none"
                          placeholder="배송 메모를 입력해주세요."
                        />
                      )}
                    </div>

                    <div className="text-sm text-gray-600 bg-blue-50 p-4 rounded-lg">
                      {orderType === 'sample' ? (
                        <>
                          <p className="font-medium text-blue-800 mb-2">📸 촬영용 샘플 주문 안내</p>
                          <ul className="space-y-1 text-sm">
                            <li>• 촬영용 샘플은 무료로 제공됩니다.</li>
                            <li>• 출고일 기준 <strong>21일 내</strong> 반납해주세요.</li>
                            <li>• 21일 초과 시 자동으로 상품 가격이 청구됩니다.</li>
                            <li>• 샘플 주문은 무료배송으로 제공됩니다.</li>
                          </ul>
                        </>
                      ) : (
                        <div className="text-sm text-gray-600">
                          <p className="font-medium text-gray-800 mb-2">🚚 배송 안내</p>
                          <ul className="space-y-1">
                            <li>• 모든 주문에 배송비 3,000원이 적용됩니다.</li>
                            <li>• 주문 확인 후 1-2일 내 배송 준비가 완료됩니다.</li>
                            <li>• 배송 시작 시 문자로 송장번호를 안내드립니다.</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 주문상품 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <button
                  onClick={() => toggleSection('products')}
                  className="w-full bg-gray-50 p-4 flex items-center justify-between text-left"
                >
                  <span className="font-medium text-lg">주문상품</span>
                  {expandedSections.products ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                
                {expandedSections.products && (
                  <div className="p-6">
                    {orderItems.map((item, index) => (
                      <div key={index} className="flex items-center space-x-4 py-4 border-b last:border-b-0">
                        <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0">
                          {/* 상품 이미지 자리 */}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-lg">{item.productName}</h4>
                          <p className="text-sm text-gray-600">{item.productCode}</p>
                          <p className="text-sm text-gray-600">수량: {item.quantity}개</p>
                          {item.options && (
                            <p className="text-sm text-gray-600">
                              {item.options.color && `색상: ${item.options.color}`}
                              {item.options.color && item.options.size && ' / '}
                              {item.options.size && `사이즈: ${item.options.size}`}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-lg">{formatCurrency(item.totalPrice)}</p>
                          <p className="text-sm text-gray-600">개당 {formatCurrency(item.unitPrice)}</p>
                          {orderType === 'sample' && item.originalPrice && item.unitPrice !== item.originalPrice && (
                            <p className="text-xs text-gray-400 line-through">
                              원가: {formatCurrency(item.originalPrice)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 결제정보 */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <button
                  onClick={() => toggleSection('payment')}
                  className="w-full bg-gray-50 p-4 flex items-center justify-between text-left"
                >
                  <span className="font-medium text-lg">결제정보</span>
                  {expandedSections.payment ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
                
                {expandedSections.payment && (
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between text-lg">
                      <span>주문상품</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span>배송비 {orderType === 'sample' ? '(샘플 무료배송)' : '(기본 배송 중량)'}</span>
                      <span>{formatCurrency(shippingFee)}</span>
                    </div>
                    <div className="flex justify-between text-lg">
                      <span>할인/부가결제</span>
                      <span>₩0</span>
                    </div>
                    <hr className="my-4" />
                    <div className="flex justify-between font-bold text-xl">
                      <span>최종 결제 금액</span>
                      <span className="text-red-600">{formatCurrency(totalAmount)}</span>
                    </div>
                    
                    <div className="text-sm text-gray-500 bg-gray-50 p-4 rounded-lg mt-4">
                      <p className="font-medium">구매조건 확인 및 결제진행 동의</p>
                      <p className="mt-2">
                        주문 내용을 확인하였으며, 정보 제공 및 결제에 동의합니다.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 하단 버튼 */}
          <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/cart')}
                className="flex-1 h-12 text-lg"
              >
                장바구니로 돌아가기
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={isOrderLoading || isFormLoading}
                className="flex-1 h-12 bg-black text-white hover:bg-gray-800 text-lg font-semibold"
              >
                {isOrderLoading ? '주문 처리중...' : 
                  orderType === 'sample' ? 
                    `${formatCurrency(totalAmount)} 샘플 주문하기` : 
                    `${formatCurrency(totalAmount)} 주문하기`
                }
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
} 