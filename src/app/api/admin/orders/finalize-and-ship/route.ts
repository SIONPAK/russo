import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime, getKoreaDateFormatted } from '@/shared/lib/utils'

// POST - 최종 처리 (명세서 확정 + 마일리지 차감 + 출고 처리)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { orderIds } = await request.json()

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '주문 ID가 필요합니다.'
      }, { status: 400 })
    }

    console.log('최종 처리 시작:', { orderIds })

    // 먼저 주문이 존재하는지 간단히 확인
    const { data: simpleOrders, error: simpleError } = await supabase
      .from('orders')
      .select('id, order_number, user_id')
      .in('id', orderIds)

    console.log('간단 주문 조회 결과:', { simpleOrders, simpleError })

    if (simpleError) {
      console.error('간단 주문 조회 오류:', simpleError)
      return NextResponse.json({
        success: false,
        error: `주문 조회 오류: ${simpleError.message}`
      }, { status: 500 })
    }

    if (!simpleOrders || simpleOrders.length === 0) {
      return NextResponse.json({
        success: false,
        error: `주문을 찾을 수 없습니다. 요청된 ID: ${orderIds.join(', ')}`
      }, { status: 404 })
    }

    // 주문 정보 상세 조회
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          id,
          company_name,
          mileage_balance
        ),
        order_items!order_items_order_id_fkey (
          id,
          product_name,
          quantity,
          shipped_quantity,
          unit_price,
          total_price,
          color,
          size
        )
      `)
      .in('id', orderIds)

    console.log('상세 주문 조회 결과:', { 
      ordersCount: orders?.length, 
      orderError,
      firstOrder: orders?.[0] ? {
        id: orders[0].id,
        order_number: orders[0].order_number,
        hasUsers: !!orders[0].users,
        hasOrderItems: !!orders[0].order_items,
        orderItemsCount: orders[0].order_items?.length
      } : null
    })

    if (orderError) {
      console.error('상세 주문 조회 오류:', orderError)
      return NextResponse.json({
        success: false,
        error: `주문 상세 조회 오류: ${orderError.message}`
      }, { status: 500 })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: '주문 상세 정보를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    const results = []
    const currentTime = getKoreaTime()
    
    for (const order of orders) {
      try {
        // 실제 출고된 상품만 필터링
        const shippedItems = order.order_items.filter((item: any) => 
          item.shipped_quantity && item.shipped_quantity > 0
        )

        if (shippedItems.length === 0) {
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '출고된 상품이 없습니다.'
          })
          continue
        }

        // 실제 출고 수량 및 금액 계산
        const totalShippedQuantity = shippedItems.reduce((sum: number, item: any) => 
          sum + item.shipped_quantity, 0
        )
        const shippedAmount = shippedItems.reduce((sum: number, item: any) => 
          sum + (item.unit_price * item.shipped_quantity), 0
        )

        // 🔧 배송비 계산 (20장 미만일 때 3,000원)
        const shippingFee = totalShippedQuantity < 20 ? 3000 : 0
        const totalAmount = shippedAmount + shippingFee

        // 1. 거래명세서 생성
        const timestamp = Date.now()
        const statementNumber = `TXN-${getKoreaDateFormatted()}-${timestamp}-${order.order_number}`
        
        const { data: statement, error: statementError } = await supabase
          .from('statements')
          .insert({
            statement_number: statementNumber,
            statement_type: 'transaction',
            user_id: order.user_id,
            order_id: order.id,
            total_amount: totalAmount,
            reason: '최종 처리 (명세서 확정 + 출고)',
            notes: `실제 출고 금액: ${shippedAmount.toLocaleString()}원${shippingFee > 0 ? ` + 배송비: ${shippingFee.toLocaleString()}원` : ''}`,
            status: 'issued',
            created_at: currentTime
          })
          .select()
          .single()

        if (statementError) {
          console.error('거래명세서 생성 오류:', statementError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '거래명세서 생성 실패'
          })
          continue
        }

        // 2. 거래명세서 아이템들 생성
        const statementItems = [
          ...shippedItems.map((item: any) => ({
            statement_id: statement.id,
            product_name: item.product_name,
            color: item.color,
            size: item.size,
            quantity: item.shipped_quantity,
            unit_price: item.unit_price,
            total_amount: item.unit_price * item.shipped_quantity
          }))
        ]

        // 배송비가 있는 경우 아이템에 추가
        if (shippingFee > 0) {
          statementItems.push({
            statement_id: statement.id,
            product_name: '배송비',
            color: '-',
            size: '-',
            quantity: 1,
            unit_price: shippingFee,
            total_amount: shippingFee
          })
        }

        const { error: itemsError } = await supabase
          .from('statement_items')
          .insert(statementItems)

        if (itemsError) {
          console.error('거래명세서 아이템 생성 오류:', itemsError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '거래명세서 아이템 생성 실패'
          })
          continue
        }

        // 3. 마일리지 차감 처리
        const currentMileage = order.users.mileage_balance || 0
        const newMileage = Math.max(0, currentMileage - totalAmount)  // 배송비 포함된 총액으로 차감

        // 3-1. mileage 테이블에 차감 기록 생성
        const { error: mileageRecordError } = await supabase
          .from('mileage')
          .insert({
            user_id: order.user_id,
            amount: totalAmount, // 양수로 저장
            type: 'spend', // 차감 타입
            source: 'order', // 주문 결제
            description: `최종 처리 (명세서 확정 + 출고) - 주문번호: ${order.order_number}`,
            status: 'completed',
            order_id: order.id,
            created_at: currentTime
          })

        if (mileageRecordError) {
          console.error('마일리지 기록 생성 오류:', mileageRecordError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '마일리지 기록 생성 실패'
          })
          continue
        }

        // 3-2. 사용자 마일리지 잔액 업데이트
        const { error: mileageBalanceError } = await supabase
          .from('users')
          .update({ 
            mileage_balance: newMileage,
            updated_at: currentTime
          })
          .eq('id', order.user_id)

        if (mileageBalanceError) {
          console.error('마일리지 잔액 업데이트 오류:', mileageBalanceError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '마일리지 잔액 업데이트 실패'
          })
          continue
        }

        // 4. 주문 상태를 shipped로 업데이트 (출고완료)
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ 
            status: 'shipped',
            shipped_at: currentTime,
            updated_at: currentTime
          })
          .eq('id', order.id)

        if (orderUpdateError) {
          console.error('주문 상태 업데이트 오류:', orderUpdateError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '주문 상태 업데이트 실패'
          })
          continue
        }

        // 🎯 5. 물리적 재고 차감 (실제 출고 처리)
        for (const item of shippedItems) {
          const { data: stockResult, error: stockError } = await supabase
            .rpc('adjust_physical_stock', {
              p_product_id: item.product_id,
              p_color: item.color,
              p_size: item.size,
              p_quantity_change: -item.shipped_quantity, // 음수로 차감
              p_reason: `출고 완료 - 주문번호: ${order.order_number}`
            })

          if (stockError) {
            console.error('물리적 재고 차감 실패:', stockError)
            // 재고 차감 실패해도 주문은 출고 완료로 처리 (이미 명세서와 마일리지 처리됨)
          } else {
            console.log(`✅ 물리적 재고 차감 완료: ${item.product_name} (${item.color}/${item.size}) ${item.shipped_quantity}개`)
          }
        }

        results.push({
          orderId: order.id,
          orderNumber: order.order_number,
          success: true,
          statementNumber: statementNumber,
          shippedAmount: shippedAmount,
          mileageDeducted: totalAmount,
          newMileage: newMileage,
          orderStatus: 'shipped'
        })

        console.log('최종 처리 완료:', {
          orderNumber: order.order_number,
          statementNumber,
          shippedAmount,
          mileageDeducted: totalAmount,
          newMileage,
          orderStatus: 'shipped'
        })

      } catch (error) {
        console.error('주문 처리 오류:', error)
        results.push({
          orderId: order.id,
          orderNumber: order.order_number,
          success: false,
          error: '처리 중 오류 발생'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      data: {
        total: results.length,
        success: successCount,
        failed: failCount,
        results: results
      },
      message: `${successCount}개 주문이 최종 처리되었습니다. (명세서 확정 + 출고 완료)`
    })

  } catch (error) {
    console.error('최종 처리 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '최종 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 