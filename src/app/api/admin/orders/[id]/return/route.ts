import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// POST - 반품 처리
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { items, reason, notes } = await request.json()

    // 주문 정보 조회
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          id,
          company_name,
          representative_name,
          phone,
          email,
          address,
          business_number
        ),
        order_items!order_items_order_id_fkey (
          id,
          product_name,
          product_code,
          color,
          size,
          quantity,
          unit_price,
          shipped_quantity
        )
      `)
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({
        success: false,
        error: '주문을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 반품 처리할 상품들 검증
    const returnItems = items.filter((item: any) => item.return_quantity > 0)
    
    if (returnItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: '반품할 상품이 없습니다.'
      }, { status: 400 })
    }

    // 반품명세서 자동 생성
    const statement = await generateReturnStatement(supabase, order, returnItems, reason, notes)

    // 각 상품별 반품 처리
    for (const item of returnItems) {
      const orderItem = order.order_items.find((oi: any) => oi.id === item.order_item_id)
      if (!orderItem) continue

      // 반품 수량만큼 출고 수량에서 차감
      const newShippedQuantity = Math.max(0, (orderItem.shipped_quantity || 0) - item.return_quantity)
      
      await supabase
        .from('order_items')
        .update({ 
          shipped_quantity: newShippedQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.order_item_id)

      // 재고 복구 (선택사항)
      if (item.restore_inventory) {
        // 현재 재고 조회
        const { data: inventory } = await supabase
          .from('inventory')
          .select('quantity')
          .eq('product_id', orderItem.product_id)
          .eq('color', orderItem.color)
          .eq('size', orderItem.size)
          .single()

        if (inventory) {
          await supabase
            .from('inventory')
            .update({
              quantity: inventory.quantity + item.return_quantity
            })
            .eq('product_id', orderItem.product_id)
            .eq('color', orderItem.color)
            .eq('size', orderItem.size)
        }
      }
    }

    // 주문 상태 업데이트 (부분 반품 또는 전체 반품)
    const totalReturned = returnItems.reduce((sum: number, item: any) => sum + item.return_quantity, 0)
    const totalShipped = order.order_items.reduce((sum: number, item: any) => sum + (item.shipped_quantity || 0), 0)
    
    let newStatus = order.status
    if (totalReturned >= totalShipped) {
      newStatus = 'returned' // 전체 반품
    } else if (totalReturned > 0) {
      newStatus = 'partial_returned' // 부분 반품
    }

    await supabase
      .from('orders')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      message: '반품 처리가 완료되었습니다.',
      data: {
        statement_number: statement?.statement_number,
        returned_items: returnItems.length,
        total_returned: totalReturned,
        order_status: newStatus
      }
    })

  } catch (error) {
    console.error('반품 처리 오류:', error)
    return NextResponse.json({
      success: false,
      error: '반품 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 반품명세서 자동 생성 함수
async function generateReturnStatement(
  supabase: any, 
  order: any, 
  returnItems: any[], 
  reason: string, 
  notes?: string
) {
  try {
    // 반품명세서 번호 생성
    const statementNumber = `RO-${Date.now()}-${order.order_number}`

    // 총 반품 금액 계산
    const totalAmount = returnItems.reduce((sum: number, item: any) => {
      const orderItem = order.order_items.find((oi: any) => oi.id === item.order_item_id)
      return sum + (orderItem ? orderItem.unit_price * item.return_quantity : 0)
    }, 0)

    // 반품명세서 생성
    const { data: statement, error: statementError } = await supabase
      .from('statements')
      .insert({
        statement_number: statementNumber,
        statement_type: 'return',
        user_id: order.user_id,
        order_id: order.id,
        total_amount: totalAmount,
        reason: reason,
        notes: notes,
        status: 'issued',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (statementError) {
      console.error('반품명세서 생성 오류:', statementError)
      return null
    }

    // 반품명세서 아이템들 생성
    const statementItems = returnItems.map((item: any) => {
      const orderItem = order.order_items.find((oi: any) => oi.id === item.order_item_id)
      const totalAmount = orderItem.unit_price * item.return_quantity
      
      return {
        statement_id: statement.id,
        product_name: orderItem.product_name,
        color: orderItem.color,
        size: orderItem.size,
        quantity: item.return_quantity,
        unit_price: orderItem.unit_price,
        total_amount: totalAmount
      }
    })

    const { error: itemsError } = await supabase
      .from('statement_items')
      .insert(statementItems)

    if (itemsError) {
      console.error('반품명세서 아이템 생성 오류:', itemsError)
      return null
    }

    console.log(`반품명세서 생성 완료: ${statementNumber}`)
    return statement

  } catch (error) {
    console.error('반품명세서 자동 생성 오류:', error)
    return null
  }
} 