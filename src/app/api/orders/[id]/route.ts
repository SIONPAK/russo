import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 주문 정보 조회
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({
        success: false,
        error: '주문을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 오후 3시 이전인지 확인 (한국 시간)
    const now = new Date()
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
    const orderTime = new Date(order.created_at)
    const orderKoreaTime = new Date(orderTime.getTime() + (9 * 60 * 60 * 1000))
    
    // 주문일의 오후 3시 (한국 시간)
    const cutoffTime = new Date(orderKoreaTime)
    cutoffTime.setHours(15, 0, 0, 0)
    
    if (koreaTime >= cutoffTime) {
      return NextResponse.json({
        success: false,
        error: '오후 3시 이후에는 발주서를 삭제할 수 없습니다.'
      }, { status: 400 })
    }

    // 주문 상태 확인 (처리 중인 주문은 삭제 불가)
    if (order.status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: '처리 중인 주문은 삭제할 수 없습니다.'
      }, { status: 400 })
    }

    // 주문 아이템 삭제
    const { error: itemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', id)

    if (itemsError) {
      return NextResponse.json({
        success: false,
        error: '주문 아이템 삭제에 실패했습니다.'
      }, { status: 500 })
    }

    // 주문 삭제
    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({
        success: false,
        error: '주문 삭제에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '발주서가 삭제되었습니다.'
    })

  } catch (error) {
    console.error('Order delete error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 