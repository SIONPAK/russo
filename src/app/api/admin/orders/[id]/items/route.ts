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

    // 현재 아이템 정보 조회
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

    console.log('🔄 [관리자 수정] 주문 수량 변경:', {
      orderItemId,
      oldQuantity,
      newQuantity: quantity,
      quantityDiff,
      currentShippedQuantity,
      productId: currentItem.product_id,
      color: currentItem.color,
      size: currentItem.size
    })

    // 🎯 출고 수량 및 할당 수량 자동 조정 로직
    let newShippedQuantity = currentShippedQuantity
    let shippedQuantityDiff = 0
    let newAllocatedQuantity = (currentItem as any).allocated_quantity || 0

    // 재고 할당 조정 (새로운 함수 사용)
    if (quantityDiff !== 0) {
      if (quantityDiff > 0) {
        // 수량 증가 - 먼저 가용재고 확인 후 시간순 재할당 수행
        const { data: availableStock, error: stockError } = await supabase
          .rpc('calculate_available_stock', {
            p_product_id: currentItem.product_id,
            p_color: currentItem.color,
            p_size: currentItem.size
          })

        console.log('🔍 [수량 수정] 가용 재고 확인 결과:', {
          productId: currentItem.product_id,
          color: currentItem.color,
          size: currentItem.size,
          availableStock: availableStock,
          stockError: stockError,
          quantityDiff: quantityDiff,
          currentQuantity: oldQuantity,
          newQuantity: quantity
        })

        // 현재 상품 정보도 함께 조회하여 로그 출력
        const { data: productInfo, error: productError } = await supabase
          .from('products')
          .select('id, name, code, inventory_options, stock_quantity')
          .eq('id', currentItem.product_id)
          .single()

        console.log('🔍 [수량 수정] 상품 정보:', {
          product: productInfo,
          productError: productError
        })

        let additionalShippable = 0

        if (!stockError && availableStock >= quantityDiff) {
          // 가용재고가 충분한 경우 - 전체 미출고 수량 확인하여 모두 할당
          const totalUnshipped = quantity - currentShippedQuantity
          const maxAllocatable = Math.min(totalUnshipped, availableStock)
          
          console.log('✅ [가용재고 충분] 전체 미출고 수량 할당 시작:', {
            productId: currentItem.product_id,
            color: currentItem.color,
            size: currentItem.size,
            totalQuantity: quantity,
            currentShippedQuantity: currentShippedQuantity,
            totalUnshipped: totalUnshipped,
            availableStock: availableStock,
            maxAllocatable: maxAllocatable
          })

          if (maxAllocatable > 0) {
            // 전체 미출고 수량에 대해 재고 할당 수행
            const { data: allocationResult, error: allocationError } = await supabase
              .rpc('allocate_stock', {
                p_product_id: currentItem.product_id,
                p_quantity: maxAllocatable,
                p_color: currentItem.color,
                p_size: currentItem.size
              })

            if (allocationError || !allocationResult) {
              console.error('❌ [재고 할당 실패]:', allocationError)
              additionalShippable = 0
            } else {
              additionalShippable = maxAllocatable
              console.log('✅ [재고 할당 성공] 전체 미출고 수량 할당 완료:', {
                productId: currentItem.product_id,
                color: currentItem.color,
                size: currentItem.size,
                allocatedQuantity: maxAllocatable,
                newTotalShipped: currentShippedQuantity + maxAllocatable
              })
            }
          }
        } else {
          // 가용재고가 부족한 경우 - 시간순 재할당 수행
          console.log('⚠️ [가용재고 부족] 시간순 재할당 수행:', {
            productId: currentItem.product_id,
            color: currentItem.color,
            size: currentItem.size,
            requestedQuantity: quantityDiff,
            availableStock: availableStock || 0
          })
          
          console.log('🚨 [중요] 시간순 재할당이 필요한 상황입니다!')

          // 현재 주문의 생성 시간 조회
          const { data: currentOrder, error: orderError } = await supabase
            .from('orders')
            .select('created_at')
            .eq('id', orderId)
            .single()

          if (orderError) {
            console.error('현재 주문 조회 실패:', orderError)
            return NextResponse.json({ 
              error: '주문 정보 조회에 실패했습니다.' 
            }, { status: 500 })
          }

          // 시간순 재할당 수행
          console.log('🔄 [시간순 재할당] 함수 호출 시작...')
          const reallocationResult = await performTimeBasedReallocation(
            supabase,
            currentItem.product_id,
            currentItem.color,
            currentItem.size,
            orderId,
            currentOrder.created_at,
            quantityDiff
          )

          console.log('🔄 [시간순 재할당] 함수 호출 완료:', reallocationResult)

          if (!reallocationResult.success) {
            console.error('❌ [시간순 재할당] 실패:', reallocationResult.error)
            // 재할당 실패해도 가용재고만큼은 할당
            additionalShippable = Math.min(quantityDiff, availableStock || 0)
            console.log(`⚠️ [시간순 재할당 실패] 가용재고만큼 할당: ${additionalShippable}개`)
          } else {
            // 재할당 성공 - 요청한 수량만큼 할당 가능
            const reclaimedQuantity = reallocationResult.availableQuantity || 0
            additionalShippable = Math.min(quantityDiff, reclaimedQuantity + (availableStock || 0))
            
            console.log('✅ [시간순 재할당 성공] 늦은 주문들의 재고 회수 완료:', {
              productId: currentItem.product_id,
              color: currentItem.color,
              size: currentItem.size,
              requestedQuantity: quantityDiff,
              reclaimedQuantity: reclaimedQuantity,
              originalAvailableStock: availableStock || 0,
              totalAvailableNow: reclaimedQuantity + (availableStock || 0),
              additionalShippable: additionalShippable,
              affectedOrders: reallocationResult.affectedOrders
            })
            
            if (reallocationResult.affectedOrders && reallocationResult.affectedOrders.length > 0) {
              console.log('🎯 [재고 회수 완료] 영향받은 주문들:')
              reallocationResult.affectedOrders.forEach((affected: any) => {
                console.log(`  - ${affected.orderNumber}: ${affected.reclaimedQuantity}개 회수`)
              })
            }
          }
        }

        // 🎯 할당 수량 및 출고 수량 증가 (시간순 재할당으로 재고 확보 완료)
        if (additionalShippable > 0) {
          // 할당 수량과 출고 수량 모두 증가
          const currentAllocatedQuantity = (currentItem as any).allocated_quantity || 0
          newAllocatedQuantity = currentAllocatedQuantity + additionalShippable
          
          newShippedQuantity = currentShippedQuantity + additionalShippable
          shippedQuantityDiff = additionalShippable

          console.log('🚀 [자동 할당 및 출고] 수량 증가로 인한 자동 처리:', {
            productId: currentItem.product_id,
            color: currentItem.color,
            size: currentItem.size,
            oldAllocatedQuantity: currentAllocatedQuantity,
            newAllocatedQuantity: newAllocatedQuantity,
            oldShippedQuantity: currentShippedQuantity,
            newShippedQuantity: newShippedQuantity,
            additionalShippable: additionalShippable,
            availableStock: availableStock || 0,
            reclaimedFromTimeBasedReallocation: true
          })

          console.log('✅ [자동 할당 및 출고] 시간순 재할당 후 할당 및 출고 수량 증가 완료:', {
            productId: currentItem.product_id,
            color: currentItem.color,
            size: currentItem.size,
            allocatedQuantity: additionalShippable,
            newAllocatedQuantity: newAllocatedQuantity
          })
        } else {
          // 할당 불가능한 경우 기존 출고 수량 유지
          newShippedQuantity = currentShippedQuantity
          shippedQuantityDiff = 0
          
          console.log('❌ [할당 불가] 재고 부족으로 출고 수량 유지:', {
            productId: currentItem.product_id,
            color: currentItem.color,
            size: currentItem.size,
            requestedQuantity: quantityDiff,
            availableStock: availableStock || 0
          })
        }
      } else {
        // 수량 감소 - 할당 수량 및 출고 수량 직접 조정
        // 새 수량이 기존 출고 수량보다 작으면 출고 수량을 새 수량으로 조정
        newShippedQuantity = Math.min(currentShippedQuantity, quantity)
        shippedQuantityDiff = newShippedQuantity - currentShippedQuantity
        
        // 할당 수량도 새 수량으로 조정
        newAllocatedQuantity = Math.min(newAllocatedQuantity, quantity)

        console.log('✅ [관리자 수정] 수량 감소로 인한 할당 및 출고 수량 조정:', {
          productId: currentItem.product_id,
          color: currentItem.color,
          size: currentItem.size,
          oldAllocatedQuantity: (currentItem as any).allocated_quantity || 0,
          newAllocatedQuantity: newAllocatedQuantity,
          oldShippedQuantity: currentShippedQuantity,
          newShippedQuantity: newShippedQuantity,
          quantityReduction: Math.abs(quantityDiff),
          shippedQuantityDiff: shippedQuantityDiff
        })
      }
    }

    // 출고 수량 조정으로 인한 물리적 재고 처리
    if (shippedQuantityDiff !== 0) {
      if (shippedQuantityDiff > 0) {
                  // 출고 수량 증가 - 물리적 재고 차감
          const { data: deductResult, error: deductError } = await supabase
            .rpc('adjust_physical_stock', {
              p_product_id: currentItem.product_id,
              p_color: currentItem.color,
              p_size: currentItem.size,
              p_quantity_change: -(shippedQuantityDiff || 0), // 음수로 차감
              p_reason: `주문 수량 증가로 인한 자동 출고 처리 - 주문ID: ${orderId}`
            })

        if (deductError || !deductResult) {
          console.error('물리적 재고 차감 실패:', deductError)
          return NextResponse.json({ 
            error: '물리적 재고 차감에 실패했습니다.' 
          }, { status: 500 })
        }

        console.log('✅ [자동 출고] 물리적 재고 차감 완료:', {
          productId: currentItem.product_id,
          color: currentItem.color,
          size: currentItem.size,
                      deductedQuantity: shippedQuantityDiff || 0
        })
      } else {
        // 출고 수량 감소 - 물리적 재고 복원
        const restoreQuantity = Math.abs(shippedQuantityDiff || 0)
        
        const { data: restoreResult, error: restoreError } = await supabase
          .rpc('adjust_physical_stock', {
            p_product_id: currentItem.product_id,
            p_color: currentItem.color,
            p_size: currentItem.size,
            p_quantity_change: restoreQuantity,
            p_reason: `출고 수량 조정으로 인한 재고 복원 - 주문ID: ${orderId}`
          })

        if (restoreError || !restoreResult) {
          console.error('재고 복원 실패:', restoreError)
          return NextResponse.json({ 
            error: '재고 복원에 실패했습니다.' 
          }, { status: 500 })
        }

        console.log('✅ [관리자 수정] 출고 수량 조정으로 인한 재고 복원:', {
          productId: currentItem.product_id,
          color: currentItem.color,
          size: currentItem.size,
          restoredQuantity: restoreQuantity
        })

        // 🎯 재고 복원 후 자동 할당 처리
        if (restoreQuantity > 0) {
          console.log(`🔄 재고 복원 후 자동 할당 시작 - 상품: ${currentItem.product_id}, 색상: ${currentItem.color}, 사이즈: ${currentItem.size}`)
          console.log(`🔄 복원된 재고량: ${restoreQuantity}개`)
          
          // 자동 할당 전 현재 가용 재고 확인
          const { data: currentAvailableStock, error: currentStockError } = await supabase
            .rpc('calculate_available_stock', {
              p_product_id: currentItem.product_id,
              p_color: currentItem.color,
              p_size: currentItem.size
            })
          
          console.log(`🔄 자동 할당 전 가용 재고: ${currentAvailableStock}개`)
          
          const autoAllocationResult = await autoAllocateToUnshippedOrders(
            supabase,
            currentItem.product_id,
            currentItem.color,
            currentItem.size
          )
          
          console.log(`🔄 자동 할당 결과:`, autoAllocationResult)
          
          if (autoAllocationResult.success && autoAllocationResult.allocations && autoAllocationResult.allocations.length > 0) {
            console.log('✅ [자동 할당 완료] 복원된 재고로 다음 주문에 할당됨:', {
              productId: currentItem.product_id,
              color: currentItem.color,
              size: currentItem.size,
              restoredQuantity: restoreQuantity,
              allocations: autoAllocationResult.allocations
            })
            
            // 할당된 주문들 상세 정보 로그
            autoAllocationResult.allocations.forEach((allocation: any, index: number) => {
              console.log(`  ${index + 1}. 주문 ${allocation.orderNumber}: ${allocation.allocatedQuantity}개 할당 → 출고 수량: ${allocation.newShippedQuantity}개`)
            })
          } else {
            console.log('📋 [자동 할당] 할당할 미출고 주문이 없거나 실패:', autoAllocationResult.message)
          }
        }
      }
    }

    // 주문 아이템 업데이트
    const updateData = {
      quantity: quantity,
      allocated_quantity: newAllocatedQuantity,
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

    console.log('✅ [관리자 수정] 주문 아이템 수정 완료 (새로운 재고 구조 적용)')

    return NextResponse.json({
      success: true,
      message: '주문 아이템이 성공적으로 수정되었습니다.',
      data: {
        updatedItem,
        quantityDiff,
        shippedQuantityDiff
      }
    })

  } catch (error) {
    console.error('주문 아이템 수정 오류:', error)
    return NextResponse.json({ error: '주문 아이템 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 🎯 시간순 재할당 함수
async function performTimeBasedReallocation(
  supabase: any,
  productId: string,
  color: string,
  size: string,
  priorityOrderId: string,
  priorityOrderTime: string,
  requestedQuantity: number
) {
  try {
    console.log('🔄 [시간순 재할당] 시작:', {
      productId,
      color,
      size,
      priorityOrderId,
      priorityOrderTime,
      requestedQuantity
    })

    // 1. 현재 상품의 모든 할당된 주문들 조회 (시간순)
    const { data: allocatedOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        users!orders_user_id_fkey (
          company_name
        ),
        order_items!inner (
          id,
          product_id,
          color,
          size,
          quantity,
          shipped_quantity
        )
      `)
      .eq('order_items.product_id', productId)
      .eq('order_items.color', color)
      .eq('order_items.size', size)
      .in('status', ['pending', 'processing', 'confirmed', 'partial'])
      .gt('order_items.shipped_quantity', 0)  // 출고 수량이 있는 주문만
      .order('created_at', { ascending: true })

    if (ordersError) {
      console.error('할당된 주문 조회 실패:', ordersError)
      return { success: false, error: '할당된 주문 조회 실패' }
    }

    if (!allocatedOrders || allocatedOrders.length === 0) {
      console.log('할당된 주문이 없습니다.')
      return { success: true, availableQuantity: 0, affectedOrders: [] }
    }

    // 2. 우선순위 주문보다 늦은 주문들 찾기
    console.log(`🔍 [시간순 재할당] 전체 주문 ${allocatedOrders.length}개 조회`)
    console.log(`🔍 [시간순 재할당] 우선순위 주문 시간: ${priorityOrderTime}`)
    
    // 모든 주문의 시간 정보 로그
    allocatedOrders.forEach((order: any) => {
      const orderTime = new Date(order.created_at)
      const priorityTime = new Date(priorityOrderTime)
      const isLater = orderTime > priorityTime
      const companyName = order.users?.company_name || '알 수 없음'
      
      console.log(`📅 주문 ${order.order_number} (${companyName}): ${order.created_at} (${isLater ? '늦음' : '빠름'})`)
    })

    // 시간 비교를 더 명확하게 수행
    const laterOrders = allocatedOrders.filter((order: any) => {
      const orderTime = new Date(order.created_at)
      const priorityTime = new Date(priorityOrderTime)
      return orderTime > priorityTime && order.id !== priorityOrderId
    })

    console.log(`🔍 [시간순 재할당] 늦은 주문 ${laterOrders.length}개 발견`)
    
    if (laterOrders.length > 0) {
      console.log(`🔍 [시간순 재할당] 늦은 주문 목록:`)
      laterOrders.forEach((order: any) => {
        console.log(`  - ${order.order_number}: ${order.created_at}`)
      })
    }

    if (laterOrders.length === 0) {
      console.log('재할당할 늦은 주문이 없습니다.')
      return { success: true, availableQuantity: 0, affectedOrders: [] }
    }

    // 3. 늦은 주문들의 할당량 회수
    let reclaimedQuantity = 0
    const affectedOrders = []

    for (const laterOrder of laterOrders) {
      if (reclaimedQuantity >= requestedQuantity) break

      const orderItem = laterOrder.order_items.find((item: any) => 
        item.product_id === productId && 
        item.color === color && 
        item.size === size
      )

      if (!orderItem) continue

      const currentShipped = orderItem.shipped_quantity || 0
      const neededQuantity = requestedQuantity - reclaimedQuantity
      const reclaimableQuantity = Math.min(currentShipped, neededQuantity)

      if (reclaimableQuantity > 0) {
        // 출고 수량 및 할당 수량 감소
        const newShippedQuantity = currentShipped - reclaimableQuantity
        const currentAllocated = (orderItem as any).allocated_quantity || 0
        const newAllocatedQuantity = Math.max(0, currentAllocated - reclaimableQuantity)

        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            allocated_quantity: newAllocatedQuantity,
            shipped_quantity: newShippedQuantity
          })
          .eq('id', orderItem.id)

        if (updateError) {
          console.error('주문 아이템 업데이트 실패:', updateError)
          continue
        }

        // 물리적 재고 복원
        const { error: stockError } = await supabase
          .rpc('adjust_physical_stock', {
            p_product_id: productId,
            p_color: color,
            p_size: size,
            p_quantity_change: reclaimableQuantity, // 양수로 복원
            p_reason: `시간순 재할당으로 인한 재고 회수 - 주문번호: ${laterOrder.order_number}`
          })

        if (stockError) {
          console.error('물리적 재고 복원 실패:', stockError)
          // 롤백: 출고 수량 원복
          await supabase
            .from('order_items')
            .update({
              shipped_quantity: currentShipped
            })
            .eq('id', orderItem.id)
          continue
        }

        reclaimedQuantity += reclaimableQuantity
        affectedOrders.push({
          orderId: laterOrder.id,
          orderNumber: laterOrder.order_number,
          reclaimedQuantity: reclaimableQuantity,
          newShippedQuantity: newShippedQuantity
        })

        const companyName = laterOrder.users?.company_name || '알 수 없음'
        console.log(`✅ [재고 회수] ${laterOrder.order_number} (${companyName}): ${reclaimableQuantity}개 회수 (${currentShipped} → ${newShippedQuantity})`)
      }
    }

    console.log(`🎯 [시간순 재할당] 완료: ${reclaimedQuantity}개 회수, ${affectedOrders.length}개 주문 영향`)

    return {
      success: true,
      availableQuantity: reclaimedQuantity,
      affectedOrders: affectedOrders
    }

  } catch (error) {
    console.error('시간순 재할당 중 오류:', error)
    return { success: false, error: '시간순 재할당 중 오류 발생' }
  }
}

// 🎯 미출고 주문 자동 할당 함수
async function autoAllocateToUnshippedOrders(supabase: any, productId: string, color?: string, size?: string) {
  try {
    console.log(`🔍 미출고 주문 조회 시작 - 상품 ID: ${productId}, 색상: ${color}, 사이즈: ${size}`)
    
    // 1. 해당 상품의 미출고 주문 아이템 조회 (시간순)
    let query = supabase
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
        allocated_quantity,
        orders!order_items_order_id_fkey (
          id,
          order_number,
          status,
          created_at,
          users!orders_user_id_fkey (
            company_name
          )
        )
      `)
      .eq('product_id', productId)
      .in('orders.status', ['pending', 'processing', 'confirmed', 'partial'])

    // 색상/사이즈 필터링
    if (color) query = query.eq('color', color)
    if (size) query = query.eq('size', size)

    // 🔧 수정: 주문 시간순 정렬
    query = query.order('created_at', { ascending: true, foreignTable: 'orders' })

    const { data: unshippedItems, error: queryError } = await query

    if (queryError) {
      console.error('❌ 미출고 주문 조회 실패:', queryError)
      return { success: false, message: '미출고 주문 조회 실패' }
    }

    if (!unshippedItems || unshippedItems.length === 0) {
      console.log('📋 미출고 주문이 없습니다.')
      return { success: true, message: '미출고 주문이 없습니다.', allocations: [] }
    }

    // 실제 미출고 수량이 있는 아이템만 필터링 후 시간순 재정렬
    const itemsWithUnshipped = unshippedItems
      .filter((item: any) => {
        const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
        return unshippedQuantity > 0
      })
      .sort((a: any, b: any) => {
        // 🔧 수정: 필터링 후 시간순으로 재정렬
        return new Date(a.orders.created_at).getTime() - new Date(b.orders.created_at).getTime()
      })

    console.log(`📋 미출고 아이템 ${itemsWithUnshipped.length}개 발견`)
    
    // 시간순 정렬 디버깅 로그
    console.log(`📅 시간순 정렬 확인:`)
    itemsWithUnshipped.forEach((item: any, index: number) => {
      console.log(`  ${index + 1}. ${item.orders.order_number} (${item.orders.users?.company_name}): ${item.orders.created_at}`)
    })

    if (itemsWithUnshipped.length === 0) {
      return { success: true, message: '할당할 미출고 주문이 없습니다.', allocations: [] }
    }

    // 2. 현재 가용 재고 조회
    const { data: availableStock, error: stockError } = await supabase
      .rpc('calculate_available_stock', {
        p_product_id: productId,
        p_color: color,
        p_size: size
      })

    if (stockError) {
      console.error('❌ 가용 재고 조회 실패:', stockError)
      return { success: false, message: '가용 재고 조회 실패' }
    }

    console.log(`📦 가용 재고: ${availableStock}개`)

    if (availableStock <= 0) {
      return { success: true, message: '가용 재고가 없습니다.', allocations: [] }
    }

    // 3. 시간순으로 재고 할당
    let remainingStock = availableStock
    const allocations = []

    for (const item of itemsWithUnshipped) {
      if (remainingStock <= 0) break

      const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
      const allocateQuantity = Math.min(unshippedQuantity, remainingStock)

      if (allocateQuantity > 0) {
        // 할당 수량 및 출고 수량 업데이트
        const newAllocatedQuantity = (item.allocated_quantity || 0) + allocateQuantity
        const newShippedQuantity = (item.shipped_quantity || 0) + allocateQuantity
        
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            allocated_quantity: newAllocatedQuantity,
            shipped_quantity: newShippedQuantity
          })
          .eq('id', item.id)

        if (updateError) {
          console.error('❌ 주문 아이템 업데이트 실패:', updateError)
          continue
        }

        // 물리적 재고 차감
        const orderNumber = item.orders?.order_number || `주문ID-${item.order_id}`
        const { error: stockError } = await supabase
          .rpc('adjust_physical_stock', {
            p_product_id: productId,
            p_color: color,
            p_size: size,
            p_quantity_change: -allocateQuantity,
            p_reason: `자동 할당 - 주문번호: ${orderNumber}`
          })

        if (stockError) {
          console.error('❌ 물리적 재고 차감 실패:', stockError)
          // 롤백: 할당 수량 원복
          await supabase
            .from('order_items')
            .update({
              allocated_quantity: item.allocated_quantity || 0,
              shipped_quantity: item.shipped_quantity || 0
            })
            .eq('id', item.id)
          continue
        }

        allocations.push({
          orderId: item.order_id,
          orderNumber: orderNumber,
          companyName: item.orders?.users?.company_name || '알 수 없음',
          allocatedQuantity: allocateQuantity,
          newShippedQuantity: newShippedQuantity
        })

        remainingStock -= allocateQuantity
        console.log(`✅ 할당 완료: ${orderNumber} - ${allocateQuantity}개`)
      }
    }

    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocatedQuantity, 0)
    
    console.log(`✅ 자동 할당 완료: ${totalAllocated}개 할당, ${allocations.length}개 주문 처리`)

    return {
      success: true,
      message: `${totalAllocated}개 자동 할당 완료`,
      allocations,
      totalAllocated
    }

  } catch (error) {
    console.error('❌ 자동 할당 처리 중 오류:', error)
    return { success: false, message: '자동 할당 처리 중 오류 발생' }
  }
}

 