import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    
    const { action, reason } = body

    if (!action || !['cancel', 'exchange', 'return'].includes(action)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 액션입니다.'
      }, { status: 400 })
    }

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

    // 액션별 처리
    switch (action) {
      case 'cancel':
        // 취소 가능 상태 확인 (배송 준비 전)
        if (!['pending', 'confirmed'].includes(order.status)) {
          return NextResponse.json({
            success: false,
            error: '취소할 수 없는 주문 상태입니다.'
          }, { status: 400 })
        }

        // 주문 상태를 취소로 변경
        const { error: cancelError } = await supabase
          .from('orders')
          .update({ 
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', id)

        if (cancelError) {
          return NextResponse.json({
            success: false,
            error: '주문 취소 처리에 실패했습니다.'
          }, { status: 500 })
        }

        // 취소 이력 기록
        await supabase
          .from('order_actions')
          .insert({
            order_id: id,
            action_type: 'cancel',
            reason: reason || '고객 요청',
            created_at: new Date().toISOString()
          })

        break

      case 'exchange':
      case 'return':
        // 교환/반품 가능 상태 확인 (배송 완료 후)
        if (order.status !== 'delivered') {
          return NextResponse.json({
            success: false,
            error: '교환/반품은 배송 완료 후에만 가능합니다.'
          }, { status: 400 })
        }

        if (!reason) {
          return NextResponse.json({
            success: false,
            error: '교환/반품 사유를 입력해주세요.'
          }, { status: 400 })
        }

        // 교환/반품 요청 기록
        const { error: requestError } = await supabase
          .from('order_actions')
          .insert({
            order_id: id,
            action_type: action,
            reason: reason,
            status: 'pending', // 관리자 승인 대기
            created_at: new Date().toISOString()
          })

        if (requestError) {
          return NextResponse.json({
            success: false,
            error: `${action === 'exchange' ? '교환' : '반품'} 신청 처리에 실패했습니다.`
          }, { status: 500 })
        }

        break
    }

    return NextResponse.json({
      success: true,
      message: 
        action === 'cancel' ? '주문이 취소되었습니다.' :
        action === 'exchange' ? '교환 신청이 접수되었습니다.' :
        '반품 신청이 접수되었습니다.'
    })

  } catch (error) {
    console.error('Order action error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
