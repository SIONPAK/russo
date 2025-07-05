import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { orderIds } = body

    // 권한 확인 제거 - 일반 클라이언트 사용

    // 선택된 주문들을 시간순으로 정렬하여 가져오기
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        users!inner(company_name, customer_grade),
        order_items(
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
      .order('created_at', { ascending: true })

    if (ordersError) {
      console.error('Orders fetch error:', ordersError)
      return NextResponse.json({ 
        success: false, 
        error: '주문 정보를 가져올 수 없습니다.' 
      }, { status: 500 })
    }

    let allocatedCount = 0
    let partialCount = 0
    let failedCount = 0
    const allocationResults = []

    // 각 주문에 대해 시간순차적으로 재고 할당
    for (const order of orders) {
      try {
        const orderResult = {
          orderId: order.id,
          orderNumber: order.order_number,
          companyName: (order.users as any)?.company_name,
          items: []
        }

        let orderFullyAllocated = true

        // 주문 아이템별 재고 할당
        for (const item of order.order_items) {
          // 현재 재고 조회
          const { data: inventory, error: inventoryError } = await supabase
            .from('inventory')
            .select('quantity, reserved_quantity')
            .eq('product_id', item.product_id)
            .eq('color', item.color)
            .eq('size', item.size)
            .single()

          if (inventoryError || !inventory) {
            // 재고 정보가 없는 경우
            (orderResult.items as any).push({
              itemId: item.id,
              productName: item.product_name,
              color: item.color,
              size: item.size,
              requested: item.quantity,
              allocated: 0,
              shortage: item.quantity,
              status: 'no_inventory'
            })
            orderFullyAllocated = false
            continue
          }

          const availableStock = inventory.quantity - inventory.reserved_quantity
          const requestedQuantity = item.quantity - (item.shipped_quantity || 0)
          const allocatedQuantity = Math.min(availableStock, requestedQuantity)
          const shortage = requestedQuantity - allocatedQuantity

          if (allocatedQuantity > 0) {
            // 재고 할당 (reserved_quantity 증가)
            const { error: updateError } = await supabase
              .from('inventory')
              .update({ 
                reserved_quantity: inventory.reserved_quantity + allocatedQuantity 
              })
              .eq('product_id', item.product_id)
              .eq('color', item.color)
              .eq('size', item.size)

            if (updateError) {
              console.error('Inventory update error:', updateError)
              continue
            }

            // 주문 아이템의 allocated_quantity 업데이트 (새 컬럼 필요)
            await supabase
              .from('order_items')
              .update({ 
                allocated_quantity: allocatedQuantity 
              })
              .eq('id', item.id)
          }

          (orderResult.items as any).push({
            itemId: item.id,
            productName: item.product_name,
            color: item.color,
            size: item.size,
            requested: requestedQuantity,
            allocated: allocatedQuantity,
            shortage: shortage,
            status: shortage === 0 ? 'fully_allocated' : allocatedQuantity > 0 ? 'partial_allocated' : 'no_allocation'
          })

          if (shortage > 0) {
            orderFullyAllocated = false
          }
        }

        if (orderFullyAllocated) {
          allocatedCount++
        } else if ((orderResult.items as any).some((item: any) => item.allocated > 0)) {
          partialCount++
        } else {
          failedCount++
        }

        allocationResults.push(orderResult)

      } catch (error) {
        console.error(`Order ${order.id} allocation error:`, error)
        failedCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `재고 할당 완료: 전량할당 ${allocatedCount}건, 부분할당 ${partialCount}건, 할당불가 ${failedCount}건`,
      data: {
        totalProcessed: orders.length,
        fullyAllocated: allocatedCount,
        partiallyAllocated: partialCount,
        failed: failedCount,
        results: allocationResults
      }
    })

  } catch (error) {
    console.error('Inventory allocation error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '재고 할당 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 