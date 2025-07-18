'use client'

import { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronUp } from 'lucide-react'
import { useOrder, OrderItem, ShippingInfo } from '../model/use-order'
import { formatPhoneNumber } from '@/shared/lib/utils'

interface OrderModalProps {
  isOpen: boolean
  onClose: () => void
  cartItems: any[]
  userId: string
}

export const OrderModal = ({ isOpen, onClose, cartItems, userId }: OrderModalProps) => {
  const { createOrder, isLoading } = useOrder()
  
  // 주문자 정보
  const [orderInfo, setOrderInfo] = useState({
    name: '',
    phone: '',
    email: ''
  })

  // 배송지 정보
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    name: '',
    phone: '',
    address: '',
    postalCode: ''
  })

  // 배송지 선택 옵션
  const [useSameAddress, setUseSameAddress] = useState(true)

  // 주문 메모
  const [orderNotes, setOrderNotes] = useState('')

  // 섹션 접기/펼치기 상태
  const [expandedSections, setExpandedSections] = useState({
    orderInfo: true,
    shipping: true,
    products: true,
    payment: true,
    paymentMethod: true
  })



  // 주문 상품 정보 계산
  const orderItems: OrderItem[] = cartItems.map(item => ({
    productId: item.id,
    productName: item.name,
    productCode: item.code || '',
    quantity: item.quantity,
    unitPrice: item.price,
    totalPrice: item.price * item.quantity,
    color: item.color || "",
    size: item.size || "",    options: item.options
  }))

  const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0)
  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0)
  const shippingFee = totalQuantity >= 20 ? 0 : 3000 // 20장 이상 무료배송
  const totalAmount = subtotal + shippingFee

  // 주문자 정보와 배송지 동기화
  useEffect(() => {
    if (useSameAddress) {
      setShippingInfo({
        name: orderInfo.name,
        phone: orderInfo.phone,
        address: '',
        postalCode: ''
      })
    }
  }, [useSameAddress, orderInfo.name, orderInfo.phone])

  // 섹션 토글
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // 주문 생성
  const handleSubmit = async () => {
    try {
      // 필수 정보 검증
      if (!orderInfo.name || !orderInfo.phone) {
        alert('주문자 정보를 입력해주세요.')
        return
      }

      if (!shippingInfo.name || !shippingInfo.phone || !shippingInfo.address || !shippingInfo.postalCode) {
        alert('배송지 정보를 입력해주세요.')
        return
      }

      const orderData = {
        userId,
        items: orderItems,
        shippingInfo,
        totalAmount,
        shippingFee,
        notes: orderNotes || undefined
      }

      await createOrder(orderData)
      onClose()
    } catch (error) {
      console.error('주문 생성 실패:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="bg-gray-800 text-white p-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">주문/결제</h2>
          <button onClick={onClose} className="text-white hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 주문 정보 */}
          <div className="border border-gray-200">
            <button
              onClick={() => toggleSection('orderInfo')}
              className="w-full bg-gray-50 p-4 flex items-center justify-between text-left"
            >
              <span className="font-medium">주문 정보</span>
              {expandedSections.orderInfo ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {expandedSections.orderInfo && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">주문자 *</label>
                    <input
                      type="text"
                      value={orderInfo.name}
                      onChange={(e) => setOrderInfo(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="이름을 입력하세요"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">전화번호 *</label>
                    <input
                      type="tel"
                      value={orderInfo.phone}
                      onChange={(e) => setOrderInfo(prev => ({ ...prev, phone: formatPhoneNumber(e.target.value) }))}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="전화번호 (숫자만 입력)"
                      maxLength={13}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">이메일</label>
                  <input
                    type="email"
                    value={orderInfo.email}
                    onChange={(e) => setOrderInfo(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="example@email.com"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 배송지 */}
          <div className="border border-gray-200">
            <button
              onClick={() => toggleSection('shipping')}
              className="w-full bg-gray-50 p-4 flex items-center justify-between text-left"
            >
              <span className="font-medium">배송지</span>
              {expandedSections.shipping ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {expandedSections.shipping && (
              <div className="p-4 space-y-4">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={useSameAddress}
                      onChange={() => setUseSameAddress(true)}
                      className="mr-2"
                    />
                    주문자 정보와 동일
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      checked={!useSameAddress}
                      onChange={() => setUseSameAddress(false)}
                      className="mr-2"
                    />
                    새로운 배송지 등록
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">받는사람 *</label>
                    <input
                      type="text"
                      value={shippingInfo.name}
                      onChange={(e) => setShippingInfo(prev => ({ ...prev, name: e.target.value }))}
                      disabled={useSameAddress}
                      className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
                      placeholder="받는 분 이름"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">전화번호 *</label>
                    <input
                      type="tel"
                      value={shippingInfo.phone}
                      onChange={(e) => setShippingInfo(prev => ({ ...prev, phone: formatPhoneNumber(e.target.value) }))}
                      disabled={useSameAddress}
                      className="w-full border border-gray-300 rounded px-3 py-2 disabled:bg-gray-100"
                      placeholder="전화번호 (숫자만 입력)"
                      maxLength={13}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-sm font-medium mb-1">우편번호 *</label>
                    <input
                      type="text"
                      value={shippingInfo.postalCode}
                      onChange={(e) => setShippingInfo(prev => ({ ...prev, postalCode: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="우편번호"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">주소 *</label>
                    <input
                      type="text"
                      value={shippingInfo.address}
                      onChange={(e) => setShippingInfo(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="상세주소를 입력하세요"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 주문상품 */}
          <div className="border border-gray-200">
            <button
              onClick={() => toggleSection('products')}
              className="w-full bg-gray-50 p-4 flex items-center justify-between text-left"
            >
              <span className="font-medium">주문상품</span>
              {expandedSections.products ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {expandedSections.products && (
              <div className="p-4">
                {orderItems.map((item, index) => (
                  <div key={index} className="flex items-center space-x-4 py-3 border-b last:border-b-0">
                    <div className="w-16 h-16 bg-gray-200 rounded flex-shrink-0">
                      {/* 상품 이미지 자리 */}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{item.productName}</h4>
                      <p className="text-sm text-gray-600">{item.productCode}</p>
                      <p className="text-sm text-gray-600">수량: {item.quantity}개</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{item.totalPrice.toLocaleString()}원</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 결제정보 */}
          <div className="border border-gray-200">
            <button
              onClick={() => toggleSection('payment')}
              className="w-full bg-gray-50 p-4 flex items-center justify-between text-left"
            >
              <span className="font-medium">결제정보</span>
              {expandedSections.payment ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {expandedSections.payment && (
              <div className="p-4 space-y-3">
                <div className="flex justify-between">
                  <span>주문상품</span>
                  <span>{subtotal.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between">
                  <span>배송비 {totalQuantity >= 20 ? '(20장 이상 무료)' : '(기본 배송)'}</span>
                  <span className={totalQuantity >= 20 ? 'text-green-600 font-bold' : ''}>
                    {shippingFee.toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>할인/부가결제</span>
                  <span>0원</span>
                </div>
                <hr />
                <div className="flex justify-between font-bold text-lg">
                  <span>최종 결제 금액</span>
                  <span className="text-red-600">{totalAmount.toLocaleString()}원</span>
                </div>
              </div>
            )}
          </div>

          {/* 결제수단 */}
          <div className="border border-gray-200">
            <button
              onClick={() => toggleSection('paymentMethod')}
              className="w-full bg-gray-50 p-4 flex items-center justify-between text-left"
            >
              <span className="font-medium">결제수단</span>
              {expandedSections.paymentMethod ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            
            {expandedSections.paymentMethod && (
              <div className="p-4 space-y-4">
                <div className="text-center text-blue-600 bg-blue-50 p-3 rounded">
                  사업자 등록증 인증을 완료하시면 다양한 결제 수단을 이용하실 수 있습니다.
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">입금계좌 *</label>
                  <select className="w-full border border-gray-300 rounded px-3 py-2">
                    <option>--- 계좌를 선택해 주세요 ---</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">입금자명 *</label>
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="실제 입금 시 사용할 예금주명을 적어주세요."
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="save-account" />
                  <label htmlFor="save-account" className="text-sm">입금계좌로 다음 결제시 자동 선택</label>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">배송 메모</label>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 h-20 resize-none"
                    placeholder="기타 요청 사항을 입력해 주세요."
                  />
                </div>

                <div className="text-xs text-gray-500">
                  <p>구매조건 확인 및 결제진행 동의</p>
                  <p className="mt-2">
                    주문 내용을 확인 및 결제진행에 동의합니다.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="bg-gray-800 p-4">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full bg-gray-800 text-white py-3 rounded font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {isLoading ? '주문 처리중...' : `${totalAmount.toLocaleString()}원 결제하기`}
          </button>
        </div>
      </div>
    </div>
  )
} 