import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    console.log('🔄 [자동 할당] 미출고 주문 자동 할당 시작')

    // 1. 미출고 주문들 조회 (shipped_quantity < quantity)
    const { data: unshippedOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        order_items (
          id,
          product_id,
          color,
          size,
          quantity,
          shipped_quantity,
          product_name,
          products (
            id,
            inventory_options
          )
        )
      `)
      .in('status', ['pending', 'processing', 'confirmed'])
      .order('created_at', { ascending: true }) // 시간순 정렬

    if (ordersError) {
      console.error('❌ [자동 할당] 미출고 주문 조회 실패:', ordersError)
      return NextResponse.json({ 
        success: false, 
        error: '미출고 주문 조회에 실패했습니다.' 
      }, { status: 500 })
    }

    if (!unshippedOrders || unshippedOrders.length === 0) {
      console.log('📋 [자동 할당] 미출고 주문이 없습니다.')
      return NextResponse.json({ 
        success: true, 
        message: '미출고 주문이 없습니다.',
        data: { allocated: 0, total: 0 }
      })
    }

    // 2. 각 주문의 미출고 아이템들 확인 및 할당
    let allocatedCount = 0
    let totalProcessed = 0

    for (const order of unshippedOrders) {
      for (const item of order.order_items) {
        const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
        
        if (unshippedQuantity > 0) {
          totalProcessed++
          
          console.log(`🔍 [자동 할당] 미출고 아이템 확인:`, {
            orderNumber: order.order_number,
            productName: item.product_name,
            color: item.color,
            size: item.size,
            unshippedQuantity
          })

          // 가용 재고 확인
          const { data: availableStock, error: stockError } = await supabase
            .rpc('calculate_available_stock', {
              p_product_id: item.product_id,
              p_color: item.color,
              p_size: item.size
            })

          if (!stockError && availableStock > 0) {
            // 할당 가능한 수량 계산 (가용 재고와 미출고 수량 중 작은 값)
            const allocatableQuantity = Math.min(availableStock, unshippedQuantity)
            
            console.log(`✅ [자동 할당] 재고 할당 시작:`, {
              orderNumber: order.order_number,
              productName: item.product_name,
              color: item.color,
              size: item.size,
              unshippedQuantity,
              availableStock,
              allocatableQuantity
            })

            // 재고 할당
            const { data: allocationResult, error: allocationError } = await supabase
              .rpc('allocate_stock', {
                p_product_id: item.product_id,
                p_quantity: allocatableQuantity,
                p_color: item.color,
                p_size: item.size
              })

            if (!allocationError && allocationResult) {
              // 출고 수량 업데이트 (기존 출고수량 + 할당수량)
              const newShippedQuantity = (item.shipped_quantity || 0) + allocatableQuantity
              const { error: updateError } = await supabase
                .from('order_items')
                .update({
                  shipped_quantity: newShippedQuantity,
                  allocated_quantity: ((item as any).allocated_quantity || 0) + allocatableQuantity
                })
                .eq('id', item.id)

              if (!updateError) {
                allocatedCount++
                console.log(`✅ [자동 할당] 할당 완료:`, {
                  orderNumber: order.order_number,
                  productName: item.product_name,
                  color: item.color,
                  size: item.size,
                  allocatedQuantity: allocatableQuantity,
                  newShippedQuantity,
                  remainingUnshipped: unshippedQuantity - allocatableQuantity
                })
              } else {
                console.error(`❌ [자동 할당] 출고 수량 업데이트 실패:`, updateError)
              }
            } else {
              console.error(`❌ [자동 할당] 재고 할당 실패:`, allocationError)
            }
          } else {
            console.log(`⚠️ [자동 할당] 재고 부족:`, {
              orderNumber: order.order_number,
              productName: item.product_name,
              color: item.color,
              size: item.size,
              unshippedQuantity,
              availableStock: availableStock || 0
            })
          }
        }
      }
    }

    console.log(`✅ [자동 할당] 자동 할당 완료:`, {
      totalProcessed,
      allocatedCount,
      successRate: totalProcessed > 0 ? (allocatedCount / totalProcessed * 100).toFixed(1) + '%' : '0%'
    })

    return NextResponse.json({
      success: true,
      message: `${allocatedCount}건의 미출고 주문이 자동 할당되었습니다.`,
      data: {
        allocated: allocatedCount,
        total: totalProcessed,
        successRate: totalProcessed > 0 ? (allocatedCount / totalProcessed * 100).toFixed(1) + '%' : '0%'
      }
    })

  } catch (error) {
    console.error('❌ [자동 할당] 자동 할당 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '자동 할당 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 