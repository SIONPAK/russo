import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// ⚠️ 주의: 이 API는 더 이상 사용되지 않습니다.
// 주문 생성 시 자동으로 재고 할당이 처리됩니다.
// - 일반 주문: /api/orders (POST)
// - 발주 주문: /api/orders/purchase (POST)
// - 샘플 주문: /api/orders/sample (POST)

type OrderWithUser = {
  id: string
  order_number: string
  created_at: string
  users: {
    company_name: string
  }
}

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
      .select(`
        id,
        order_number,
        created_at,
        users:users!orders_user_id_fkey (
          company_name
        )
      `)
      .in('id', orderIds)
      .order('created_at', { ascending: true })

    if (sortError || !ordersToSort) {
      return NextResponse.json({
        success: false,
        error: '주문 정보를 조회할 수 없습니다.'
      }, { status: 500 })
    }

    console.log('시간순차적 재고 할당 시작:', (ordersToSort as unknown as OrderWithUser[]).map((o) => ({
      id: o.id,
      orderNumber: o.order_number,
      company: o.users?.company_name,
      createdAt: o.created_at
    })))

    // 시간순차적으로 주문 처리 (오래된 주문부터)
    for (const order of ordersToSort as unknown as OrderWithUser[]) {
      const result = await allocateInventoryForOrder(supabase, order.id)
      
      if (result.success) {
        allocatedCount++
        console.log(`✅ 주문 ${order.order_number} (${order.users?.company_name || '알 수 없음'}) 할당 완료`)
      } else if (result.reason === 'insufficient_stock') {
        insufficientStockCount++
        console.log(`❌ 주문 ${order.order_number} (${order.users?.company_name || '알 수 없음'}) 재고 부족`)
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
        updated_at: getKoreaTime()
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

    console.log(`🔍 아이템 재고 할당 시작:`, {
      productId: product.id,
      productName: item.product_name,
      color: item.color,
      size: item.size,
      required: remainingQuantity,
      currentInventoryOptions: product.inventory_options
    })

    let availableStock = 0
    let stockToAllocate = 0

    // inventory_options에서 해당 색상/사이즈의 재고 찾기
    if (product.inventory_options && Array.isArray(product.inventory_options)) {
      const matchingOption = product.inventory_options.find((opt: any) => 
        opt.color === item.color && opt.size === item.size
      )

      if (matchingOption) {
        availableStock = matchingOption.stock_quantity || 0
        stockToAllocate = Math.min(availableStock, remainingQuantity)

        console.log(`📦 옵션별 재고 확인:`, {
          color: item.color,
          size: item.size,
          availableStock,
          stockToAllocate
        })

        if (stockToAllocate > 0) {
          // 현재 상품 정보를 다시 조회하여 최신 재고 상태 확인
          const { data: currentProduct, error: fetchError } = await supabase
            .from('products')
            .select('inventory_options')
            .eq('id', product.id)
            .single()

          if (fetchError || !currentProduct) {
            console.error('상품 조회 실패:', fetchError)
            return { success: false, reason: 'product_fetch_error' }
          }

          // 최신 inventory_options에서 해당 옵션 찾기
          const currentOptions = currentProduct.inventory_options || []
          const currentOptionIndex = currentOptions.findIndex((opt: any) => 
            opt.color === item.color && opt.size === item.size
          )

          if (currentOptionIndex === -1) {
            console.error('해당 옵션을 찾을 수 없음:', { color: item.color, size: item.size })
            return { success: false, reason: 'option_not_found' }
          }

          // 최신 재고 확인
          const currentStock = currentOptions[currentOptionIndex].stock_quantity || 0
          const finalStockToAllocate = Math.min(currentStock, remainingQuantity)

          if (finalStockToAllocate <= 0) {
            console.log(`❌ 재고 부족:`, {
              currentStock,
              required: remainingQuantity
            })
            return { success: false, reason: 'insufficient_stock' }
          }

          // inventory_options 업데이트 (해당 옵션의 재고 차감)
          const updatedOptions = currentOptions.map((opt: any) => {
            if (opt.color === item.color && opt.size === item.size) {
              return { ...opt, stock_quantity: opt.stock_quantity - finalStockToAllocate }
            }
            return opt
          })

          // 전체 재고량 재계산
          const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)

          console.log(`🔄 재고 업데이트:`, {
            previousStock: currentStock,
            allocated: finalStockToAllocate,
            newStock: currentStock - finalStockToAllocate,
            totalStock
          })

          // 데이터베이스 업데이트
          const { error: updateError } = await supabase
            .from('products')
            .update({ 
              inventory_options: updatedOptions,
              stock_quantity: totalStock,
              updated_at: getKoreaTime()
            })
            .eq('id', product.id)

          if (updateError) {
            console.error('재고 업데이트 실패:', updateError)
            return { success: false, reason: 'update_error' }
          }

          stockToAllocate = finalStockToAllocate
          availableStock = currentStock
        }
      } else {
        console.log(`❌ 해당 옵션을 찾을 수 없음:`, { color: item.color, size: item.size })
        return { success: false, reason: 'option_not_found' }
      }
    } else {
      console.log(`❌ inventory_options가 없음`)
      return { success: false, reason: 'no_inventory_options' }
    }

    // 출고 수량 업데이트
    if (stockToAllocate > 0) {
      const { error: itemUpdateError } = await supabase
        .from('order_items')
        .update({ 
          shipped_quantity: alreadyShipped + stockToAllocate 
        })
        .eq('id', item.id)

      if (itemUpdateError) {
        console.error('주문 아이템 업데이트 실패:', itemUpdateError)
        return { success: false, reason: 'item_update_error' }
      }

      // 재고 변동 이력 기록 (출고)
      const movementData = {
        product_id: product.id,
        movement_type: 'order_shipment',
        quantity: -stockToAllocate, // 출고는 음수
        notes: `주문 재고 할당 (${item.color}/${item.size}) - 시간순 자동 할당`,
        reference_id: item.order_id,
        reference_type: 'order',
        created_at: getKoreaTime()
      }
      
      console.log(`📝 재고 변동 이력 기록:`, movementData)
      
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert(movementData)
      
      if (movementError) {
        console.error(`재고 변동 이력 기록 실패:`, movementError)
        // 이력 기록 실패는 경고만 하고 계속 진행
      }
    }

    const result = {
      success: stockToAllocate === remainingQuantity,
      allocated: stockToAllocate,
      available: availableStock,
      required: remainingQuantity,
      reason: stockToAllocate === remainingQuantity ? 'allocated' : 'insufficient_stock'
    }

    console.log(`✅ 아이템 할당 완료:`, result)
    return result

  } catch (error) {
    console.error('아이템 할당 오류:', error)
    return { success: false, reason: 'error' }
  }
} 