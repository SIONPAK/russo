import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

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

    const results = []
    let processedCount = 0

    for (const orderId of orderIds) {
      try {
        // 주문 정보 조회
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            user_id,
            total_amount,
            shipping_fee,
            created_at,
            users!orders_user_id_fkey (
              company_name,
              representative_name,
              email,
              phone
            ),
            order_items (
              id,
              product_id,
              product_name,
              color,
              size,
              quantity,
              shipped_quantity,
              unit_price,
              total_price
            )
          `)
          .eq('id', orderId)
          .single()

        if (orderError || !order) {
          results.push({
            orderId,
            success: false,
            error: '주문을 찾을 수 없습니다.'
          })
          continue
        }

        // 미출고 아이템만 필터링
        const unshippedItems = order.order_items.filter((item: any) => 
          (item.shipped_quantity || 0) < item.quantity
        )

        if (unshippedItems.length === 0) {
          results.push({
            orderId,
            success: false,
            error: '미출고 아이템이 없습니다.'
          })
          continue
        }

        // 미출고 명세서 생성
        const timestamp = Date.now()
        const unshippedStatementNumber = `UNSHIPPED-${order.order_number}-${timestamp}`
        
        const { data: unshippedStatement, error: statementError } = await supabase
          .from('unshipped_statements')
          .insert({
            statement_number: unshippedStatementNumber,
            order_id: orderId,
            user_id: order.user_id,
            total_unshipped_amount: unshippedItems.reduce((sum: number, item: any) => 
              sum + (item.unit_price * (item.quantity - (item.shipped_quantity || 0))), 0
            ),
            status: 'pending',
            reason: '재고 부족으로 인한 미출고',
            created_at: getKoreaTime()
          })
          .select()
          .single()

        if (statementError || !unshippedStatement) {
          results.push({
            orderId,
            success: false,
            error: '미출고 명세서 생성에 실패했습니다.'
          })
          continue
        }

        // 미출고 아이템 등록
        const unshippedItemsData = unshippedItems.map((item: any) => ({
          unshipped_statement_id: unshippedStatement.id,
          order_item_id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          color: item.color,
          size: item.size,
          ordered_quantity: item.quantity,
          shipped_quantity: item.shipped_quantity || 0,
          unshipped_quantity: item.quantity - (item.shipped_quantity || 0),
          unit_price: item.unit_price,
          total_amount: item.unit_price * (item.quantity - (item.shipped_quantity || 0)),
          created_at: getKoreaTime()
        }))

        const { error: itemsError } = await supabase
          .from('unshipped_statement_items')
          .insert(unshippedItemsData)

        if (itemsError) {
          results.push({
            orderId,
            success: false,
            error: '미출고 아이템 등록에 실패했습니다.'
          })
          continue
        }

        // 주문 상태를 'processing'으로 업데이트 (미출고 처리 완료)
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'processing',
            unshipped_processed_at: getKoreaTime()
          })
          .eq('id', orderId)

        if (updateError) {
          results.push({
            orderId,
            success: false,
            error: '주문 상태 업데이트에 실패했습니다.'
          })
          continue
        }

        results.push({
          orderId,
          orderNumber: order.order_number,
          success: true,
          unshippedStatementId: unshippedStatement.id,
          unshippedItemsCount: unshippedItems.length
        })

        processedCount++

      } catch (error) {
        console.error(`주문 ${orderId} 처리 중 오류:`, error)
        results.push({
          orderId,
          success: false,
          error: '처리 중 오류가 발생했습니다.'
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processedCount,
        totalCount: orderIds.length,
        results
      }
    })

  } catch (error) {
    console.error('일괄 미출고 처리 오류:', error)
    return NextResponse.json({
      success: false,
      error: '일괄 미출고 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 