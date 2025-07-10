import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { randomUUID } from 'crypto'
import { getKoreaTime } from '@/shared/lib/utils'

// 발주서 수정
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params
    const supabase = await createClient()

    const body = await request.json()
    const { items, shipping_address_id, shipping_address, shipping_postal_code, shipping_name, shipping_phone } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: '발주 상품이 없습니다.' }, { status: 400 })
    }

    // 기존 주문 확인
    const { data: existingOrder, error: orderCheckError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderCheckError || !existingOrder) {
      return NextResponse.json({ success: false, message: '발주서를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 업무일 기준 당일 생성된 발주서만 수정 가능 (전일 15:00 ~ 당일 14:59)
    const now = new Date()
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const orderTime = new Date(existingOrder.created_at)
    const orderKoreaTime = new Date(orderTime.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    
    // 현재 업무일 범위 계산
    let workdayStart: Date
    let workdayEnd: Date
    
    if (koreaTime.getHours() >= 15) {
      // 현재 시각이 15시 이후면 새로운 업무일 (당일 15:00 ~ 익일 14:59)
      workdayStart = new Date(koreaTime)
      workdayStart.setHours(15, 0, 0, 0)
      
      workdayEnd = new Date(koreaTime)
      workdayEnd.setDate(workdayEnd.getDate() + 1)
      workdayEnd.setHours(14, 59, 59, 999)
    } else {
      // 현재 시각이 15시 이전이면 현재 업무일 (전일 15:00 ~ 당일 14:59)
      workdayStart = new Date(koreaTime)
      workdayStart.setDate(workdayStart.getDate() - 1)
      workdayStart.setHours(15, 0, 0, 0)
      
      workdayEnd = new Date(koreaTime)
      workdayEnd.setHours(14, 59, 59, 999)
    }
    
    // 주문이 현재 업무일 범위에 있는지 확인
    const isCurrentWorkday = orderKoreaTime >= workdayStart && orderKoreaTime <= workdayEnd
    
    if (!isCurrentWorkday) {
      return NextResponse.json({
        success: false,
        message: `당일 생성된 발주서만 수정할 수 있습니다. (업무일 기준: ${workdayStart.toLocaleDateString('ko-KR')} 15:00 ~ ${workdayEnd.toLocaleDateString('ko-KR')} 14:59)`
      }, { status: 400 })
    }
    
    // 현재 업무일의 수정 마감시간 (당일 14:59)
    const editCutoffTime = new Date(workdayEnd)
    
    if (koreaTime > editCutoffTime) {
      return NextResponse.json({
        success: false,
        message: `업무일 기준 오후 3시 이후에는 발주서를 수정할 수 없습니다. (현재 시각: ${koreaTime.toLocaleString('ko-KR')})`
      }, { status: 400 })
    }

    // 기존 주문 상품 조회 (재고 이력 복원용)
    const { data: existingItems, error: existingItemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)

    if (existingItemsError) {
      console.error('기존 주문 상품 조회 오류:', existingItemsError)
      return NextResponse.json({ success: false, message: '기존 주문 상품 조회에 실패했습니다.' }, { status: 500 })
    }

    // 총 금액 계산
    const totalAmount = items.reduce((sum: number, item: any) => {
      const supplyAmount = item.unit_price * item.quantity
      const vat = Math.floor(supplyAmount * 0.1)
      return sum + supplyAmount + vat
    }, 0)

    // 주문 업데이트
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({
        total_amount: totalAmount,
        shipping_address: shipping_address,
        shipping_postal_code: shipping_postal_code,
        shipping_name: shipping_name,
        shipping_phone: shipping_phone
      })
      .eq('id', orderId)

    if (orderUpdateError) {
      console.error('주문 업데이트 오류:', orderUpdateError)
      return NextResponse.json({ success: false, message: '주문 업데이트에 실패했습니다.' }, { status: 500 })
    }

    // 기존 재고 이력 복원 (기존 발주 취소)
    if (existingItems) {
      for (const item of existingItems) {
        if (item.product_id && item.quantity !== 0) {
          // 기존 발주량을 반대로 적용하여 재고 복원
          const adjustmentQuantity = -item.quantity
          const adjustmentType = item.quantity > 0 ? 'outbound' : 'inbound'
          
          await supabase
            .from('inventory_history')
            .insert({
              id: randomUUID(),
              product_id: item.product_id,
              quantity: adjustmentQuantity,
              type: adjustmentType,
              reason: `발주 수정 - 기존 발주 취소 (${existingOrder.order_number})`,
              reference_id: orderId,
              reference_type: 'order_update_cancel'
            })
        }
      }
    }

    // 기존 주문 상품 삭제
    const { error: deleteItemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId)

    if (deleteItemsError) {
      console.error('기존 주문 상품 삭제 오류:', deleteItemsError)
      return NextResponse.json({ success: false, message: '기존 주문 상품 삭제에 실패했습니다.' }, { status: 500 })
    }

    // 기존 반품명세서 삭제 (반품 접수 수정 시)
    const { error: deleteReturnError } = await supabase
      .from('return_statements')
      .delete()
      .eq('order_id', orderId)

    if (deleteReturnError) {
      console.error('기존 반품명세서 삭제 오류:', deleteReturnError)
      // 반품명세서 삭제 실패해도 수정은 진행
    }

    // 새로운 주문 상품 생성 (양수 수량만)
    const positiveItems = items.filter((item: any) => item.quantity > 0)
    
    if (positiveItems.length > 0) {
      const orderItems = positiveItems.map((item: any) => ({
        order_id: orderId,
        product_id: item.product_id,
        product_name: item.product_name,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        console.error('주문 상품 생성 오류:', itemsError)
        return NextResponse.json({ success: false, message: '주문 상품 생성에 실패했습니다.' }, { status: 500 })
      }
    }

    // 새로운 재고 이력 생성 (양수 수량만)
    for (const item of positiveItems) {
      if (item.product_id && item.quantity > 0) {
        await supabase
          .from('inventory_history')
          .insert({
            id: randomUUID(),
            product_id: item.product_id,
            quantity: item.quantity,
            type: 'outbound',
            reason: `발주 수정 - 새 발주 적용 (${existingOrder.order_number})`,
            reference_id: orderId,
            reference_type: 'order_update_new'
          })
      }
    }

    // 음수 수량 항목이 있으면 반품명세서 생성
    const negativeItems = items.filter((item: any) => item.quantity < 0)
    console.log(`🔍 [수정] 반품 처리 시작 - 전체 아이템 수: ${items.length}, 음수 아이템 수: ${negativeItems.length}`)
    console.log(`🔍 [수정] 음수 아이템 상세:`, negativeItems)
    
    if (negativeItems.length > 0) {
      console.log(`✅ [수정] 반품명세서 생성 시작 - 음수 아이템 ${negativeItems.length}개`)
      
      // 사용자 정보 조회
      console.log(`👤 [수정] 사용자 정보 조회 시작 - user_id: ${existingOrder.user_id}`)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_name')
        .eq('id', existingOrder.user_id)
        .single()

      if (userError) {
        console.error('❌ [수정] 사용자 정보 조회 오류:', userError)
      } else {
        console.log(`✅ [수정] 사용자 정보 조회 성공:`, userData)
      }

      const companyName = userData?.company_name || existingOrder.shipping_name || ''
      console.log(`🏢 [수정] 회사명 결정: ${companyName}`)

      // 반품명세서 번호 생성 (RO-YYYYMMDD-XXXX)
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
      const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase()
      const returnStatementNumber = `RO-${dateStr}-${randomStr}`
      console.log(`📋 [수정] 반품명세서 번호 생성: ${returnStatementNumber}`)

      const returnItems = negativeItems.map((item: any) => {
        const quantity = Math.abs(item.quantity)
        const supplyAmount = quantity * item.unit_price
        const vat = Math.floor(supplyAmount * 0.1)
        const totalAmountWithVat = supplyAmount + vat
        
        return {
          product_id: item.product_id,
          product_name: item.product_name,
          color: item.color,
          size: item.size,
          quantity: quantity,
          unit_price: item.unit_price,
          total_price: totalAmountWithVat // VAT 포함 금액으로 필드명 일치
        }
      })
      console.log(`📦 [수정] 반품 아이템 변환 완료:`, returnItems)

      const returnStatementData = {
        id: randomUUID(),
        statement_number: returnStatementNumber,
        order_id: orderId,
        company_name: companyName,
        return_reason: '발주서 수정 시 반품 요청',
        return_type: 'customer_change',
        items: returnItems,
        total_amount: returnItems.reduce((sum: number, item: any) => sum + item.total_price, 0),
        refund_amount: returnItems.reduce((sum: number, item: any) => sum + item.total_price, 0),
        status: 'pending',
        created_at: getKoreaTime()
      }
      console.log(`💾 [수정] 반품명세서 데이터 준비 완료:`, returnStatementData)

      const { error: returnError } = await supabase
        .from('return_statements')
        .insert(returnStatementData)

      if (returnError) {
        console.error('❌ [수정] 반품명세서 생성 오류:', returnError)
        console.error('❌ [수정] 반품명세서 생성 실패 데이터:', returnStatementData)
        return NextResponse.json({ success: false, message: '반품명세서 생성에 실패했습니다.' }, { status: 500 })
      }

      console.log(`✅ [수정] 반품명세서 생성 완료 - 번호: ${returnStatementNumber}, 항목 수: ${negativeItems.length}`)
    } else {
      console.log(`ℹ️ [수정] 반품 아이템 없음 - 반품명세서 생성 건너뜀`)
    }

    // 시간순 재고 할당 처리 (어드민 주문관리와 동일한 로직)
    console.log('🔄 [수정] 시간순 재고 할당 시작')
    
    // 1. 수정된 주문의 각 아이템에 대해 재할당 수행
    if (positiveItems.length > 0) {
      console.log(`📊 [수정] 재할당 대상 아이템: ${positiveItems.length}개`)
      
      for (const item of positiveItems) {
        console.log(`🔄 [수정] 아이템 재할당 시작:`, {
          productId: item.product_id,
          productName: item.product_name,
          color: item.color,
          size: item.size,
          quantity: item.quantity
        })
        
        // 기존 아이템 정보 찾기 (삭제되기 전 existingItems에서)
        const existingItem = existingItems?.find(existing => 
          existing.product_id === item.product_id &&
          existing.color === item.color &&
          existing.size === item.size
        )
        
        if (!existingItem) {
          console.log(`ℹ️ [수정] 기존 아이템 없음 - 새로 생성됨:`, {
            productId: item.product_id,
            color: item.color,
            size: item.size
          })
          
          // 새 아이템인 경우 - 가용재고에서만 할당
          console.log(`ℹ️ [수정] 새 아이템 - 가용재고에서만 할당`)
          
          // 가용 재고 확인
          const { data: availableStock, error: stockError } = await supabase
            .rpc('calculate_available_stock', {
              p_product_id: item.product_id,
              p_color: item.color,
              p_size: item.size
            })
          
          const allocatedQuantity = Math.min(item.quantity, availableStock || 0)
          
          console.log(`📊 [수정] 새 아이템 가용재고만 할당:`, {
            productId: item.product_id,
            color: item.color,
            size: item.size,
            requestedQuantity: item.quantity,
            availableStock: availableStock || 0,
            allocatedQuantity
          })
          
          // 재고 할당 수행
          if (allocatedQuantity > 0) {
            const { error: allocationError } = await supabase
              .rpc('allocate_stock', {
                p_product_id: item.product_id,
                p_quantity: allocatedQuantity,
                p_color: item.color,
                p_size: item.size
              })
            
            if (!allocationError) {
              // 주문 아이템 업데이트
              await supabase
                .from('order_items')
                .update({
                  allocated_quantity: allocatedQuantity,
                  shipped_quantity: allocatedQuantity
                })
                .eq('order_id', orderId)
                .eq('product_id', item.product_id)
                .eq('color', item.color)
                .eq('size', item.size)
              
              console.log(`✅ [수정] 새 아이템 할당 완료:`, {
                productId: item.product_id,
                color: item.color,
                size: item.size,
                allocatedQuantity
              })
            } else {
              console.error(`❌ [수정] 새 아이템 할당 실패:`, allocationError)
            }
          }
          continue
        }
        
        // 기존 아이템 수정인 경우
        if (existingItem.quantity < item.quantity) {
          // 수량 증가 - 가용재고에서만 추가 할당
          const quantityDiff = item.quantity - existingItem.quantity
          const currentShippedQuantity = existingItem.shipped_quantity || 0
          
          console.log(`📈 [수량 증가] 가용재고에서만 추가 할당:`, {
            productId: item.product_id,
            color: item.color,
            size: item.size,
            oldQuantity: existingItem.quantity,
            newQuantity: item.quantity,
            quantityDiff: quantityDiff,
            currentShippedQuantity: currentShippedQuantity
          })

          // 가용재고 확인
          const { data: availableStock, error: stockError } = await supabase
            .rpc('calculate_available_stock', {
              p_product_id: item.product_id,
              p_color: item.color,
              p_size: item.size
            })

          console.log('🔍 [수량 증가] 가용 재고 확인 결과:', {
            productId: item.product_id,
            color: item.color,
            size: item.size,
            availableStock: availableStock,
            stockError: stockError,
            quantityDiff: quantityDiff
          })

          // 가용재고에서만 할당 (다른 주문 할당재고 건드리지 않음)
          const totalUnshipped = item.quantity - currentShippedQuantity
          const maxAllocatable = Math.min(totalUnshipped, availableStock || 0)
          
          console.log('📊 [가용재고만 할당] 미출고 수량 할당:', {
            productId: item.product_id,
            color: item.color,
            size: item.size,
            totalQuantity: item.quantity,
            currentShippedQuantity: currentShippedQuantity,
            totalUnshipped: totalUnshipped,
            availableStock: availableStock,
            maxAllocatable: maxAllocatable
          })

          let additionalShippable = 0

          if (maxAllocatable > 0) {
            // 전체 미출고 수량에 대해 재고 할당 수행
            const { data: allocationResult, error: allocationError } = await supabase
              .rpc('allocate_stock', {
                p_product_id: item.product_id,
                p_quantity: maxAllocatable,
                p_color: item.color,
                p_size: item.size
              })

            if (allocationError || !allocationResult) {
              console.error('❌ [재고 할당 실패]:', allocationError)
              additionalShippable = 0
            } else {
              additionalShippable = maxAllocatable
              console.log('✅ [재고 할당 성공] 전체 미출고 수량 할당 완료:', {
                productId: item.product_id,
                color: item.color,
                size: item.size,
                allocatedQuantity: maxAllocatable,
                newTotalShipped: currentShippedQuantity + maxAllocatable
              })
            }
          } else {
            console.log('📊 [가용재고 부족] 가용재고만큼만 할당:', {
              productId: item.product_id,
              color: item.color,
              size: item.size,
              requestedQuantity: quantityDiff,
              availableStock: availableStock || 0
            })
          }

          // 🎯 할당 수량 및 출고 수량 증가 (가용재고에서만 할당 완료)
          if (additionalShippable > 0) {
            // 새로운 주문 아이템 업데이트 (이미 생성된 아이템의 shipped_quantity 업데이트)
            const { error: updateError } = await supabase
              .from('order_items')
              .update({
                shipped_quantity: currentShippedQuantity + additionalShippable,
                allocated_quantity: (existingItem.allocated_quantity || 0) + additionalShippable
              })
              .eq('order_id', orderId)
              .eq('product_id', item.product_id)
              .eq('color', item.color)
              .eq('size', item.size)

            if (updateError) {
              console.error('❌ [주문 아이템 업데이트 실패]:', updateError)
            } else {
              console.log('✅ [자동 할당 및 출고] 수량 증가로 인한 자동 처리 완료:', {
                productId: item.product_id,
                color: item.color,
                size: item.size,
                oldShippedQuantity: currentShippedQuantity,
                newShippedQuantity: currentShippedQuantity + additionalShippable,
                additionalShippable: additionalShippable
              })
            }
          } else {
            console.log('❌ [할당 불가] 재고 부족으로 출고 수량 유지:', {
              productId: item.product_id,
              color: item.color,
              size: item.size,
              requestedQuantity: quantityDiff,
              availableStock: availableStock || 0
            })
          }
        } else if (existingItem.quantity > item.quantity) {
          // 수량 감소 - 재고 복원 및 자동 할당
          const quantityDiff = existingItem.quantity - item.quantity
          const currentShippedQuantity = existingItem.shipped_quantity || 0
          const currentAllocatedQuantity = existingItem.allocated_quantity || 0
          
          // 새 수량이 기존 출고 수량보다 작으면 출고 수량을 새 수량으로 조정
          const newShippedQuantity = Math.min(currentShippedQuantity, item.quantity)
          const shippedQuantityDiff = newShippedQuantity - currentShippedQuantity
          
          // 할당 수량도 새 수량으로 조정
          const newAllocatedQuantity = Math.min(currentAllocatedQuantity, item.quantity)

          console.log('✅ [수량 감소] 할당 및 출고 수량 조정:', {
            productId: item.product_id,
            color: item.color,
            size: item.size,
            oldQuantity: existingItem.quantity,
            newQuantity: item.quantity,
            oldAllocatedQuantity: currentAllocatedQuantity,
            newAllocatedQuantity: newAllocatedQuantity,
            oldShippedQuantity: currentShippedQuantity,
            newShippedQuantity: newShippedQuantity,
            quantityReduction: quantityDiff,
            shippedQuantityDiff: shippedQuantityDiff
          })

          // 주문 아이템 업데이트
          const { error: updateError } = await supabase
            .from('order_items')
            .update({
              shipped_quantity: newShippedQuantity,
              allocated_quantity: newAllocatedQuantity
            })
            .eq('order_id', orderId)
            .eq('product_id', item.product_id)
            .eq('color', item.color)
            .eq('size', item.size)

          if (updateError) {
            console.error('❌ [주문 아이템 업데이트 실패]:', updateError)
          } else {
            console.log('✅ [수량 감소] 주문 아이템 업데이트 완료')

            // 출고 수량 감소 시 물리적 재고 복원
            if (shippedQuantityDiff < 0) {
              const restoreQuantity = Math.abs(shippedQuantityDiff)
              
              const { data: restoreResult, error: restoreError } = await supabase
                .rpc('adjust_physical_stock', {
                  p_product_id: item.product_id,
                  p_color: item.color,
                  p_size: item.size,
                  p_quantity_change: restoreQuantity,
                  p_reason: `출고 수량 조정으로 인한 재고 복원 - 주문ID: ${orderId}`
                })

              if (restoreError || !restoreResult) {
                console.error('재고 복원 실패:', restoreError)
              } else {
                console.log('✅ [수량 감소] 출고 수량 조정으로 인한 재고 복원:', {
                  productId: item.product_id,
                  color: item.color,
                  size: item.size,
                  restoredQuantity: restoreQuantity
                })

                // 복원된 재고로 다른 주문에 자동 할당
                const autoAllocationResult = await autoAllocateToUnshippedOrders(
                  supabase,
                  item.product_id,
                  item.color,
                  item.size
                )
                
                if (autoAllocationResult.success && autoAllocationResult.allocations && autoAllocationResult.allocations.length > 0) {
                  console.log('✅ [자동 할당 완료] 복원된 재고로 다음 주문에 할당됨:', {
                    productId: item.product_id,
                    color: item.color,
                    size: item.size,
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
        }
        
        // 주문 아이템은 이미 위에서 업데이트되었으므로 추가 업데이트 불필요
        console.log(`✅ [수정] 아이템 처리 완료:`, {
          productId: item.product_id,
          color: item.color,
          size: item.size
        })
      }
    }

    console.log('✅ [수정] 시간순 재고 할당 완료')

    // 수정된 주문의 할당 상태 계산
    const { data: updatedOrderItems, error: updatedOrderError } = await supabase
      .from('order_items')
      .select('quantity, shipped_quantity, allocated_quantity')
      .eq('order_id', orderId)

    let updatedOrderStatus = 'pending'
    if (!updatedOrderError && updatedOrderItems) {
      const allFullyAllocated = updatedOrderItems.every(item => 
        (item.shipped_quantity || 0) >= item.quantity
      )
      const hasPartialAllocation = updatedOrderItems.some(item => 
        (item.shipped_quantity || 0) > 0 && (item.shipped_quantity || 0) < item.quantity
      )
      
      if (allFullyAllocated) {
        updatedOrderStatus = 'processing' // 작업중 (전량 할당 완료)
      } else if (hasPartialAllocation || updatedOrderItems.some(item => (item.shipped_quantity || 0) > 0)) {
        updatedOrderStatus = 'processing' // 작업중 (부분 할당)
      }
    }

    // 주문 타입 및 상태 업데이트
    let orderType = 'purchase'
    if (positiveItems.length === 0 && negativeItems.length > 0) {
      orderType = 'return_only'
      updatedOrderStatus = 'processing' // 반품만 있는 경우 처리중
    } else if (positiveItems.length > 0 && negativeItems.length > 0) {
      orderType = 'mixed'
    }

    await supabase
      .from('orders')
      .update({
        order_type: orderType,
        status: updatedOrderStatus,
        updated_at: getKoreaTime()
      })
      .eq('id', orderId)

    console.log(`🔄 [수정] 주문 상태 업데이트 완료 - 타입: ${orderType}, 상태: ${updatedOrderStatus}`)

    return NextResponse.json({ success: true, message: '발주서가 수정되었습니다.' })
  } catch (error) {
    console.error('발주서 수정 오류:', error)
    return NextResponse.json({ success: false, message: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

// 🎯 시간순 재할당 함수 (어드민 주문관리와 완전히 동일)
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

// 🎯 미출고 주문 자동 할당 함수 (어드민과 동일)
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

    query = query.order('orders(created_at)', { ascending: true })

    const { data: unshippedItems, error: queryError } = await query

    if (queryError) {
      console.error('❌ 미출고 주문 조회 실패:', queryError)
      return { success: false, message: '미출고 주문 조회 실패' }
    }

    if (!unshippedItems || unshippedItems.length === 0) {
      console.log('📋 미출고 주문이 없습니다.')
      return { success: true, message: '미출고 주문이 없습니다.', allocations: [] }
    }

    // 실제 미출고 수량이 있는 아이템만 필터링
    const itemsWithUnshipped = unshippedItems.filter((item: any) => {
      const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
      return unshippedQuantity > 0
    })

    console.log(`📋 미출고 아이템 ${itemsWithUnshipped.length}개 발견`)

    if (itemsWithUnshipped.length === 0) {
      return { success: true, message: '미출고 수량이 있는 주문이 없습니다.', allocations: [] }
    }

    // 2. 현재 가용 재고 조회
    const { data: availableStock, error: stockError } = await supabase
      .rpc('calculate_available_stock', {
        p_product_id: productId,
        p_color: color,
        p_size: size
      })

    if (stockError || !availableStock || availableStock <= 0) {
      console.log('📋 가용 재고가 없습니다.')
      return { success: true, message: '가용 재고가 없습니다.', allocations: [] }
    }

    console.log(`📦 가용 재고: ${availableStock}개`)

    // 3. 시간순으로 자동 할당
    const allocations = []
    let remainingStock = availableStock

    for (const item of itemsWithUnshipped) {
      if (remainingStock <= 0) break

      const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
      const allocateQuantity = Math.min(unshippedQuantity, remainingStock)

      if (allocateQuantity > 0) {
        // 재고 할당
        const { error: allocationError } = await supabase
          .rpc('allocate_stock', {
            p_product_id: productId,
            p_quantity: allocateQuantity,
            p_color: color,
            p_size: size
          })

        if (allocationError) {
          console.error('❌ 재고 할당 실패:', allocationError)
          continue
        }

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

        remainingStock -= allocateQuantity
        allocations.push({
          orderId: item.order_id,
          orderNumber: item.orders?.order_number || `주문ID-${item.order_id}`,
          allocatedQuantity: allocateQuantity,
          newShippedQuantity: newShippedQuantity
        })

        console.log(`✅ 자동 할당 완료 - 주문: ${item.orders?.order_number}, 할당량: ${allocateQuantity}개`)
      }
    }

    return {
      success: true,
      message: `${allocations.length}개 주문에 자동 할당 완료`,
      allocations: allocations
    }

  } catch (error) {
    console.error('자동 할당 중 오류:', error)
    return { success: false, message: '자동 할당 중 오류 발생' }
  }
} 