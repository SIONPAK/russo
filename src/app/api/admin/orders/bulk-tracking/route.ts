import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/shared/lib/supabase/server"

interface TrackingUpdateItem {
  orderNumber: string
  trackingNumber: string
  courier?: string
  notes?: string
}

interface SuccessResult {
  orderNumber: string
  trackingNumber: string
  courier?: string
}

interface FailedResult {
  orderNumber: string
  error: string
}

// POST /api/admin/orders/bulk-tracking - 운송장 번호 일괄 업데이트
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { trackingData } = body

    if (!trackingData || !Array.isArray(trackingData) || trackingData.length === 0) {
      return NextResponse.json({
        success: false,
        error: '업데이트할 운송장 데이터가 필요합니다.'
      }, { status: 400 })
    }

    let updatedCount = 0
    let errorCount = 0
    const errors: string[] = []

    // 각 운송장 데이터 처리
    for (const tracking of trackingData) {
      try {
        const { orderNumber, trackingNumber, courier, notes, receiverName, receiverPhone, receiverAddress, companyName, itemName, itemQuantity } = tracking

        if (!trackingNumber || !receiverName || !receiverPhone) {
          errorCount++
          errors.push(`필수 정보 누락: 운송장번호, 받는분 성명, 받는분 전화번호`)
          continue
        }

        // 배송지 정보로 주문 조회 (받는분 성명, 전화번호로 매칭)
        const { data: orders, error: orderError } = await supabase
          .from('orders')
          .select(`
            id, 
            status, 
            order_number, 
            shipping_name, 
            shipping_phone, 
            shipping_address,
            order_items (
              id,
              product_name,
              color,
              size,
              quantity
            )
          `)
          .eq('shipping_name', receiverName)
          .eq('shipping_phone', receiverPhone)
          .in('status', ['confirmed', 'allocated']) // 확정 또는 할당된 주문만
          .order('created_at', { ascending: false })

        if (orderError || !orders || orders.length === 0) {
          errorCount++
          errors.push(`주문을 찾을 수 없음: ${receiverName} (${receiverPhone})`)
          continue
        }

        // 내품명에서 상품명, 색상, 사이즈 파싱
        const uploadedItemName = itemName || companyName || '' // 엑셀에서 내품명 정보
        let matchedOrder = null

        // 여러 주문이 있을 경우 상품 정보로 매칭
        for (const order of orders) {
          if (order.order_items && order.order_items.length > 0) {
            // 상품 정보가 포함된 주문인지 확인
            const hasMatchingItem = order.order_items.some((item: any) => {
              const expectedItemName = `${item.product_name} (${item.color}/${item.size})`
              return uploadedItemName.includes(item.product_name) || 
                     uploadedItemName.includes(item.color) || 
                     uploadedItemName.includes(item.size) ||
                     expectedItemName === uploadedItemName
            })

            if (hasMatchingItem) {
              matchedOrder = order
              break
            }
          }
        }

        // 매칭되는 주문이 없으면 첫 번째 주문 사용
        if (!matchedOrder) {
          matchedOrder = orders[0]
        }

        // 운송장 번호 업데이트 및 배송중 상태로 변경
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            tracking_number: trackingNumber,
            status: 'shipped', // 배송중으로 상태 변경
            updated_at: new Date().toISOString()
          })
          .eq('id', matchedOrder.id)

        if (updateError) {
          errorCount++
          errors.push(`업데이트 실패: ${matchedOrder.order_number} - ${updateError.message}`)
          continue
        }

        // 거래명세서 자동 생성
        await generateTransactionStatement(supabase, matchedOrder)

        updatedCount++

        // 운송장 등록 로그
        console.log(`운송장 등록 완료: ${matchedOrder.order_number} -> ${trackingNumber}`)

      } catch (error) {
        errorCount++
        errors.push(`처리 중 오류: ${tracking.receiverName || 'unknown'} - ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total: trackingData.length,
        updated: updatedCount,
        errors: errorCount,
        errorDetails: errors
      },
      message: `${updatedCount}건 업데이트 완료, ${errorCount}건 실패`
    })

  } catch (error) {
    console.error('Bulk tracking update API error:', error)
    return NextResponse.json({
      success: false,
      error: '운송장 번호 업데이트 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 거래명세서 자동 생성 함수
async function generateTransactionStatement(supabase: any, order: any) {
  try {
    // 출고된 상품만 필터링
    const shippedItems = order.order_items.filter((item: any) => 
      item.shipped_quantity && item.shipped_quantity > 0
    )

    if (shippedItems.length === 0) {
      return // 출고된 상품이 없으면 생성하지 않음
    }

    // 거래명세서 번호 생성
    const statementNumber = `TXN-${Date.now()}-${order.order_number}`

    // 총 금액 계산 (출고된 상품 기준)
    const totalAmount = shippedItems.reduce((sum: number, item: any) => 
      sum + (item.unit_price * item.shipped_quantity), 0
    )

    // 거래명세서 생성
    const { data: statement, error: statementError } = await supabase
      .from('statements')
      .insert({
        statement_number: statementNumber,
        statement_type: 'transaction',
        user_id: order.user_id,
        order_id: order.id,
        total_amount: totalAmount,
        status: 'issued',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (statementError) {
      console.error('거래명세서 생성 오류:', statementError)
      return
    }

    // 거래명세서 아이템들 생성
    const statementItems = shippedItems.map((item: any) => {
      const totalAmount = item.unit_price * item.shipped_quantity
      
      return {
        statement_id: statement.id,
        product_name: item.product_name,
        color: item.color,
        size: item.size,
        quantity: item.shipped_quantity,
        unit_price: item.unit_price,
        total_amount: totalAmount
      }
    })

    const { error: itemsError } = await supabase
      .from('statement_items')
      .insert(statementItems)

    if (itemsError) {
      console.error('거래명세서 아이템 생성 오류:', itemsError)
      return
    }

    console.log(`거래명세서 생성 완료: ${statementNumber}`)

  } catch (error) {
    console.error('거래명세서 자동 생성 오류:', error)
  }
}
