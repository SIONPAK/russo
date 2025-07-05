import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// POST - 최종 명세서 확정 (마일리지 차감 + 거래명세서 생성)
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

    console.log('최종 명세서 확정 시작:', { orderIds })

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
    let orders, orderError

    try {
      const result = await supabase
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
            size,
            products!order_items_product_id_fkey (
              code
            )
          )
        `)
        .in('id', orderIds)
      
      orders = result.data
      orderError = result.error
    } catch (joinError) {
      console.log('조인 조회 실패, 개별 조회로 시도:', joinError)
      
      // 조인 실패 시 개별 조회
      const { data: basicOrders, error: basicError } = await supabase
        .from('orders')
        .select('*')
        .in('id', orderIds)

      if (basicError || !basicOrders) {
        return NextResponse.json({
          success: false,
          error: `기본 주문 조회 실패: ${basicError?.message}`
        }, { status: 500 })
      }

      // 각 주문에 대해 개별적으로 관련 데이터 조회
      orders = []
      for (const order of basicOrders) {
        // 사용자 정보 조회
        const { data: user } = await supabase
          .from('users')
          .select('id, company_name, mileage_balance')
          .eq('id', order.user_id)
          .single()

        // 주문 아이템 조회
        const { data: orderItems } = await supabase
          .from('order_items')
          .select(`
            id,
            product_name,
            quantity,
            shipped_quantity,
            unit_price,
            total_price,
            color,
            size,
            products!order_items_product_id_fkey (
              code
            )
          `)
          .eq('order_id', order.id)

        orders.push({
          ...order,
          users: user,
          order_items: orderItems || []
        })
      }
      orderError = null
    }

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

        // 실제 출고 금액 계산
        const shippedAmount = shippedItems.reduce((sum: number, item: any) => 
          sum + (item.unit_price * item.shipped_quantity), 0
        )

        // 1. 거래명세서 생성
        const statementNumber = `TXN-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${order.order_number}`
        
        const { data: statement, error: statementError } = await supabase
          .from('statements')
          .insert({
            statement_number: statementNumber,
            statement_type: 'transaction',
            user_id: order.user_id,
            order_id: order.id,
            total_amount: shippedAmount,
            reason: '최종 명세서 확정',
            notes: `실제 출고 금액: ${shippedAmount.toLocaleString()}원`,
            status: 'issued',
            created_at: new Date().toISOString()
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

        // 1-1. 출고명세서도 함께 생성
        const shippingStatementNumber = `SHP-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${order.order_number}`
        
        const { data: shippingStatement, error: shippingStatementError } = await supabase
          .from('statements')
          .insert({
            statement_number: shippingStatementNumber,
            statement_type: 'shipping',
            user_id: order.user_id,
            order_id: order.id,
            total_amount: shippedAmount,
            reason: '출고 확정',
            notes: `출고 수량: ${shippedItems.reduce((sum: number, item: any) => sum + item.shipped_quantity, 0)}개`,
            status: 'issued',
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (shippingStatementError) {
          console.error('출고명세서 생성 오류:', shippingStatementError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '출고명세서 생성 실패'
          })
          continue
        }

        // 2. 거래명세서 아이템들 생성
        const statementItems = shippedItems.map((item: any) => ({
          statement_id: statement.id,
          product_name: item.product_name,
          color: item.color,
          size: item.size,
          quantity: item.shipped_quantity,
          unit_price: item.unit_price,
          total_amount: item.unit_price * item.shipped_quantity
        }))

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

        // 2-1. 출고명세서 아이템들도 생성
        const shippingStatementItems = shippedItems.map((item: any) => ({
          statement_id: shippingStatement.id,
          product_name: item.product_name,
          color: item.color,
          size: item.size,
          quantity: item.shipped_quantity,
          unit_price: item.unit_price,
          total_amount: item.unit_price * item.shipped_quantity
        }))

        const { error: shippingItemsError } = await supabase
          .from('statement_items')
          .insert(shippingStatementItems)

        if (shippingItemsError) {
          console.error('출고명세서 아이템 생성 오류:', shippingItemsError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '출고명세서 아이템 생성 실패'
          })
          continue
        }

        // 3. 마일리지 차감 처리
        const currentMileage = order.users.mileage_balance || 0
        const newMileage = Math.max(0, currentMileage - shippedAmount)
        
        // 3-1. 먼저 마일리지 테이블에 차감 기록
        const { data: mileageRecord, error: mileageRecordError } = await supabase
          .from('mileage')
          .insert({
            user_id: order.user_id,
            amount: shippedAmount,
            type: 'spend',
            source: 'order',
            description: `최종 명세서 확정: ${order.order_number}`,
            status: 'completed',
            order_id: order.id
          })
          .select()
          .single()

        if (mileageRecordError) {
          console.error('마일리지 차감 기록 오류:', mileageRecordError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '마일리지 차감 기록 실패'
          })
          continue
        }

        // 3-2. 그 다음에 사용자 마일리지 잔액 업데이트
        const { error: mileageBalanceError } = await supabase
          .from('users')
          .update({ mileage_balance: newMileage })
          .eq('id', order.user_id)

        if (mileageBalanceError) {
          console.error('마일리지 잔액 업데이트 오류:', mileageBalanceError)
          
          // 롤백: 방금 추가한 마일리지 기록 삭제
          await supabase
            .from('mileage')
            .delete()
            .eq('id', mileageRecord.id)
          
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '마일리지 잔액 업데이트 실패'
          })
          continue
        }

        // 4. 주문 상태 업데이트 (명세서 확정됨)
        await supabase
          .from('orders')
          .update({ 
            status: 'confirmed',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id)

        results.push({
          orderId: order.id,
          orderNumber: order.order_number,
          success: true,
          statementNumber: statementNumber,
          shippingStatementNumber: shippingStatementNumber,
          shippedAmount: shippedAmount,
          mileageDeducted: shippedAmount,
          newMileage: newMileage
        })

        console.log('최종 명세서 확정 완료:', {
          orderNumber: order.order_number,
          statementNumber,
          shippingStatementNumber,
          shippedAmount,
          mileageDeducted: shippedAmount,
          newMileage
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
      message: `${successCount}개 주문의 최종 명세서가 확정되었습니다.`
    })

  } catch (error) {
    console.error('최종 명세서 확정 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '최종 명세서 확정 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 