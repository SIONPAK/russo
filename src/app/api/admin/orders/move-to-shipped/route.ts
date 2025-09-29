import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { orderIds } = await request.json()

    if (!orderIds || orderIds.length === 0) {
      return NextResponse.json({ error: '주문 ID가 필요합니다.' }, { status: 400 })
    }

    const supabase = await createClient()

    // 🎯 출고 처리 전 주문 상세 정보 조회 (물리적 재고 차감을 위해)
    const { data: ordersWithItems, error: orderFetchError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        order_items (
          id,
          product_id,
          product_name,
          color,
          size,
          quantity,
          shipped_quantity
        )
      `)
      .in('id', orderIds)

    if (orderFetchError) {
      console.error('주문 정보 조회 오류:', orderFetchError)
      return NextResponse.json({ error: '주문 정보 조회에 실패했습니다.' }, { status: 500 })
    }

    // 🎯 출고 처리 (물리재고 차감 + allocated_stock 초기화 + 재할당)
    for (const order of ordersWithItems || []) {
      for (const item of order.order_items) {
        const shippedQuantity = item.shipped_quantity || 0
        
        if (shippedQuantity > 0) {
          const { data: stockResult, error: stockError } = await supabase
            .rpc('process_shipment', {
              p_product_id: item.product_id,
              p_color: item.color,
              p_size: item.size,
              p_shipped_quantity: shippedQuantity,
              p_order_number: order.order_number
            })

          if (stockError) {
            console.error('출고 처리 실패:', stockError)
            // 출고 처리 실패해도 주문은 출고 처리 계속 진행
          } else {
            console.log(`✅ 출고 처리 완료: ${item.product_name} (${item.color}/${item.size}) ${shippedQuantity}개`)
            console.log(`📊 재고 변동: ${stockResult.previous_physical_stock}개 → ${stockResult.new_physical_stock}개`)

            // 🔧 allocated_stock에서 출고 수량만큼 차감 (0으로 초기화가 아님)
            const { data: product, error: productError } = await supabase
              .from('products')
              .select('inventory_options')
              .eq('id', item.product_id)
              .single()

            if (!productError && product?.inventory_options) {
              let needsUpdate = false
              const updatedOptions = product.inventory_options.map((option: any) => {
                if (option.color === item.color && option.size === item.size) {
                  // 출고 수량만큼 allocated_stock에서 차감
                  const currentAllocated = option.allocated_stock || 0
                  const newAllocated = Math.max(0, currentAllocated - shippedQuantity)
                  
                  if (currentAllocated !== newAllocated) {
                    console.log(`🔧 allocated_stock 차감: ${item.product_name} (${item.color}/${item.size}) - ${currentAllocated} → ${newAllocated} (출고: ${shippedQuantity}개)`)
                    needsUpdate = true
                    return { ...option, allocated_stock: newAllocated }
                  }
                }
                return option
              })

              if (needsUpdate) {
                const { error: updateError } = await supabase
                  .from('products')
                  .update({ inventory_options: updatedOptions })
                  .eq('id', item.product_id)

                if (updateError) {
                  console.error('❌ allocated_stock 차감 실패:', updateError)
                } else {
                  console.log(`✅ allocated_stock 차감 완료: ${item.product_name} (${item.color}/${item.size})`)
                }
              }
            }
          }
        }
      }
    }

    // 주문 상태를 shipped로 변경하고 shipped_at 시간을 현재 시간으로 설정
    const { data: updatedOrders, error } = await supabase
      .from('orders')
      .update({
        status: 'shipped',
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .in('id', orderIds)
      .select('id, order_number, status')

    if (error) {
      console.error('주문 상태 업데이트 오류:', error)
      return NextResponse.json({ error: '주문 상태 업데이트에 실패했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${orderIds.length}건의 주문이 출고 처리되었습니다.`,
      data: {
        updated: updatedOrders?.length || 0,
        orders: updatedOrders
      }
    })

  } catch (error) {
    console.error('출고 처리 오류:', error)
    return NextResponse.json({ error: '출고 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
} 