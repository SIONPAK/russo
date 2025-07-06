import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { randomUUID } from 'crypto'

// 발주서 수정
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params
    const supabase = await createClient()

    const body = await request.json()
    const { items, shipping_address_id, shipping_address, shipping_postal_code, shipping_name, shipping_phone } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: '발주 상품이 없습니다.' }, { status: 400 })
    }

    // 기존 주문 확인
    const { data: existingOrder, error: orderCheckError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderCheckError || !existingOrder) {
      return NextResponse.json({ success: false, message: '발주서를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 기존 주문 상품 조회 (재고 이력 복원용)
    const { data: existingItems, error: existingItemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)

    if (existingItemsError) {
      console.error('기존 주문 상품 조회 오류:', existingItemsError)
      return NextResponse.json({ success: false, message: '기존 주문 상품 조회에 실패했습니다.' }, { status: 500 })
    }

    // 총 금액 계산
    const totalAmount = items.reduce((sum: number, item: any) => {
      const supplyAmount = item.unit_price * item.quantity
      const vat = Math.floor(supplyAmount * 0.1)
      return sum + supplyAmount + vat
    }, 0)

    // 주문 업데이트
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        total_amount: totalAmount,
        shipping_address: shipping_address,
        shipping_postal_code: shipping_postal_code,
        shipping_name: shipping_name,
        shipping_phone: shipping_phone
      })
      .eq('id', orderId)

    if (orderUpdateError) {
      console.error('주문 업데이트 오류:', orderUpdateError)
      return NextResponse.json({ success: false, message: '주문 업데이트에 실패했습니다.' }, { status: 500 })
    }

    // 기존 재고 이력 복원 (기존 발주 취소)
    if (existingItems) {
      for (const item of existingItems) {
        if (item.product_id && item.quantity !== 0) {
          // 기존 발주량을 반대로 적용하여 재고 복원
          const adjustmentQuantity = -item.quantity
          const adjustmentType = item.quantity > 0 ? 'outbound' : 'inbound'
          
          await supabase
            .from('inventory_history')
            .insert({
              id: randomUUID(),
              product_id: item.product_id,
              quantity: adjustmentQuantity,
              type: adjustmentType,
              reason: `발주 수정 - 기존 발주 취소 (${existingOrder.order_number})`,
              reference_id: orderId,
              reference_type: 'order_update_cancel'
            })
        }
      }
    }

    // 기존 주문 상품 삭제
    const { error: deleteItemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId)

    if (deleteItemsError) {
      console.error('기존 주문 상품 삭제 오류:', deleteItemsError)
      return NextResponse.json({ success: false, message: '기존 주문 상품 삭제에 실패했습니다.' }, { status: 500 })
    }

    // 새로운 주문 상품 생성
    const orderItems = items.map((item: any) => ({
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.product_name,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.unit_price * item.quantity
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('주문 상품 생성 오류:', itemsError)
      return NextResponse.json({ success: false, message: '주문 상품 생성에 실패했습니다.' }, { status: 500 })
    }

    // 새로운 재고 이력 생성
    for (const item of items) {
      if (item.product_id && item.quantity !== 0) {
        const adjustmentType = item.quantity > 0 ? 'outbound' : 'inbound'
        const adjustmentQuantity = item.quantity
        
        await supabase
          .from('inventory_history')
          .insert({
            id: randomUUID(),
            product_id: item.product_id,
            quantity: adjustmentQuantity,
            type: adjustmentType,
            reason: `발주 수정 - 새 발주 적용 (${existingOrder.order_number})`,
            reference_id: orderId,
            reference_type: 'order_update_new'
          })
      }
    }

    return NextResponse.json({ success: true, message: '발주서가 수정되었습니다.' })
  } catch (error) {
    console.error('발주서 수정 오류:', error)
    return NextResponse.json({ success: false, message: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
} 