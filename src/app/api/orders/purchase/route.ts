import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { userId, items, totalAmount, shippingInfo } = body

    // 사용자 ID 확인
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: '사용자 정보가 필요합니다.' 
      }, { status: 400 })
    }

    // 주문 번호 생성
    const orderNumber = `PO${Date.now()}`

    // 주문 생성 (배송지 정보를 개별 필드로 저장)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        order_number: orderNumber,
        total_amount: totalAmount,
        status: 'pending',
        order_type: 'normal',
        shipping_name: shippingInfo?.shipping_name || '',
        shipping_phone: shippingInfo?.shipping_phone || '',
        shipping_address: shippingInfo?.shipping_address || '',
        shipping_postal_code: shippingInfo?.shipping_postal_code || '',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (orderError) {
      console.error('Order creation error:', orderError)
      return NextResponse.json({ 
        success: false, 
        error: '발주서 저장에 실패했습니다.' 
      }, { status: 500 })
    }

    // 주문 아이템 생성
    const orderItems = items.map((item: any) => ({
      order_id: orderData.id,
      product_id: item.productId,
      product_name: item.productName,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.supplyAmount + item.vat,
      shipped_quantity: 0 // 초기 출고 수량은 0
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Order items creation error:', itemsError)
      // 주문도 롤백
      await supabase.from('orders').delete().eq('id', orderData.id)
      return NextResponse.json({ 
        success: false, 
        error: '발주서 아이템 저장에 실패했습니다.' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: orderData.id,
        orderNumber: orderData.order_number,
        message: '발주서가 성공적으로 저장되었습니다.'
      }
    })

  } catch (error) {
    console.error('Purchase order creation error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 