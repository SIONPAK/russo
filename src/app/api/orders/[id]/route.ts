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

    // 💡 올바른 삭제 시간 제한 로직
    const now = new Date()
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const orderTime = new Date(order.created_at)
    const orderKoreaTime = new Date(orderTime.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    
    // 당일 15:00 기준점 계산
    const todayThreePM = new Date(koreaTime)
    todayThreePM.setHours(15, 0, 0, 0)
    
    // 전일 15:00 계산
    const yesterdayThreePM = new Date(todayThreePM)
    yesterdayThreePM.setDate(yesterdayThreePM.getDate() - 1)
    
    console.log('🕐 발주서 삭제 시간 확인:', {
      currentTime: koreaTime.toLocaleString('ko-KR'),
      orderTime: orderKoreaTime.toLocaleString('ko-KR'),
      todayThreePM: todayThreePM.toLocaleString('ko-KR'),
      yesterdayThreePM: yesterdayThreePM.toLocaleString('ko-KR')
    })
    
    // 케이스 1: 당일 15:00 이후에 생성된 주문 → 언제든 삭제 가능
    if (orderKoreaTime >= todayThreePM) {
      console.log('✅ 당일 15:00 이후 생성된 주문 → 삭제 가능')
      // 삭제 가능, 추가 검사 없음
    }
    // 케이스 2: 전일 15:00 ~ 당일 14:59 범위의 주문 → 당일 14:59까지만 삭제 가능
    else if (orderKoreaTime >= yesterdayThreePM) {
      console.log('📅 전일 15:00 ~ 당일 14:59 범위 주문 → 시간 제한 확인')
      
      const deleteCutoffTime = new Date(todayThreePM)
      deleteCutoffTime.setMinutes(-1) // 14:59
      
      if (koreaTime > deleteCutoffTime) {
        return NextResponse.json({
          success: false,
          error: `전일 업무시간(15:00~14:59) 주문은 당일 14:59까지만 삭제 가능합니다. (현재 시각: ${koreaTime.toLocaleString('ko-KR')})`
        }, { status: 400 })
      }
    }
    // 케이스 3: 그 이전 주문 → 삭제 불가
    else {
      return NextResponse.json({
        success: false,
        error: `해당 발주서는 삭제 기간이 지났습니다. (주문 시각: ${orderKoreaTime.toLocaleString('ko-KR')})`
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
      if (item.product_id) {
        try {
          // 출고된 수량 복원 (shipped_quantity > 0인 경우)
          if (item.shipped_quantity && item.shipped_quantity > 0) {
            console.log('🔄 [발주 취소] 출고 재고 복원 시작:', {
              productId: item.product_id,
              color: item.color,
              size: item.size,
              restoreQuantity: item.shipped_quantity
            })

            const { error: restoreError } = await supabase
              .rpc('adjust_physical_stock', {
                p_product_id: item.product_id,
                p_color: item.color,
                p_size: item.size,
                p_quantity_change: item.shipped_quantity, // 양수로 복원
                p_reason: `발주 취소로 인한 출고 재고 복원 (주문번호: ${order.order_number})`
              })

            if (restoreError) {
              console.error('출고 재고 복원 실패:', restoreError)
            } else {
              console.log('✅ [발주 취소] 출고 재고 복원 완료:', {
                productId: item.product_id,
                color: item.color,
                size: item.size,
                restoreQuantity: item.shipped_quantity
              })
            }
          }

          // 할당된 수량 해제 (allocated_quantity > 0인 경우)
          if (item.allocated_quantity && item.allocated_quantity > 0) {
            console.log('🔄 [발주 취소] 할당 해제 시작:', {
              productId: item.product_id,
              color: item.color,
              size: item.size,
              allocatedQuantity: item.allocated_quantity
            })

            // 할당된 수량만큼 allocated_stock에서 차감
            const { error: deallocateError } = await supabase
              .rpc('deallocate_stock', {
                p_product_id: item.product_id,
                p_color: item.color,
                p_size: item.size,
                p_quantity: item.allocated_quantity,
                p_reason: `발주 취소로 인한 할당 해제 (주문번호: ${order.order_number})`
              })

            if (deallocateError) {
              console.error('할당 해제 실패:', deallocateError)
            } else {
              console.log('✅ [발주 취소] 할당 해제 완료:', {
                productId: item.product_id,
                color: item.color,
                size: item.size,
                allocatedQuantity: item.allocated_quantity
              })
            }
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