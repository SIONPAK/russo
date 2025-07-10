import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { getKoreaTime } from '@/shared/lib/utils'

interface StockAdjustmentRequest {
  adjustment: number
  color?: string
  size?: string
  reason: string
}

// 🎯 전체 재할당 함수
async function performGlobalReallocation(supabase: any) {
  try {
    console.log('🔄 전체 재할당 시작 - 부분 할당된 주문 조회')
    
    // 1. 부분 할당된 주문들 조회 (partial 상태와 confirmed 상태에서 미출고가 있는 주문들)
    const { data: partialOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        created_at,
        order_items!inner (
          id,
          product_id,
          product_name,
          color,
          size,
          quantity,
          shipped_quantity,
          products!inner (
            id,
            stock_quantity,
            inventory_options
          )
        ),
        users!inner (
          company_name
        )
      `)
      .in('status', ['partial', 'confirmed', 'pending'])
      .order('created_at', { ascending: true })

    if (ordersError) {
      console.error('❌ 부분 할당 주문 조회 실패:', ordersError)
      return { success: false, error: '부분 할당 주문 조회 실패' }
    }

    if (!partialOrders || partialOrders.length === 0) {
      console.log('📋 재할당할 주문이 없습니다.')
      return { success: true, message: '재할당할 주문이 없습니다.', totalProcessed: 0 }
    }

    console.log(`📋 전체 주문 ${partialOrders.length}건 조회`)

    // JavaScript에서 실제 미출고 수량이 있는 주문만 필터링
    const ordersWithUnshipped = partialOrders.filter((order: any) => {
      return order.order_items.some((item: any) => {
        const shippedQuantity = item.shipped_quantity || 0
        return shippedQuantity < item.quantity
      })
    })

    console.log(`📋 미출고 수량이 있는 주문 ${ordersWithUnshipped.length}건 발견`)

    if (ordersWithUnshipped.length === 0) {
      console.log('📋 재할당할 주문이 없습니다.')
      return { success: true, message: '재할당할 주문이 없습니다.', totalProcessed: 0 }
    }

    let totalProcessed = 0
    let fullyAllocatedCount = 0
    const reallocationResults = []

    // 2. 각 주문에 대해 재할당 시도
    for (const order of ordersWithUnshipped) {
      try {
        console.log(`🔍 주문 ${order.order_number} 재할당 시작`)
        let orderFullyAllocated = true
        let orderHasNewAllocation = false
        const orderResult = {
          orderId: order.id,
          orderNumber: order.order_number,
          companyName: order.users.company_name,
          items: []
        }

        // 각 주문 아이템에 대해 재할당 시도
        for (const item of order.order_items) {
          const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
          let newShippedQuantity = item.shipped_quantity || 0
          
          if (unshippedQuantity <= 0) {
            continue // 이미 완전히 출고된 아이템은 스킵
          }

          console.log(`  📦 아이템 ${item.product_name} (${item.color}/${item.size}) - 미출고: ${unshippedQuantity}`)

          // 현재 재고 확인
          const product = item.products
          let availableStock = 0

          if (product.inventory_options && Array.isArray(product.inventory_options) && item.color && item.size) {
            // 옵션별 재고 확인
            const targetOption = product.inventory_options.find((opt: any) => 
              opt.color === item.color && opt.size === item.size
            )
            availableStock = targetOption ? targetOption.stock_quantity : 0
          } else {
            // 전체 재고 확인
            availableStock = product.stock_quantity || 0
          }

          console.log(`  📦 가용 재고: ${availableStock}`)

          if (availableStock > 0) {
            const allocateQuantity = Math.min(unshippedQuantity, availableStock)
            
            if (allocateQuantity > 0) {
              console.log(`  ✅ ${allocateQuantity}개 할당 시도`)
              
              // 출고 수량 업데이트
              newShippedQuantity = (item.shipped_quantity || 0) + allocateQuantity
              
              const { error: updateError } = await supabase
                .from('order_items')
                .update({
                  shipped_quantity: newShippedQuantity
                })
                .eq('id', item.id)

              if (updateError) {
                console.error('❌ 주문 아이템 업데이트 실패:', updateError)
                orderFullyAllocated = false
                continue
              }

              // 재고 차감
              if (product.inventory_options && Array.isArray(product.inventory_options) && item.color && item.size) {
                // 옵션별 재고 차감
                const updatedOptions = product.inventory_options.map((option: any) => {
                  if (option.color === item.color && option.size === item.size) {
                    return {
                      ...option,
                      stock_quantity: option.stock_quantity - allocateQuantity
                    }
                  }
                  return option
                })

                const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)

                await supabase
                  .from('products')
                  .update({
                    inventory_options: updatedOptions,
                    stock_quantity: totalStock,
                    updated_at: getKoreaTime()
                  })
                  .eq('id', product.id)
              } else {
                // 전체 재고 차감
                await supabase
                  .from('products')
                  .update({
                    stock_quantity: product.stock_quantity - allocateQuantity,
                    updated_at: getKoreaTime()
                  })
                  .eq('id', product.id)
              }

              // 재고 변동 이력 기록
              await supabase
                .from('stock_movements')
                .insert({
                  product_id: product.id,
                  movement_type: 'order_allocation',
                  quantity: -allocateQuantity,
                  color: item.color || null,
                  size: item.size || null,
                  notes: `재고 조정 후 전체 재할당 (${order.order_number})`,
                  reference_id: order.id,
                  reference_type: 'order',
                  created_at: getKoreaTime()
                })

              orderHasNewAllocation = true
              ;(orderResult.items as any).push({
                productName: item.product_name,
                color: item.color,
                size: item.size,
                allocatedQuantity: allocateQuantity,
                totalShippedQuantity: newShippedQuantity,
                remainingQuantity: item.quantity - newShippedQuantity
              })

              console.log(`  ✅ ${allocateQuantity}개 할당 완료`)
            }
          }

          // 아직 미출고 수량이 남아있으면 부분 할당 상태
          if (newShippedQuantity < item.quantity) {
            orderFullyAllocated = false
          }
        }

        // 주문 상태 업데이트
        if (orderFullyAllocated) {
          await supabase
            .from('orders')
            .update({
              status: 'confirmed',
              updated_at: getKoreaTime()
            })
            .eq('id', order.id)
          
          fullyAllocatedCount++
          console.log(`  ✅ 주문 ${order.order_number} 완전 할당 완료`)
        } else if (orderHasNewAllocation) {
          await supabase
            .from('orders')
            .update({
              status: 'partial',
              updated_at: getKoreaTime()
            })
            .eq('id', order.id)
          
          console.log(`  ⚠️  주문 ${order.order_number} 부분 할당 상태`)
        }

        if (orderHasNewAllocation) {
          reallocationResults.push(orderResult)
        }
        
        totalProcessed++

      } catch (error) {
        console.error(`❌ 주문 ${order.order_number} 재할당 실패:`, error)
      }
    }

    console.log(`🎯 전체 재할당 완료: ${totalProcessed}건 처리, ${fullyAllocatedCount}건 완전 할당`)

    return {
      success: true,
      message: `전체 재할당 완료: ${totalProcessed}건 처리, ${fullyAllocatedCount}건 완전 할당`,
      totalProcessed,
      fullyAllocatedCount,
      results: reallocationResults
    }

  } catch (error) {
    console.error('❌ 전체 재할당 중 오류 발생:', error)
    return { success: false, error: '전체 재할당 중 오류가 발생했습니다.' }
  }
}

// PATCH /api/admin/products/[id]/stock - 재고 조정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    const body: StockAdjustmentRequest = await request.json()
    
    const { adjustment, color, size, reason } = body
    
    if (!adjustment || adjustment === 0) {
      return NextResponse.json({
        success: false,
        error: '유효한 재고 조정 수량을 입력해주세요.'
      }, { status: 400 })
    }

    // 상품 정보 조회
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, stock_quantity, inventory_options')
      .eq('id', productId)
      .single()

    if (fetchError || !product) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    let allocationResults = null

    // 옵션별 재고 조정 - 새로운 구조 사용
    if (color && size) {
      // 🔄 물리적 재고 조정 RPC 사용
      const { data: adjustResult, error: adjustError } = await supabase
        .rpc('adjust_physical_stock', {
          p_product_id: productId,
          p_color: color,
          p_size: size,
          p_quantity_change: adjustment,
          p_reason: `관리자 재고 조정 (${color}/${size}) - ${reason || '수동 재고 조정'}`
        })

      if (adjustError || !adjustResult) {
        console.error('물리적 재고 조정 실패:', adjustError)
        return NextResponse.json({
          success: false,
          error: '재고 조정에 실패했습니다.'
        }, { status: 500 })
      }

      console.log(`✅ 물리적 재고 조정 완료: ${productId} (${color}/${size}) ${adjustment > 0 ? '+' : ''}${adjustment}`)

      // 🎯 재고 증가 시 자동 할당 처리
      if (adjustment > 0) {
        console.log(`🔄 재고 증가로 자동 할당 시작 - 상품: ${productId}, 색상: ${color}, 사이즈: ${size}, 증가량: ${adjustment}`)
        allocationResults = await autoAllocateToUnshippedOrders(supabase, productId, color, size)
        console.log(`🔄 자동 할당 결과:`, allocationResults)
      }

    } else {
      // 일반 재고 조정 - 새로운 구조 사용
      const { data: adjustResult, error: adjustError } = await supabase
        .rpc('adjust_physical_stock', {
          p_product_id: productId,
          p_color: null,
          p_size: null,
          p_quantity_change: adjustment,
          p_reason: `관리자 재고 조정 - ${reason || '수동 재고 조정'}`
        })

      if (adjustError || !adjustResult) {
        console.error('물리적 재고 조정 실패:', adjustError)
        return NextResponse.json({
          success: false,
          error: '재고 조정에 실패했습니다.'
        }, { status: 500 })
      }

      console.log(`✅ 물리적 재고 조정 완료: ${productId} ${adjustment > 0 ? '+' : ''}${adjustment}`)

      // 🎯 재고 증가 시 자동 할당 처리
      if (adjustment > 0) {
        console.log(`🔄 재고 증가로 자동 할당 시작 - 상품: ${productId}, 증가량: ${adjustment}`)
        allocationResults = await autoAllocateToUnshippedOrders(supabase, productId)
        console.log(`🔄 자동 할당 결과:`, allocationResults)

        // 🎯 전체 재할당 수행 (부분 할당된 주문들 재할당)
        console.log(`🔄 전체 재할당 시작...`)
        try {
          const globalReallocationResult = await performGlobalReallocation(supabase)
          console.log(`✅ 전체 재할당 완료:`, globalReallocationResult)
          // allocationResults에 전체 재할당 정보 추가
          if (allocationResults && allocationResults.success) {
            (allocationResults as any).globalReallocation = globalReallocationResult
          }
        } catch (error) {
          console.error(`❌ 전체 재할당 실패:`, error)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `재고가 ${adjustment > 0 ? '증가' : '감소'}되었습니다.`,
      data: {
        productId,
        adjustment,
        reason,
        allocation: allocationResults || null,
        allocation_message: allocationResults?.message || null
      }
    })

  } catch (error) {
    console.error('Stock adjustment error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}



async function autoAllocateToUnshippedOrders(supabase: any, productId: string, color?: string, size?: string) {
  try {
    console.log(`🔄 자동 할당 시작 - 상품: ${productId}, 색상: ${color}, 사이즈: ${size}`)
    
    // 1. 해당 상품의 미출고 주문 아이템 조회 (시간순)
    let orderItemsQuery = supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        product_id,
        product_name,
        color,
        size,
        quantity,
        shipped_quantity,
        unit_price,
        orders!inner (
          id,
          order_number,
          status,
          created_at,
          users!inner (
            company_name
          )
        )
      `)
      .eq('product_id', productId)
      .not('orders.status', 'in', '(shipped,delivered,cancelled,returned,refunded)')
      .order('id', { ascending: true }) // order_items ID로 정렬 (시간순과 유사)

    // 색상/사이즈 옵션이 있는 경우 필터링
    if (color && size) {
      orderItemsQuery = orderItemsQuery
        .eq('color', color)
        .eq('size', size)
    }

    // 실제 미출고 수량이 있는 아이템만 조회 (JavaScript에서 필터링)
    // orderItemsQuery = orderItemsQuery.lt('shipped_quantity', 'quantity')

    console.log(`🔍 미출고 주문 조회 시작`)
    const { data: orderItems, error: itemsError } = await orderItemsQuery

    if (itemsError) {
      console.error('❌ 미출고 주문 조회 실패:', itemsError)
      return { success: false, error: '미출고 주문 조회 실패' }
    }

    console.log(`📊 전체 주문 조회 결과: ${orderItems?.length || 0}건`)

    if (!orderItems || orderItems.length === 0) {
      console.log('📋 해당 상품의 주문이 없습니다.')
      return { success: true, message: '해당 상품의 주문이 없습니다.', allocations: [] }
    }

    // JavaScript에서 실제 미출고 수량이 있는 아이템만 필터링
    const unshippedItems = orderItems.filter((item: any) => {
      const shippedQuantity = item.shipped_quantity || 0
      return shippedQuantity < item.quantity
    })

    console.log(`📊 미출고 주문 필터링 결과: ${unshippedItems.length}건`)

    if (unshippedItems.length === 0) {
      console.log('📋 미출고 주문이 없습니다.')
      return { success: true, message: '미출고 주문이 없습니다.', allocations: [] }
    }

    // 2. 현재 재고 확인
    const { data: currentProduct, error: productError } = await supabase
      .from('products')
      .select('stock_quantity, inventory_options')
      .eq('id', productId)
      .single()

    if (productError || !currentProduct) {
      console.error('❌ 상품 재고 조회 실패:', productError)
      return { success: false, error: '상품 재고 조회 실패' }
    }

    let availableStock = 0
    
    if (currentProduct.inventory_options && Array.isArray(currentProduct.inventory_options) && color && size) {
      const targetOption = currentProduct.inventory_options.find((opt: any) => 
        opt.color === color && opt.size === size
      )
      availableStock = targetOption ? targetOption.stock_quantity : 0
      console.log(`📦 옵션별 재고 (${color}/${size}): ${availableStock}`)
    } else {
      availableStock = currentProduct.stock_quantity || 0
      console.log(`📦 전체 재고: ${availableStock}`)
    }

    if (availableStock <= 0) {
      console.log('❌ 할당할 재고가 없습니다.')
      return { success: true, message: '할당할 재고가 없습니다.', allocations: [] }
    }

    // 3. 재고 할당
    const allocations = []
    let remainingStock = availableStock
    
    console.log(`🔄 재고 할당 시작 - 총 ${unshippedItems.length}개 주문 처리`)
    
    for (const item of unshippedItems) {
      const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
      
      if (unshippedQuantity <= 0) {
        continue
      }

      const allocateQuantity = Math.min(unshippedQuantity, remainingStock)
      
      if (allocateQuantity > 0) {
        const newShippedQuantity = (item.shipped_quantity || 0) + allocateQuantity
        
        console.log(`📝 출고 수량 업데이트: ${item.orders.order_number} - ${allocateQuantity}개 할당`)
        
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            shipped_quantity: newShippedQuantity
          })
          .eq('id', item.id)

        if (updateError) {
          console.error('❌ 주문 아이템 업데이트 실패:', updateError)
          continue
        }

        // 재고 변동 이력 기록
        await supabase
          .from('stock_movements')
          .insert({
            product_id: productId,
            movement_type: 'order_allocation',
            quantity: -allocateQuantity,
            color: color || null,
            size: size || null,
            notes: `재고 조정 후 자동 할당 (${item.orders.order_number})`,
            reference_id: item.order_id,
            reference_type: 'order',
            created_at: getKoreaTime()
          })

        allocations.push({
          orderId: item.order_id,
          orderNumber: item.orders.order_number,
          companyName: item.orders.users.company_name,
          allocatedQuantity: allocateQuantity
        })

        remainingStock -= allocateQuantity
        
        console.log(`✅ 할당 완료: ${item.orders.order_number} - ${allocateQuantity}개`)
      }

      if (remainingStock <= 0) {
        console.log(`🔚 재고 소진으로 할당 종료`)
        break
      }
    }

    // 4. 재고 차감
    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocatedQuantity, 0)
    
    if (totalAllocated > 0) {
      console.log(`🔄 재고 차감: ${totalAllocated}개`)
      
      if (currentProduct.inventory_options && Array.isArray(currentProduct.inventory_options) && color && size) {
        const updatedOptions = currentProduct.inventory_options.map((option: any) => {
          if (option.color === color && option.size === size) {
            return {
              ...option,
              stock_quantity: option.stock_quantity - totalAllocated
            }
          }
          return option
        })

        const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)

        await supabase
          .from('products')
          .update({
            inventory_options: updatedOptions,
            stock_quantity: totalStock,
            updated_at: getKoreaTime()
          })
          .eq('id', productId)
      } else {
        await supabase
          .from('products')
          .update({
            stock_quantity: currentProduct.stock_quantity - totalAllocated,
            updated_at: getKoreaTime()
          })
          .eq('id', productId)
      }
    }

    console.log(`🎯 자동 할당 완료: ${totalAllocated}개 할당, ${allocations.length}개 주문 처리`)

    return { 
      success: true, 
      message: `${totalAllocated}개 재고가 ${allocations.length}개 주문에 할당되었습니다.`, 
      allocations 
    }

  } catch (error) {
    console.error('❌ 자동 할당 중 오류 발생:', error)
    return { success: false, error: '자동 할당 중 오류가 발생했습니다.' }
  }
}