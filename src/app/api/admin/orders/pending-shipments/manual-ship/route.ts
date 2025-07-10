import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { shipmentId, quantity } = body

    // 권한 확인 제거 - 일반 클라이언트 사용

    if (!shipmentId || !quantity || quantity <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: '올바른 출고 정보를 입력해주세요.' 
      }, { status: 400 })
    }

    // shipmentId에서 실제 order_item_id 추출 (pending_${item.id}_${index} 형식)
    const orderItemId = shipmentId.split('_')[1]

    if (!orderItemId) {
      return NextResponse.json({ 
        success: false, 
        error: '유효하지 않은 미출고 ID입니다.' 
      }, { status: 400 })
    }

    // 주문 상품 정보 조회
    const { data: orderItem, error: itemError } = await supabase
      .from('order_items')
      .select('*')
      .eq('id', orderItemId)
      .single()

    if (itemError || !orderItem) {
      return NextResponse.json({ 
        success: false, 
        error: '주문 상품을 찾을 수 없습니다.' 
      }, { status: 404 })
    }

    const currentShipped = orderItem.shipped_quantity || 0
    const pendingQuantity = orderItem.quantity - currentShipped

    if (quantity > pendingQuantity) {
      return NextResponse.json({ 
        success: false, 
        error: `출고 가능 수량(${pendingQuantity}개)을 초과했습니다.` 
      }, { status: 400 })
    }

    // 출고 수량 업데이트
    const newShippedQuantity = currentShipped + quantity
    const { error: updateError } = await supabase
      .from('order_items')
      .update({ 
        shipped_quantity: newShippedQuantity,
        updated_at: getKoreaTime()
      })
      .eq('id', orderItemId)

    if (updateError) {
      console.error('Manual ship update error:', updateError)
      return NextResponse.json({ 
        success: false, 
        error: '출고 처리 중 오류가 발생했습니다.' 
      }, { status: 500 })
    }

    // 🎯 물리적 재고 차감 (실제 출고 처리)
    const { data: stockResult, error: stockError } = await supabase
      .rpc('adjust_physical_stock', {
        p_product_id: orderItem.product_id,
        p_color: orderItem.color,
        p_size: orderItem.size,
        p_quantity_change: -quantity, // 음수로 차감
        p_reason: `미출고 수동 처리 - 주문번호: ${orderItem.order_id}`
      })

    if (stockError) {
      console.error('물리적 재고 차감 실패:', stockError)
      // 재고 차감 실패 시 출고 수량 롤백
      await supabase
        .from('order_items')
        .update({ 
          shipped_quantity: currentShipped,
          updated_at: getKoreaTime()
        })
        .eq('id', orderItemId)
      
      return NextResponse.json({ 
        success: false, 
        error: '재고 차감에 실패했습니다.' 
      }, { status: 500 })
    }

    console.log(`✅ 물리적 재고 차감 완료: ${orderItem.product_name} (${orderItem.color}/${orderItem.size}) ${quantity}개`)

    // 재고 변동 이력 기록
    const movementData = {
      product_id: orderItem.product_id,
      movement_type: 'order_shipment',
      quantity: -quantity, // 출고는 음수
      notes: `미출고 수동 처리`,
      reference_id: orderItem.order_id,
      reference_type: 'order',
      created_at: getKoreaTime()
    }
    
    console.log('재고 변동 이력 기록 시도:', movementData)
    
    const { data: movementResult, error: movementError } = await supabase
      .from('stock_movements')
      .insert(movementData)
      .select()
    
    if (movementError) {
      console.error('재고 변동 이력 기록 실패:', movementError)
    } else {
      console.log('재고 변동 이력 기록 성공:', movementResult)
    }

    // 주문 상태 업데이트 (모든 상품이 출고되었는지 확인)
    const { data: allItems } = await supabase
      .from('order_items')
      .select('quantity, shipped_quantity')
      .eq('order_id', orderItem.order_id)

    const allShipped = allItems?.every(item => 
      (item.shipped_quantity || 0) >= item.quantity
    )

    if (allShipped) {
      // 전량 출고 완료 - 주문 상태를 'shipped'로 변경
      await supabase
        .from('orders')
        .update({ 
          status: 'shipped',
          shipped_at: getKoreaTime()
        })
        .eq('id', orderItem.order_id)
    } else {
      // 부분 출고 - 주문 상태를 'partial_shipped'로 변경
      await supabase
        .from('orders')
        .update({ 
          status: 'partial_shipped',
          shipped_at: getKoreaTime()
        })
        .eq('id', orderItem.order_id)
    }

    // 로그 기록
    console.log(`Manual ship completed: ${quantity} units for order item ${orderItemId}`)

    return NextResponse.json({
      success: true,
      message: `${quantity}개 수동 출고가 완료되었습니다.`,
      data: {
        shipped: quantity,
        newShippedQuantity,
        remainingQuantity: orderItem.quantity - newShippedQuantity,
        allShipped
      }
    })

  } catch (error) {
    console.error('Manual ship error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '수동 출고 처리 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 