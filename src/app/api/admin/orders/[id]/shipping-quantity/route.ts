import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// PUT - 출고 수량 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { items } = await request.json()

    console.log('=== 출고 수량 업데이트 시작 ===')
    console.log('주문 ID:', id)
    console.log('업데이트할 항목들:', items)

    // 주문 정보 조회 (주문 수량 확인용)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          quantity,
          shipped_quantity
        )
      `)
      .eq('id', id)
      .single()

    if (orderError) {
      console.error('주문 조회 오류:', orderError)
      return NextResponse.json({ success: false, error: '주문을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 각 주문 아이템의 출고 수량 업데이트
    const updatePromises = items.map(async (item: { id: string; shipped_quantity: number }) => {
      console.log(`아이템 ${item.id} 출고 수량을 ${item.shipped_quantity}로 업데이트 중...`)
      
      const { data, error } = await supabase
        .from('order_items')
        .update({ shipped_quantity: item.shipped_quantity })
        .eq('id', item.id)
        .select()

      if (error) {
        console.error(`아이템 ${item.id} 업데이트 오류:`, error)
        throw error
      }

      console.log(`아이템 ${item.id} 업데이트 완료:`, data)
      return data
    })

    const results = await Promise.all(updatePromises)
    console.log('모든 아이템 업데이트 완료:', results)

    // 전체 출고 수량 확인하여 주문 상태 업데이트
    const { data: updatedOrderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('quantity, shipped_quantity')
      .eq('order_id', id)

    if (itemsError) {
      console.error('업데이트된 아이템 조회 오류:', itemsError)
      return NextResponse.json({ success: false, error: '아이템 조회에 실패했습니다.' }, { status: 500 })
    }

    // 출고 상태 계산
    const totalQuantity = updatedOrderItems.reduce((sum, item) => sum + item.quantity, 0)
    const totalShipped = updatedOrderItems.reduce((sum, item) => sum + (item.shipped_quantity || 0), 0)

    console.log(`전체 수량: ${totalQuantity}, 전체 출고: ${totalShipped}`)

    let newStatus = 'confirmed'
    if (totalShipped > 0) {
      newStatus = totalShipped >= totalQuantity ? 'shipped' : 'preparing'
    }

    console.log(`주문 상태를 ${newStatus}로 변경`)

    // 주문 상태 업데이트
    const { error: statusError } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', id)

    if (statusError) {
      console.error('주문 상태 업데이트 오류:', statusError)
      return NextResponse.json({ success: false, error: '주문 상태 업데이트에 실패했습니다.' }, { status: 500 })
    }

    console.log('=== 출고 수량 업데이트 완료 ===')

    return NextResponse.json({
      success: true,
      message: '출고 수량이 성공적으로 업데이트되었습니다.',
      data: {
        updatedItems: results.length,
        orderStatus: newStatus
      }
    })

  } catch (error) {
    console.error('Shipping quantity update error:', error)
    return NextResponse.json({
      success: false,
      error: '출고 수량 업데이트에 실패했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}
