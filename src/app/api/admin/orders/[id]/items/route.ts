import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// 주문 아이템 수정 (수량 변경)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { orderItemId, quantity } = await request.json()
    const resolvedParams = await params
    const orderId = resolvedParams.id

    if (!orderItemId) {
      return NextResponse.json({ error: '주문 아이템 ID가 필요합니다.' }, { status: 400 })
    }

    if (quantity === undefined) {
      return NextResponse.json({ error: '수량이 필요합니다.' }, { status: 400 })
    }

    const supabase = await createClient()

    // 현재 아이템 정보 조회 (재고 복구 계산용)
    const { data: currentItem, error: currentItemError } = await supabase
      .from('order_items')
      .select(`
        quantity, 
        unit_price, 
        shipped_quantity, 
        product_id,
        color,
        size,
        products (
          id,
          stock_quantity,
          inventory_options
        )
      `)
      .eq('id', orderItemId)
      .single()

    if (currentItemError) {
      console.error('현재 아이템 조회 오류:', currentItemError)
      return NextResponse.json({ error: '아이템 정보 조회에 실패했습니다.' }, { status: 500 })
    }

    const oldQuantity = currentItem.quantity
    const currentShippedQuantity = currentItem.shipped_quantity || 0
    const quantityDiff = quantity - oldQuantity

    // 새 수량이 기존 출고 수량보다 작으면 출고 수량을 새 수량으로 조정
    const newShippedQuantity = Math.min(currentShippedQuantity, quantity)
    const shippedQuantityDiff = newShippedQuantity - currentShippedQuantity

    // 주문 아이템 업데이트
    const updateData = {
      quantity: quantity,
      shipped_quantity: newShippedQuantity,
      total_price: quantity * currentItem.unit_price
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from('order_items')
      .update(updateData)
      .eq('id', orderItemId)
      .eq('order_id', orderId)
      .select()
      .single()

    if (updateError) {
      console.error('주문 아이템 수정 오류:', updateError)
      return NextResponse.json({ error: '주문 아이템 수정에 실패했습니다.' }, { status: 500 })
    }

    // 재고 조정 (출고 수량이 줄어들면 재고 복구)
    if (shippedQuantityDiff < 0) {
      const stockToRestore = Math.abs(shippedQuantityDiff)
      const product = currentItem.products as any
      
      if (product.inventory_options && Array.isArray(product.inventory_options)) {
        // 옵션별 재고 복구
        const updatedOptions = product.inventory_options.map((opt: any) => {
          if (opt.color === currentItem.color && opt.size === currentItem.size) {
            return { ...opt, stock_quantity: (opt.stock_quantity || 0) + stockToRestore }
          }
          return opt
        })
        
        const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)
        
        await supabase
          .from('products')
          .update({
            inventory_options: updatedOptions,
            stock_quantity: totalStock
          })
          .eq('id', currentItem.product_id)
      } else {
        // 전체 재고 복구
        await supabase
          .from('products')
          .update({
            stock_quantity: (product.stock_quantity || 0) + stockToRestore
          })
          .eq('id', currentItem.product_id)
      }

      // 재고 변동 이력 기록
      await supabase
        .from('stock_movements')
        .insert({
          product_id: currentItem.product_id,
          movement_type: 'order_quantity_adjustment',
          quantity: stockToRestore, // 복구는 양수
          color: currentItem.color,
          size: currentItem.size,
          notes: `주문 수량 조정으로 인한 재고 복구 (${oldQuantity} → ${quantity})`,
          reference_id: orderId,
          reference_type: 'order',
          created_at: new Date().toISOString()
        })
    }

    // 주문 총액 재계산
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('total_price')
      .eq('order_id', orderId)

    if (itemsError) {
      console.error('주문 아이템 조회 오류:', itemsError)
      return NextResponse.json({ error: '주문 총액 계산에 실패했습니다.' }, { status: 500 })
    }

    const newTotalAmount = orderItems?.reduce((sum, item) => sum + item.total_price, 0) || 0

    // 주문 총액 업데이트
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        total_amount: newTotalAmount
      })
      .eq('id', orderId)

    if (orderUpdateError) {
      console.error('주문 총액 업데이트 오류:', orderUpdateError)
      return NextResponse.json({ error: '주문 총액 업데이트에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '주문 아이템이 성공적으로 수정되었습니다.',
      data: {
        updatedItem
      }
    })

  } catch (error) {
    console.error('주문 아이템 수정 오류:', error)
    return NextResponse.json({ error: '주문 아이템 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

 