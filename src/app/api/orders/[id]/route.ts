import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

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

    // 업무일 기준 당일 생성된 발주서만 수정/삭제 가능 (전일 15:00 ~ 당일 14:59)
    const now = new Date()
    const koreaTime = new Date(now.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }))
    const orderTime = new Date(order.created_at)
    const orderKoreaTime = new Date(orderTime.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }))
    
    // 현재 업무일의 시작 시간 계산 (전일 15:00)
    let workdayStart = new Date(koreaTime)
    if (koreaTime.getHours() < 15) {
      // 현재 시각이 15시 이전이면 전전일 15:00부터 시작
      workdayStart.setDate(workdayStart.getDate() - 2)
    } else {
      // 현재 시각이 15시 이후면 전일 15:00부터 시작
      workdayStart.setDate(workdayStart.getDate() - 1)
    }
    workdayStart.setHours(15, 0, 0, 0)
    
    // 현재 업무일의 종료 시간 계산 (당일 14:59)
    const workdayEnd = new Date(workdayStart)
    workdayEnd.setDate(workdayEnd.getDate() + 1)
    workdayEnd.setHours(14, 59, 59, 999)
    
    // 주문이 현재 업무일 범위에 있는지 확인
    const isCurrentWorkday = orderKoreaTime >= workdayStart && orderKoreaTime <= workdayEnd
    
    if (!isCurrentWorkday) {
      return NextResponse.json({
        success: false,
        error: `당일 생성된 발주서만 삭제할 수 있습니다. (업무일 기준: ${workdayStart.toLocaleDateString('ko-KR')} 15:00 ~ ${workdayEnd.toLocaleDateString('ko-KR')} 14:59)`
      }, { status: 400 })
    }
    
    // 현재 업무일의 삭제 마감시간 (당일 14:59)
    const deleteCutoffTime = new Date(workdayEnd)
    
    console.log('🕐 업무일 기준 시간 확인:', {
      currentTime: koreaTime.toLocaleString('ko-KR'),
      orderTime: orderKoreaTime.toLocaleString('ko-KR'),
      workdayStart: workdayStart.toLocaleString('ko-KR'),
      workdayEnd: workdayEnd.toLocaleString('ko-KR'),
      isCurrentWorkday,
      canDelete: koreaTime <= deleteCutoffTime
    })
    
    if (koreaTime > deleteCutoffTime) {
      return NextResponse.json({
        success: false,
        error: `업무일 기준 오후 3시 이후에는 발주서를 삭제할 수 없습니다. (현재 시각: ${koreaTime.toLocaleString('ko-KR')})`
      }, { status: 400 })
    }

    // 주문 아이템 조회 (재고 복원용)
    const { data: orderItems, error: itemsQueryError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id)

    if (itemsQueryError) {
      return NextResponse.json({
        success: false,
        error: '주문 아이템 조회에 실패했습니다.'
      }, { status: 500 })
    }

    // 할당된 재고 복원 (RPC 사용)
    for (const item of orderItems || []) {
      if (item.product_id && item.shipped_quantity && item.shipped_quantity > 0) {
        try {
          console.log('🔄 [발주 취소] 재고 복원 시작:', {
            productId: item.product_id,
            color: item.color,
            size: item.size,
            restoreQuantity: item.shipped_quantity
          })

          // RPC를 사용해서 재고 복원
          const { error: restoreError } = await supabase
            .rpc('adjust_physical_stock', {
              p_product_id: item.product_id,
              p_color: item.color,
              p_size: item.size,
              p_quantity_change: item.shipped_quantity, // 양수로 복원
              p_reason: `발주 취소로 인한 재고 복원 (주문번호: ${order.order_number})`
            })

          if (restoreError) {
            console.error('재고 복원 실패:', restoreError)
          } else {
            console.log('✅ [발주 취소] 재고 복원 완료:', {
              productId: item.product_id,
              color: item.color,
              size: item.size,
              restoreQuantity: item.shipped_quantity
            })
          }

        } catch (restoreError) {
          console.error('재고 복원 오류:', restoreError)
          // 재고 복원 실패해도 주문 삭제는 진행
        }
      }
    }

    // 관련 반품명세서 삭제
    const { error: returnStatementError } = await supabase
      .from('return_statements')
      .delete()
      .eq('order_id', id)

    if (returnStatementError) {
      // 반품명세서 삭제 실패해도 주문 삭제는 진행
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