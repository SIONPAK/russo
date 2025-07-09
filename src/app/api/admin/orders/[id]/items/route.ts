import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// 주문 아이템 수정 (수량 변경)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orderItemId, quantity, shipped_quantity } = await request.json()
    const resolvedParams = await params
    const orderId = resolvedParams.id

    if (!orderItemId) {
      return NextResponse.json({ error: '주문 아이템 ID가 필요합니다.' }, { status: 400 })
    }

    // quantity 또는 shipped_quantity 중 적어도 하나는 있어야 함
    if (quantity === undefined && shipped_quantity === undefined) {
      return NextResponse.json({ error: '수량 또는 출고 수량이 필요합니다.' }, { status: 400 })
    }

    const supabase = await createClient()

    // 현재 아이템 정보 조회 (총액 계산용)
    const { data: currentItem, error: currentItemError } = await supabase
      .from('order_items')
      .select('quantity, unit_price')
      .eq('id', orderItemId)
      .single()

    if (currentItemError) {
      console.error('현재 아이템 조회 오류:', currentItemError)
      return NextResponse.json({ error: '아이템 정보 조회에 실패했습니다.' }, { status: 500 })
    }

    // 주문 아이템 수정
    const updateData: any = {}

    // quantity가 제공된 경우 업데이트 및 총액 재계산
    if (quantity !== undefined) {
      updateData.quantity = quantity
      updateData.total_price = quantity * currentItem.unit_price
    }

    // shipped_quantity가 제공된 경우 업데이트
    if (shipped_quantity !== undefined) {
      updateData.shipped_quantity = shipped_quantity
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from('order_items')
      .update(updateData)
      .eq('id', orderItemId)
      .eq('order_id', orderId)
      .select()
      .single()

    if (updateError) {
      console.error('주문 아이템 수정 오류:', updateError)
      return NextResponse.json({ error: '주문 아이템 수정에 실패했습니다.' }, { status: 500 })
    }

    // quantity가 변경된 경우에만 주문 총액 재계산
    if (quantity !== undefined) {
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('total_price')
        .eq('order_id', orderId)

      if (itemsError) {
        console.error('주문 아이템 조회 오류:', itemsError)
        return NextResponse.json({ error: '주문 총액 계산에 실패했습니다.' }, { status: 500 })
      }

      const newTotalAmount = orderItems?.reduce((sum, item) => sum + item.total_price, 0) || 0

      // 주문 총액 업데이트
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          total_amount: newTotalAmount
        })
        .eq('id', orderId)

      if (orderUpdateError) {
        console.error('주문 총액 업데이트 오류:', orderUpdateError)
        return NextResponse.json({ error: '주문 총액 업데이트에 실패했습니다.' }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: '주문 아이템이 성공적으로 수정되었습니다.',
      data: {
        updatedItem
      }
    })

  } catch (error) {
    console.error('주문 아이템 수정 오류:', error)
    return NextResponse.json({ error: '주문 아이템 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

 