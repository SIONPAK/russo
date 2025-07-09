import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    
    const { items } = body

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({
        success: false,
        error: '아이템 정보가 필요합니다.'
      }, { status: 400 })
    }

    // 반품명세서 존재 확인 및 주문 ID 조회
    const { data: statement, error: statementError } = await supabase
      .from('return_statements')
      .select('id, status, order_id')
      .eq('id', id)
      .single()

    if (statementError || !statement) {
      return NextResponse.json({
        success: false,
        error: '반품명세서를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 총 금액 계산 (부가세 포함)
    const totalAmount = items.reduce((sum, item) => {
      const quantity = item.return_quantity || item.quantity || 0
      const unitPrice = item.unit_price || 0
      const supplyAmount = quantity * unitPrice
      const vat = Math.floor(supplyAmount * 0.1)
      return sum + supplyAmount + vat
    }, 0)

    // 반품명세서 아이템 및 총 금액 업데이트
    const { error: updateError } = await supabase
      .from('return_statements')
      .update({
        items: items,
        total_amount: totalAmount,
        refund_amount: totalAmount,
        updated_at: getKoreaTime()
      })
      .eq('id', id)

    if (updateError) {
      console.error('Update items error:', updateError)
      return NextResponse.json({
        success: false,
        error: '아이템 업데이트에 실패했습니다.'
      }, { status: 500 })
    }

    // 원본 주문의 총 금액도 업데이트
    if (statement.order_id) {
      try {
        // 원본 주문의 양수 아이템들(정상 발주) 총액 계산
        const { data: orderItems, error: orderItemsError } = await supabase
          .from('order_items')
          .select('quantity, unit_price')
          .eq('order_id', statement.order_id)

        if (!orderItemsError && orderItems) {
          const positiveAmount = orderItems.reduce((sum, item) => {
            const supplyAmount = item.quantity * item.unit_price
            const vat = Math.floor(supplyAmount * 0.1)
            return sum + supplyAmount + vat
          }, 0)

          // 최종 총액 = 양수 아이템 총액 - 반품 총액
          const finalTotalAmount = positiveAmount - totalAmount

          // 주문 총액 업데이트
          await supabase
            .from('orders')
            .update({
              total_amount: finalTotalAmount,
              updated_at: getKoreaTime()
            })
            .eq('id', statement.order_id)

          console.log(`주문 ID ${statement.order_id} 총액 업데이트: ${finalTotalAmount}원 (양수: ${positiveAmount}원, 반품: ${totalAmount}원)`)
        }
      } catch (orderUpdateError) {
        console.error('원본 주문 총액 업데이트 오류:', orderUpdateError)
        // 원본 주문 업데이트 실패해도 반품명세서 업데이트는 성공으로 처리
      }
    }

    // 업데이트된 반품명세서 정보 조회
    const { data: updatedStatement, error: fetchError } = await supabase
      .from('return_statements')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('Updated statement fetch error:', fetchError)
      return NextResponse.json({
        success: false,
        error: '업데이트된 정보 조회에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '반품 아이템이 성공적으로 업데이트되었습니다.',
      data: updatedStatement
    })

  } catch (error) {
    console.error('Update return statement items API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 