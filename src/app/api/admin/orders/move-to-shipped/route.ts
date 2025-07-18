import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { orderIds } = await request.json()

    if (!orderIds || orderIds.length === 0) {
      return NextResponse.json({ error: '주문 ID가 필요합니다.' }, { status: 400 })
    }

    const supabase = await createClient()

    // 🎯 출고 처리 전 주문 상세 정보 조회 (물리적 재고 차감을 위해)
    const { data: ordersWithItems, error: orderFetchError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        order_items (
          id,
          product_id,
          product_name,
          color,
          size,
          quantity,
          shipped_quantity
        )
      `)
      .in('id', orderIds)

    if (orderFetchError) {
      console.error('주문 정보 조회 오류:', orderFetchError)
      return NextResponse.json({ error: '주문 정보 조회에 실패했습니다.' }, { status: 500 })
    }

    // 🎯 물리적 재고 차감 처리
    for (const order of ordersWithItems || []) {
      for (const item of order.order_items) {
        const shippedQuantity = item.shipped_quantity || 0
        
        if (shippedQuantity > 0) {
          const { data: stockResult, error: stockError } = await supabase
            .rpc('adjust_physical_stock', {
              p_product_id: item.product_id,
              p_color: item.color,
              p_size: item.size,
              p_quantity_change: -shippedQuantity, // 음수로 차감
              p_reason: `출고 처리 - 주문번호: ${order.order_number}`
            })

          if (stockError) {
            console.error('물리적 재고 차감 실패:', stockError)
            // 재고 차감 실패해도 주문은 출고 처리 계속 진행
          } else {
            console.log(`✅ 물리적 재고 차감 완료: ${item.product_name} (${item.color}/${item.size}) ${shippedQuantity}개`)
          }
        }
      }
    }

    // 주문 상태를 shipped로 변경하고 shipped_at 시간을 현재 시간으로 설정
    const { data: updatedOrders, error } = await supabase
      .from('orders')
      .update({
        status: 'shipped',
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in('id', orderIds)
      .select('id, order_number, status')

    if (error) {
      console.error('주문 상태 업데이트 오류:', error)
      return NextResponse.json({ error: '주문 상태 업데이트에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${orderIds.length}건의 주문이 출고 처리되었습니다.`,
      data: {
        updated: updatedOrders?.length || 0,
        orders: updatedOrders
      }
    })

  } catch (error) {
    console.error('출고 처리 오류:', error)
    return NextResponse.json({ error: '출고 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
} 