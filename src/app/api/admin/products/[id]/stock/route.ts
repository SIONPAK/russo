import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { getKoreaTime } from '@/shared/lib/utils'

interface StockAdjustmentRequest {
  adjustment?: number // 조정량 (기존 방식)
  absolute_value?: number // 절대값 설정 (새로운 방식)
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
    
    const { adjustment, absolute_value, color, size, reason } = body
    
    console.log('🔄 재고 조정 API 호출됨:', {
      productId,
      adjustment,
      absolute_value,
      color,
      size,
      reason
    })
    
    // 둘 중 하나만 제공되어야 함
    if ((!adjustment || adjustment === 0) && (absolute_value === undefined || absolute_value === null)) {
      return NextResponse.json({
        success: false,
        error: '조정 수량 또는 절대값을 입력해주세요.'
      }, { status: 400 })
    }

    if (adjustment && absolute_value !== undefined && absolute_value !== null) {
      return NextResponse.json({
        success: false,
        error: '조정 수량과 절대값을 동시에 입력할 수 없습니다.'
      }, { status: 400 })
    }

    // 상품 정보 조회
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, stock_quantity, inventory_options')
      .eq('id', productId)
      .single()

    if (fetchError || !product) {
      console.error('❌ 상품 조회 실패:', fetchError)
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    console.log('📦 상품 정보 조회 완료:', {
      productId: product.id,
      currentStock: product.stock_quantity,
      hasOptions: !!product.inventory_options?.length
    })

    // 절대값 설정 모드인 경우 조정량 계산
    let finalAdjustment = adjustment || 0
    
    if (absolute_value !== undefined && absolute_value !== null) {
      // 🎯 음수 입력 시 안전장치: 0으로 제한
      let targetAbsoluteValue = absolute_value
      if (absolute_value < 0) {
        console.log(`⚠️ 음수값 입력 감지: ${absolute_value}개 → 0개로 제한`)
        targetAbsoluteValue = 0
      }
      
      let currentStock = 0
      
      if (color && size && product.inventory_options) {
        const targetOption = product.inventory_options.find((opt: any) => 
          opt.color === color && opt.size === size
        )
        currentStock = targetOption ? (targetOption.physical_stock || 0) : 0
      } else {
        currentStock = product.inventory_options 
          ? product.inventory_options.reduce((sum: number, opt: any) => sum + (opt.physical_stock || 0), 0)
          : product.stock_quantity || 0
      }
      
      finalAdjustment = targetAbsoluteValue - currentStock
      console.log(`📊 절대값 설정: 현재 ${currentStock}개 → 목표 ${targetAbsoluteValue}개 (조정량: ${finalAdjustment}개)`)
    }

    let allocationResults = null

    // 옵션별 재고 조정 - 새로운 구조 사용
    if (color && size) {
      console.log(`🔄 옵션별 재고 조정 시작 (${color}/${size})`)
      
      // 🔄 물리적 재고 조정 RPC 사용 (상대값 추가)
      const { data: adjustResult, error: adjustError } = await supabase
        .rpc('add_physical_stock', {
          p_product_id: productId,
          p_color: color,
          p_size: size,
          p_additional_stock: finalAdjustment,
          p_reason: `관리자 재고 ${absolute_value !== undefined ? '설정' : '조정'} (${color}/${size}) - ${reason || '수동 재고 조정'}`
        })

      if (adjustError || !adjustResult) {
        console.error('❌ 물리적 재고 조정 실패:', adjustError)
        return NextResponse.json({
          success: false,
          error: '재고 조정에 실패했습니다.'
        }, { status: 500 })
      }

      console.log(`✅ 물리적 재고 조정 완료: ${productId} (${color}/${size}) ${finalAdjustment > 0 ? '+' : ''}${finalAdjustment}`)
      
      // 📝 재고 변동 이력은 add_physical_stock 함수에서 자동 기록됨
      console.log('✅ 재고 변동 이력 기록 완료')
      
      // 🎯 재할당은 add_physical_stock 함수에서 자동 처리됨
      console.log('✅ 재할당 처리 완료')
            .eq('product_id', productId)
            .eq('color', color)
            .eq('size', size)

          const totalAllocated = orderItems?.reduce((sum: number, item: any) => {
            const order = Array.isArray(item.orders) ? item.orders[0] : item.orders
            const isPendingOrder = order && ['pending', 'confirmed', 'processing', 'allocated'].includes(order.status)
            
            if (isPendingOrder) {
              const pendingQuantity = item.quantity - (item.shipped_quantity || 0)
              return sum + Math.max(0, pendingQuantity)
            }
            return sum
          }, 0) || 0

          console.log(`📊 총 할당된 재고: ${totalAllocated}개`)

          // 가용 재고 = 물리적 재고 - 할당된 재고
          const updatedOptions = finalProduct.inventory_options.map((option: any) => {
            if (option.color === color && option.size === size) {
              const physicalStock = option.physical_stock || 0
              const availableStock = Math.max(0, physicalStock - totalAllocated)
              
              console.log(`📊 가용 재고 계산: ${physicalStock} (물리적) - ${totalAllocated} (할당) = ${availableStock} (가용)`)
              
              return {
                ...option,
                allocated_stock: totalAllocated,  // 🎯 할당된 재고 업데이트
                stock_quantity: availableStock
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
            
          console.log(`✅ 자동 할당 후 가용 재고 업데이트 완료: ${productId} (${color}/${size})`)
        }
        
        // 🎯 추가 전체 재할당 수행
        console.log(`🔄 추가 전체 재할당 시작...`)
        try {
          const globalReallocationResult = await performGlobalReallocation(supabase)
          console.log(`✅ 추가 전체 재할당 완료:`, globalReallocationResult)
          if (allocationResults && allocationResults.success) {
            (allocationResults as any).globalReallocation = globalReallocationResult
          }
        } catch (error) {
          console.error(`❌ 추가 전체 재할당 실패:`, error)
        }
      }
      
      // 🎯 재고 차감 시 또는 0으로 설정 시 시간순 재할당 처리
      if (finalAdjustment < 0 || absolute_value === 0) {
        console.log(`🔄 재고 차감/0설정으로 시간순 재할당 시작 - 상품: ${productId}, 색상: ${color}, 사이즈: ${size}`)
        
        // 잠시 대기 후 재할당 (데이터 동기화)
        await new Promise(resolve => setTimeout(resolve, 100))
        
        allocationResults = await reallocateAfterStockReduction(supabase, productId, color, size)
        console.log(`🔄 재할당 결과:`, allocationResults)
      }

    } else {
      console.log(`🔄 전체 재고 조정 시작`)
      
      // 전체 재고 조정 - 새로운 구조 사용
      const { data: adjustResult, error: adjustError } = await supabase
        .rpc('add_physical_stock', {
          p_product_id: productId,
          p_color: null,
          p_size: null,
          p_additional_stock: finalAdjustment,
          p_reason: `관리자 재고 ${absolute_value !== undefined ? '설정' : '조정'} - ${reason || '수동 재고 조정'}`
        })

      if (adjustError || !adjustResult) {
        console.error('❌ 물리적 재고 조정 실패:', adjustError)
        return NextResponse.json({
          success: false,
          error: '재고 조정에 실패했습니다.'
        }, { status: 500 })
      }

      console.log(`✅ 물리적 재고 조정 완료: ${productId} ${finalAdjustment > 0 ? '+' : ''}${finalAdjustment}`)

      // 🔄 재고 조정 후 가용 재고 업데이트 (물리적 재고 기준으로 재계산)
      const { data: updatedProduct, error: refetchError } = await supabase
        .from('products')
        .select('inventory_options')
        .eq('id', productId)
        .single()

      if (refetchError || !updatedProduct) {
        console.error('❌ 업데이트된 상품 조회 실패:', refetchError)
      } else {
        // 🎯 재고 증가 시에는 자동 할당 후 가용 재고를 계산해야 함
        if (finalAdjustment > 0) {
          // 재고 증가 시: 자동 할당 후 가용 재고 계산
          console.log(`🔄 재고 증가 시 자동 할당 후 가용 재고 계산 예정`)
        } else {
          // 가용 재고 = 물리적 재고로 설정 (재할당 전)
          const updatedOptions = updatedProduct.inventory_options.map((option: any) => ({
            ...option,
            stock_quantity: option.physical_stock || 0  // 가용 재고 = 물리적 재고
          }))

          const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)

          await supabase
            .from('products')
            .update({
              inventory_options: updatedOptions,
              stock_quantity: totalStock,
              updated_at: getKoreaTime()
            })
            .eq('id', productId)
            
          console.log(`✅ 가용 재고 업데이트 완료: ${productId}`)
        }
      }

      // 📝 재고 변동 이력 기록
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: productId,
          movement_type: 'adjustment',
          quantity: finalAdjustment,
          color: null,
          size: null,
          notes: `관리자 재고 ${absolute_value !== undefined ? '설정' : '조정'} - ${reason || '수동 재고 조정'}`,
          created_at: getKoreaTime()
        })

      if (movementError) {
        console.error('❌ 재고 변동 이력 기록 실패:', movementError)
      } else {
        console.log('✅ 재고 변동 이력 기록 완료')
      }

      // 🎯 재고 증가 시 자동 할당 처리
      if (finalAdjustment > 0) {
        console.log(`🔄 재고 증가로 자동 할당 시작 - 상품: ${productId}, 증가량: ${finalAdjustment}`)
        
        // 잠시 대기 후 자동 할당 (데이터 동기화)
        await new Promise(resolve => setTimeout(resolve, 100))
        
        allocationResults = await autoAllocateToUnshippedOrders(supabase, productId)
        console.log(`🔄 자동 할당 결과:`, allocationResults)

        // 🎯 자동 할당 후 가용 재고 업데이트 (전체 재고)
        console.log(`🔄 자동 할당 후 가용 재고 업데이트 시작 (전체 재고)`)
        
        const { data: finalProduct, error: finalError } = await supabase
          .from('products')
          .select('inventory_options')
          .eq('id', productId)
          .single()

        if (finalError || !finalProduct) {
          console.error('❌ 최종 상품 조회 실패:', finalError)
        } else {
          // 각 옵션별 할당량 계산
          const optionAllocations = new Map()
          
          // 각 옵션별 할당량 집계 (미출고 수량)
          const { data: optionItems, error: optionError } = await supabase
            .from('order_items')
            .select(`
              color,
              size,
              quantity,
              shipped_quantity,
              orders!order_items_order_id_fkey (
                status
              )
            `)
            .eq('product_id', productId)

          if (optionItems) {
            optionItems.forEach((item: any) => {
              const order = Array.isArray(item.orders) ? item.orders[0] : item.orders
              const isPendingOrder = order && ['pending', 'confirmed', 'processing', 'allocated'].includes(order.status)
              
              if (isPendingOrder) {
                const key = `${item.color}-${item.size}`
                const allocated = optionAllocations.get(key) || 0
                const pendingQuantity = item.quantity - (item.shipped_quantity || 0)
                optionAllocations.set(key, allocated + Math.max(0, pendingQuantity))
              }
            })
          }

          // 가용 재고 = 물리적 재고 - 할당된 재고
          const updatedOptions = finalProduct.inventory_options.map((option: any) => {
            const key = `${option.color}-${option.size}`
            const allocatedForOption = optionAllocations.get(key) || 0
            const physicalStock = option.physical_stock || 0
            const availableStock = Math.max(0, physicalStock - allocatedForOption)
            
            console.log(`📊 옵션 ${option.color}/${option.size} 가용 재고 계산: ${physicalStock} (물리적) - ${allocatedForOption} (할당) = ${availableStock} (가용)`)
            
            return {
              ...option,
              allocated_stock: allocatedForOption,  // 🎯 할당된 재고 업데이트
              stock_quantity: availableStock
            }
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
            
          console.log(`✅ 자동 할당 후 가용 재고 업데이트 완료: ${productId}`)
        }

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
      
      // 🎯 재고 차감 시 또는 0으로 설정 시 시간순 재할당 처리
      if (finalAdjustment < 0 || absolute_value === 0) {
        console.log(`🔄 재고 차감/0설정으로 시간순 재할당 시작 - 상품: ${productId}`)
        
        // 잠시 대기 후 재할당 (데이터 동기화)
        await new Promise(resolve => setTimeout(resolve, 100))
        
        allocationResults = await reallocateAfterStockReduction(supabase, productId)
        console.log(`🔄 재할당 결과:`, allocationResults)
      }
    }

    console.log('📦 최종 응답 데이터:', {
      success: true,
      productId,
      adjustment: finalAdjustment,
      absolute_value,
      allocationResults
    })

    return NextResponse.json({
      success: true,
      message: `재고가 ${absolute_value !== undefined ? `${absolute_value}개로 설정` : `${finalAdjustment > 0 ? '증가' : '감소'}`}되었습니다.`,
      data: {
        productId,
        adjustment: finalAdjustment,
        absolute_value,
        reason,
        allocation: allocationResults || null,
        allocation_message: allocationResults?.message || null
      }
    })

  } catch (error) {
    console.error('❌ 재고 조정 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}



// 🎯 재고 차감 후 시간순 재할당 함수
async function reallocateAfterStockReduction(supabase: any, productId: string, color?: string, size?: string) {
  try {
    console.log(`🔄 재고 차감 후 전체 재할당 시작 - 상품: ${productId}, 색상: ${color}, 사이즈: ${size}`)
    
    // 1. 현재 물리적 재고 확인
    const { data: currentProduct, error: productError } = await supabase
      .from('products')
      .select('stock_quantity, inventory_options')
      .eq('id', productId)
      .single()

    if (productError || !currentProduct) {
      console.error('❌ 상품 재고 조회 실패:', productError)
      return { success: false, error: '상품 재고 조회 실패' }
    }

    let currentPhysicalStock = 0
    
    if (currentProduct.inventory_options && Array.isArray(currentProduct.inventory_options) && color && size) {
      const targetOption = currentProduct.inventory_options.find((opt: any) => 
        opt.color === color && opt.size === size
      )
      currentPhysicalStock = targetOption ? targetOption.physical_stock : 0
      console.log(`📦 현재 물리적 재고 (${color}/${size}): ${currentPhysicalStock}`)
    } else {
      // 전체 재고의 경우 물리적 재고 총합 계산
      currentPhysicalStock = currentProduct.inventory_options 
        ? currentProduct.inventory_options.reduce((sum: number, opt: any) => sum + (opt.physical_stock || 0), 0)
        : currentProduct.stock_quantity || 0
      console.log(`📦 현재 물리적 재고 (전체): ${currentPhysicalStock}`)
    }

    // 2. 해당 상품의 모든 미출고 주문 아이템 조회 (시간 빠른 순)
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
      .order('created_at', { ascending: true, foreignTable: 'orders' }) // 시간 빠른 순 (정방향)

    // 색상/사이즈 옵션이 있는 경우 필터링
    if (color && size) {
      orderItemsQuery = orderItemsQuery
        .eq('color', color)
        .eq('size', size)
    }

    console.log(`🔍 미출고 주문 조회 시작`)
    const { data: unshippedItems, error: itemsError } = await orderItemsQuery

    if (itemsError) {
      console.error('❌ 미출고 주문 조회 실패:', itemsError)
      return { success: false, error: '미출고 주문 조회 실패' }
    }

    console.log(`📊 미출고 주문 조회 결과: ${unshippedItems?.length || 0}건`)

    if (!unshippedItems || unshippedItems.length === 0) {
      console.log('📋 미출고 주문이 없습니다.')
      return { success: true, message: '미출고 주문이 없습니다.', reallocations: [] }
    }

    // 3. 모든 주문의 할당량을 초기화 (0으로 설정)
    console.log(`🔄 기존 할당량 초기화 시작`)
    const resetResults = []
    
    for (const item of unshippedItems) {
      const { error: resetError } = await supabase
        .from('order_items')
        .update({
          shipped_quantity: 0
        })
        .eq('id', item.id)

      if (resetError) {
        console.error('❌ 할당량 초기화 실패:', resetError)
        continue
      }

      resetResults.push({
        orderId: item.order_id,
        orderNumber: item.orders.order_number,
        previousShipped: item.shipped_quantity || 0
      })
    }

    console.log(`✅ 할당량 초기화 완료: ${resetResults.length}건`)

    // 4. 물리적 재고를 기준으로 시간 빠른 순으로 재할당
    const reallocations = []
    let remainingStock = currentPhysicalStock
    
    console.log(`🔄 재할당 시작 - 가용 재고: ${remainingStock}개`)
    
    for (const item of unshippedItems) {
      if (remainingStock <= 0) break

      const requestedQuantity = item.quantity
      const allocateQuantity = Math.min(requestedQuantity, remainingStock)
      
      if (allocateQuantity > 0) {
        console.log(`📝 재할당: ${item.orders.order_number} - ${allocateQuantity}개 할당 (요청: ${requestedQuantity})`)
        
        // 출고 수량 업데이트
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            shipped_quantity: allocateQuantity
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
            movement_type: 'reallocation',
            quantity: -allocateQuantity,
            color: color || null,
            size: size || null,
            notes: `재고 차감 후 전체 재할당 (${item.orders.order_number})`,
            reference_id: item.order_id,
            reference_type: 'order',
            created_at: getKoreaTime()
          })

        reallocations.push({
          orderId: item.order_id,
          orderNumber: item.orders.order_number,
          companyName: item.orders.users.company_name,
          allocatedQuantity: allocateQuantity,
          requestedQuantity: requestedQuantity,
          isFullyAllocated: allocateQuantity >= requestedQuantity
        })

        remainingStock -= allocateQuantity
        
        console.log(`✅ 재할당 완료: ${item.orders.order_number} - ${allocateQuantity}개, 남은 재고: ${remainingStock}개`)
      }
    }

    // 5. 재고 정보 업데이트 (allocated_stock 및 stock_quantity 동기화)
    const totalAllocated = reallocations.reduce((sum, realloc) => sum + realloc.allocatedQuantity, 0)
    
    console.log(`🔄 재고 정보 업데이트: 총 할당량 ${totalAllocated}개`)
    
    if (currentProduct.inventory_options && Array.isArray(currentProduct.inventory_options) && color && size) {
      const updatedOptions = currentProduct.inventory_options.map((option: any) => {
        if (option.color === color && option.size === size) {
          return {
            ...option,
            allocated_stock: totalAllocated,
            stock_quantity: Math.max(0, (option.physical_stock || 0) - totalAllocated)
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
      // 전체 재고 업데이트
      await supabase
        .from('products')
        .update({
          stock_quantity: Math.max(0, currentPhysicalStock - totalAllocated),
          updated_at: getKoreaTime()
        })
        .eq('id', productId)
    }

    // 6. 영향받은 주문들의 상태 업데이트
    const affectedOrderIds = [...new Set(reallocations.map(realloc => realloc.orderId))]
    
    for (const orderId of affectedOrderIds) {
      // 해당 주문의 모든 아이템 상태 확인
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('quantity, shipped_quantity')
        .eq('order_id', orderId)

      const allFullyShipped = orderItems?.every((item: any) => 
        (item.shipped_quantity || 0) >= item.quantity
      )

      const hasPartialShipped = orderItems?.some((item: any) => 
        (item.shipped_quantity || 0) > 0
      )

      let newStatus = 'pending'
      if (allFullyShipped) {
        newStatus = 'processing' // 전량 할당 완료
      } else if (hasPartialShipped) {
        newStatus = 'partial' // 부분 할당
      }

      await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: getKoreaTime()
        })
        .eq('id', orderId)
    }

    console.log(`🎯 전체 재할당 완료: ${totalAllocated}개 할당, ${reallocations.length}개 주문 처리`)

    return { 
      success: true, 
      message: `재고 차감 후 전체 재할당 완료: ${totalAllocated}개 할당, ${reallocations.length}개 주문 처리`, 
      reallocations,
      totalAllocated,
      remainingStock,
      affectedOrders: affectedOrderIds.length
    }

  } catch (error) {
    console.error('❌ 재고 차감 후 전체 재할당 중 오류 발생:', error)
    return { success: false, error: '재고 차감 후 전체 재할당 중 오류가 발생했습니다.' }
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
      .order('created_at', { ascending: true, foreignTable: 'orders' }) // 🔧 수정: 주문 시간순 정렬

    // 색상/사이즈 옵션이 있는 경우 필터링
    if (color && size) {
      orderItemsQuery = orderItemsQuery
        .eq('color', color)
        .eq('size', size)
    }

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

    // JavaScript에서 실제 미출고 수량이 있는 아이템만 필터링 후 시간순 재정렬
    const unshippedItems = orderItems
      .filter((item: any) => {
        const shippedQuantity = item.shipped_quantity || 0
        return shippedQuantity < item.quantity
      })
      .sort((a: any, b: any) => {
        // 🔧 수정: 필터링 후 시간순으로 재정렬
        return new Date(a.orders.created_at).getTime() - new Date(b.orders.created_at).getTime()
      })

    console.log(`📊 미출고 주문 필터링 결과: ${unshippedItems.length}건`)
    
    // 시간순 정렬 디버깅 로그
    console.log(`📅 시간순 정렬 확인:`)
    unshippedItems.forEach((item: any, index: number) => {
      console.log(`  ${index + 1}. ${item.orders.order_number} (${item.orders.users.company_name}): ${item.orders.created_at}`)
    })

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
        // 현재 할당된 재고 계산 (미출고 수량)
        const { data: orderItems, error: allocatedError } = await supabase
          .from('order_items')
          .select(`
            quantity,
            shipped_quantity,
            orders!order_items_order_id_fkey (
              status
            )
          `)
          .eq('product_id', productId)
          .eq('color', color)
          .eq('size', size)

        const currentAllocated = orderItems?.reduce((sum: number, item: any) => {
          const order = Array.isArray(item.orders) ? item.orders[0] : item.orders
          const isPendingOrder = order && ['pending', 'confirmed', 'processing', 'allocated'].includes(order.status)
          
          if (isPendingOrder) {
            const pendingQuantity = item.quantity - (item.shipped_quantity || 0)
            return sum + Math.max(0, pendingQuantity)
          }
          return sum
        }, 0) || 0

        const updatedOptions = currentProduct.inventory_options.map((option: any) => {
          if (option.color === color && option.size === size) {
            return {
              ...option,
              allocated_stock: currentAllocated,  // 🎯 할당된 재고 업데이트
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
        // 전체 재고의 경우 모든 옵션의 allocated_stock 업데이트
        const { data: allocatedItems, error: allocatedError } = await supabase
          .from('order_items')
          .select('color, size, shipped_quantity')
          .eq('product_id', productId)
          .not('shipped_quantity', 'is', null)
          .gt('shipped_quantity', 0)

        const optionAllocations = new Map()
        
        if (allocatedItems) {
          allocatedItems.forEach((item: any) => {
            const key = `${item.color}-${item.size}`
            const allocated = optionAllocations.get(key) || 0
            optionAllocations.set(key, allocated + (item.shipped_quantity || 0))
          })
        }

        const updatedOptions = currentProduct.inventory_options.map((option: any) => {
          const key = `${option.color}-${option.size}`
          const allocatedForOption = optionAllocations.get(key) || 0
          
          return {
            ...option,
            allocated_stock: allocatedForOption  // 🎯 할당된 재고 업데이트
          }
        })

        await supabase
          .from('products')
          .update({
            inventory_options: updatedOptions,
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