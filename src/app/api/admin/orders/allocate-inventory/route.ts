import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// POST - 재고 할당 처리
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { orderIds } = await request.json()

    console.log('재고 할당 시작:', { orderIds })

    let allocatedCount = 0
    let insufficientStockCount = 0

    // 주문들을 시간순으로 정렬하여 처리 (오래된 주문부터)
    const { data: ordersToSort, error: sortError } = await supabase
      .from('orders')
      .select('id, created_at, order_number, users!orders_user_id_fkey(company_name)')
      .in('id', orderIds)
      .order('created_at', { ascending: true })

    if (sortError || !ordersToSort) {
      return NextResponse.json({
        success: false,
        error: '주문 정보를 조회할 수 없습니다.'
      }, { status: 500 })
    }

    console.log('시간순차적 재고 할당 시작:', ordersToSort.map((o: any) => ({
      id: o.id,
      orderNumber: o.order_number,
      company: o.users?.company_name,
      createdAt: o.created_at
    })))

    // 시간순차적으로 주문 처리 (오래된 주문부터)
    for (const order of ordersToSort) {
      const result = await allocateInventoryForOrder(supabase, order.id)
      
      if (result.success) {
        allocatedCount++
        console.log(`✅ 주문 ${order.order_number} (${order.users?.company_name}) 할당 완료`)
      } else if (result.reason === 'insufficient_stock') {
        insufficientStockCount++
        console.log(`❌ 주문 ${order.order_number} (${order.users?.company_name}) 재고 부족`)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        allocated: allocatedCount,
        insufficient_stock: insufficientStockCount,
        total_processed: orderIds.length
      }
    })

  } catch (error) {
    console.error('재고 할당 API 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '재고 할당 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}

// 개별 주문에 대한 재고 할당
async function allocateInventoryForOrder(supabase: any, orderId: string) {
  try {
    // 주문 정보와 아이템 조회
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_name,
          color,
          size,
          quantity,
          shipped_quantity,
          products (
            id,
            code,
            stock_quantity,
            inventory_options
          )
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('주문 조회 오류:', orderError)
      return { success: false, reason: 'order_not_found' }
    }

    let allItemsAllocated = true
    const allocationResults = []

    // 각 아이템에 대해 재고 할당 처리
    for (const item of order.order_items) {
      const allocationResult = await allocateItemInventory(supabase, item)
      allocationResults.push(allocationResult)
      
      if (!allocationResult.success) {
        allItemsAllocated = false
      }
    }

    // 주문 상태 업데이트
    let newStatus = order.status
    if (allItemsAllocated) {
      newStatus = 'confirmed' // 모든 재고 할당 완료
    } else {
      newStatus = 'pending' // 재고 부족으로 대기
    }

    await supabase
      .from('orders')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    console.log(`주문 ${orderId} 할당 완료:`, { 
      status: newStatus, 
      allocated: allItemsAllocated 
    })

    return {
      success: allItemsAllocated,
      reason: allItemsAllocated ? 'allocated' : 'insufficient_stock',
      results: allocationResults
    }

  } catch (error) {
    console.error('주문 할당 처리 오류:', error)
    return { success: false, reason: 'error' }
  }
}

// 개별 아이템 재고 할당
async function allocateItemInventory(supabase: any, item: any) {
  try {
    const product = item.products
    const requiredQuantity = item.quantity
    const alreadyShipped = item.shipped_quantity || 0
    const remainingQuantity = requiredQuantity - alreadyShipped

    if (remainingQuantity <= 0) {
      return { success: true, allocated: 0, reason: 'already_allocated' }
    }

    // 색상/사이즈별 재고 확인 (JSON 형태)
    let availableStock = 0
    let stockToAllocate = 0

    if (product.inventory_options && Array.isArray(product.inventory_options)) {
      const matchingOption = product.inventory_options.find((opt: any) => 
        opt.color === item.color && opt.size === item.size
      )

      if (matchingOption) {
        // 옵션별 재고
        availableStock = matchingOption.stock_quantity || 0
        stockToAllocate = Math.min(availableStock, remainingQuantity)

        if (stockToAllocate > 0) {
          // JSON 배열에서 해당 옵션의 재고 업데이트
          const updatedOptions = product.inventory_options.map((opt: any) => {
            if (opt.color === item.color && opt.size === item.size) {
              return { ...opt, stock_quantity: (opt.stock_quantity || 0) - stockToAllocate }
            }
            return opt
          })

          await supabase
            .from('products')
            .update({ inventory_options: updatedOptions })
            .eq('id', product.id)
        }
      } else {
        // 해당 색상/사이즈 옵션이 없는 경우 기본 재고 사용
        availableStock = product.stock_quantity || 0
        stockToAllocate = Math.min(availableStock, remainingQuantity)

        if (stockToAllocate > 0) {
          await supabase
            .from('products')
            .update({ 
              stock_quantity: availableStock - stockToAllocate 
            })
            .eq('id', product.id)
        }
      }
    } else {
      // inventory_options가 없는 경우 기본 재고 사용
      availableStock = product.stock_quantity || 0
      stockToAllocate = Math.min(availableStock, remainingQuantity)

      if (stockToAllocate > 0) {
        await supabase
          .from('products')
          .update({ 
            stock_quantity: availableStock - stockToAllocate 
          })
          .eq('id', product.id)
      }
    }

    // 출고 수량 업데이트
    if (stockToAllocate > 0) {
      await supabase
        .from('order_items')
        .update({ 
          shipped_quantity: alreadyShipped + stockToAllocate 
        })
        .eq('id', item.id)
    }

    console.log(`아이템 ${item.id} 할당:`, {
      required: remainingQuantity,
      available: availableStock,
      allocated: stockToAllocate
    })

    return {
      success: stockToAllocate === remainingQuantity,
      allocated: stockToAllocate,
      available: availableStock,
      required: remainingQuantity,
      reason: stockToAllocate === remainingQuantity ? 'allocated' : 'insufficient_stock'
    }

  } catch (error) {
    console.error('아이템 할당 오류:', error)
    return { success: false, reason: 'error' }
  }
} 