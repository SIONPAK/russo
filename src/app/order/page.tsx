'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { OrderPage } from '@/pages/order/order-page'
import { useCart } from '@/features/cart/model/use-cart'

export default function Order() {
  const searchParams = useSearchParams()
  const { cartItems } = useCart()
  const [mounted, setMounted] = useState(false)

  // URL 파라미터에서 주문 정보 추출
  const itemsParam = searchParams.get('items')
  const orderType = searchParams.get('orderType') as 'normal' | 'sample' || 'normal'
  const sampleType = searchParams.get('sampleType') as 'photography' | 'sales' || 'photography'

  // URL에서 전달된 상품 정보가 있으면 사용, 없으면 장바구니 데이터 사용
  let orderItems = cartItems
  
  if (itemsParam) {
    try {
      const decodedItems = JSON.parse(decodeURIComponent(itemsParam))
      orderItems = decodedItems.map((item: any) => ({
        productId: item.id,
        productName: item.name,
        productCode: item.code || '',
        unitPrice: item.price,
        quantity: item.quantity,
        color: item.color,
        size: item.size,
        options: {
          color: item.color,
          size: item.size
        }
      }))
    } catch (error) {
      console.error('URL 파라미터 파싱 오류:', error)
      // 파싱 실패 시 장바구니 데이터 사용
      orderItems = cartItems
    }
  }

  // 장바구니 데이터를 주문 페이지에 전달할 형태로 변환
  const finalOrderItems = orderItems.map(item => ({
    id: item.productId || item.id,
    name: item.productName || item.name,
    code: item.productCode || item.code || '',
    price: item.unitPrice || item.price,
    quantity: item.quantity,
    color: item.color,
    size: item.size,
    options: {
      color: item.color,
      size: item.size
    }
  }))

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <OrderPage 
      cartItems={finalOrderItems}
      orderType={orderType}
      sampleType={sampleType}
    />
  )
} 