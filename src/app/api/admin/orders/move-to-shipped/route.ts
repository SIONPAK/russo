import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { orderIds } = await request.json()

    if (!orderIds || orderIds.length === 0) {
      return NextResponse.json({ error: '주문 ID가 필요합니다.' }, { status: 400 })
    }

    const supabase = await createClient()

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