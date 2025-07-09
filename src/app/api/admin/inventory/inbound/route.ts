import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { product_id, quantity, reason, color, size } = body

    if (!product_id || !quantity || quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: '상품 ID와 유효한 수량을 입력해주세요.'
      }, { status: 400 })
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({
        success: false,
        error: '입고 사유를 입력해주세요.'
      }, { status: 400 })
    }

    // 상품 정보 조회
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, code, stock_quantity, inventory_options')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 재고 업데이트
    if (product.inventory_options && Array.isArray(product.inventory_options) && color && size) {
      // 옵션별 재고 업데이트
      const updatedOptions = product.inventory_options.map((option: any) => {
        if (option.color === color && option.size === size) {
          return {
            ...option,
            stock_quantity: (option.stock_quantity || 0) + quantity
          }
        }
        return option
      })

      // 전체 재고량 재계산
      const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)

      const { error: updateError } = await supabase
        .from('products')
        .update({
          inventory_options: updatedOptions,
          stock_quantity: totalStock,
          updated_at: getKoreaTime()
        })
        .eq('id', product_id)

      if (updateError) {
        console.error('Product update error:', updateError)
        return NextResponse.json({
          success: false,
          error: '재고 업데이트에 실패했습니다.'
        }, { status: 500 })
      }
    } else {
      // 전체 재고 업데이트
      const newStock = (product.stock_quantity || 0) + quantity

      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock_quantity: newStock,
          updated_at: getKoreaTime()
        })
        .eq('id', product_id)

      if (updateError) {
        console.error('Product update error:', updateError)
        return NextResponse.json({
          success: false,
          error: '재고 업데이트에 실패했습니다.'
        }, { status: 500 })
      }
    }

    // 재고 변동 이력 기록
    const movementData = {
      product_id,
      movement_type: 'inbound',
      quantity: quantity,
      color: color || null,
      size: size || null,
      notes: `수동 입고 등록${color && size ? ` (${color}/${size})` : ''} - ${reason.trim()}`,
      created_at: getKoreaTime()
    }
    
    console.log(`재고 변동 이력 기록 시도:`, movementData)
    
    const { data: movementResult, error: movementError } = await supabase
      .from('stock_movements')
      .insert(movementData)
      .select()

    if (movementError) {
      console.error('Stock movement error:', movementError)
      console.error('Movement data:', movementData)
      
      // 재고 변동 이력 기록 실패 시 오류 반환 (재고 업데이트는 이미 완료되었으므로 롤백 필요)
      
      // 재고 롤백 시도
      try {
        if (product.inventory_options && Array.isArray(product.inventory_options) && color && size) {
          // 옵션별 재고 롤백
          const rollbackOptions = product.inventory_options.map((option: any) => {
            if (option.color === color && option.size === size) {
              return {
                ...option,
                stock_quantity: (option.stock_quantity || 0) // 원래 수량으로 복원
              }
            }
            return option
          })

          const rollbackTotalStock = rollbackOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)

          await supabase
            .from('products')
            .update({
              inventory_options: rollbackOptions,
              stock_quantity: rollbackTotalStock,
              updated_at: getKoreaTime()
            })
            .eq('id', product_id)
        } else {
          // 전체 재고 롤백
          await supabase
            .from('products')
            .update({
              stock_quantity: product.stock_quantity, // 원래 수량으로 복원
              updated_at: getKoreaTime()
            })
            .eq('id', product_id)
        }
      } catch (rollbackError) {
        console.error('재고 롤백 실패:', rollbackError)
      }
      
      return NextResponse.json({
        success: false,
        error: `재고 변동 이력 기록에 실패했습니다: ${movementError.message}`,
        details: movementError
      }, { status: 500 })
    } else {
      console.log(`재고 변동 이력 기록 성공:`, movementResult)
    }

    // 🎯 새로운 기능: 미출고 주문 자동 할당 처리
    console.log(`🔄 자동 할당 시작 - 상품 ID: ${product_id}, 색상: ${color}, 사이즈: ${size}`)
    const allocationResults = await autoAllocateToUnshippedOrders(supabase, product_id, color, size)
    console.log(`🔄 자동 할당 결과:`, allocationResults)
    
    return NextResponse.json({
      success: true,
      message: `${quantity}개 입고가 완료되었습니다.`,
      data: {
        product_id,
        product_name: product.name,
        quantity,
        reason: reason.trim(),
        color,
        size,
        allocations: allocationResults,
        allocation_message: allocationResults.message || '자동 할당 정보 없음'
      }
    })

  } catch (error) {
    console.error('Inbound registration error:', error)
    return NextResponse.json({
      success: false,
      error: '입고 등록 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 🎯 미출고 주문 자동 할당 함수
async function autoAllocateToUnshippedOrders(supabase: any, productId: string, color?: string, size?: string) {
  try {
    console.log(`🔄 자동 할당 시작 - 상품: ${productId}, 색상: ${color}, 사이즈: ${size}`)
    
    // 1. 해당 상품의 미출고 주문 아이템 조회 (시간순)
    // 출고 완료되지 않은 모든 주문 상태 포함
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
      .not('orders.status', 'in', '(shipped,delivered,cancelled,returned,refunded)') // 출고/배송 완료 및 취소/반품 제외
      .order('id', { ascending: true }) // order_items ID로 정렬 (시간순과 유사)

    // 색상/사이즈 옵션이 있는 경우 필터링
    if (color && size) {
      orderItemsQuery = orderItemsQuery
        .eq('color', color)
        .eq('size', size)
    }

    // 실제 미출고 수량이 있는 아이템만 조회 (JavaScript에서 필터링)
    // orderItemsQuery = orderItemsQuery.lt('shipped_quantity', 'quantity')

    console.log(`🔍 미출고 주문 조회 시작 - 상품: ${productId}, 색상: ${color}, 사이즈: ${size}`)
    const { data: orderItems, error: itemsError } = await orderItemsQuery

    if (itemsError) {
      console.error('❌ 미출고 주문 조회 실패:', itemsError)
      return { success: false, error: '미출고 주문 조회 실패' }
    }

    console.log(`📊 미출고 주문 조회 결과:`, {
      total_items: orderItems?.length || 0,
      items_preview: orderItems?.slice(0, 3).map((item: any) => ({
        order_number: item.orders.order_number,
        product_name: item.product_name,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        shipped_quantity: item.shipped_quantity,
        remaining: item.quantity - (item.shipped_quantity || 0),
        order_status: item.orders.status,
        company: item.orders.users.company_name
      }))
    })

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

    console.log(`📋 미출고 주문 ${unshippedItems.length}건 발견`)

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
      // 옵션별 재고 확인
      const targetOption = currentProduct.inventory_options.find((opt: any) => 
        opt.color === color && opt.size === size
      )
      availableStock = targetOption ? targetOption.stock_quantity : 0
      console.log(`📦 옵션별 재고 (${color}/${size}):`, availableStock)
    } else {
      // 전체 재고 확인
      availableStock = currentProduct.stock_quantity || 0
      console.log(`📦 전체 재고:`, availableStock)
    }

    console.log(`📦 현재 가용 재고: ${availableStock}`)

    if (availableStock <= 0) {
      console.log('❌ 할당할 재고가 없습니다.')
      return { success: true, message: '할당할 재고가 없습니다.', allocations: [] }
    }

    // 3. 시간순으로 재고 할당
    const allocations = []
    let remainingStock = availableStock
    
    console.log(`🔄 재고 할당 시작 - 총 ${unshippedItems.length}개 주문 처리`)
    
    for (const item of unshippedItems) {
      const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
      
      if (unshippedQuantity <= 0) {
        console.log(`⏭️  스킵: ${item.orders.order_number} - 미출고 수량 0`)
        continue // 이미 완전히 출고된 아이템은 스킵
      }

      const allocateQuantity = Math.min(unshippedQuantity, remainingStock)
      
      console.log(`🔍 할당 검토: ${item.orders.order_number} - 미출고: ${unshippedQuantity}, 할당 예정: ${allocateQuantity}`)
      
      if (allocateQuantity > 0) {
        // 출고 수량 업데이트
        const newShippedQuantity = (item.shipped_quantity || 0) + allocateQuantity
        
        console.log(`📝 출고 수량 업데이트: ${item.orders.order_number} - ${item.shipped_quantity || 0} → ${newShippedQuantity}`)
        
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
            notes: `입고 후 자동 할당 (${item.orders.order_number}) - ${color || ''}/${size || ''}`,
            reference_id: item.order_id,
            reference_type: 'order',
            created_at: getKoreaTime()
          })

        allocations.push({
          orderId: item.order_id,
          orderNumber: item.orders.order_number,
          companyName: item.orders.users.company_name,
          productName: item.product_name,
          color: item.color,
          size: item.size,
          allocatedQuantity: allocateQuantity,
          totalShippedQuantity: newShippedQuantity,
          remainingQuantity: item.quantity - newShippedQuantity
        })

        remainingStock -= allocateQuantity
        
        console.log(`✅ 할당 완료: ${item.orders.order_number} (${item.orders.users.company_name}) - ${allocateQuantity}개 할당, 남은 재고: ${remainingStock}`)
      }

      if (remainingStock <= 0) {
        console.log(`🔚 재고 소진으로 할당 종료`)
        break // 재고 소진
      }
    }

    // 4. 재고 차감 (실제 재고에서 할당량 차감)
    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocatedQuantity, 0)
    
    console.log(`📊 할당 완료 요약: 총 ${totalAllocated}개 할당`)
    
    if (totalAllocated > 0) {
      console.log(`🔄 재고 차감 시작: ${totalAllocated}개`)
      
      if (currentProduct.inventory_options && Array.isArray(currentProduct.inventory_options) && color && size) {
        // 옵션별 재고 차감
        const updatedOptions = currentProduct.inventory_options.map((option: any) => {
          if (option.color === color && option.size === size) {
            const newStock = option.stock_quantity - totalAllocated
            console.log(`📦 옵션 재고 차감: ${option.color}/${option.size} - ${option.stock_quantity} → ${newStock}`)
            return {
              ...option,
              stock_quantity: newStock
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
        // 전체 재고 차감
        const newStock = currentProduct.stock_quantity - totalAllocated
        console.log(`📦 전체 재고 차감: ${currentProduct.stock_quantity} → ${newStock}`)
        
        await supabase
          .from('products')
          .update({
            stock_quantity: newStock,
            updated_at: getKoreaTime()
          })
          .eq('id', productId)
      }
    }

    // 5. 주문 상태 업데이트
    const orderIds = [...new Set(allocations.map(alloc => alloc.orderId))]
    
    console.log(`🔄 주문 상태 업데이트 시작: ${orderIds.length}개 주문`)
    
    for (const orderId of orderIds) {
      // 해당 주문의 모든 아이템 확인
      const { data: allOrderItems, error: allItemsError } = await supabase
        .from('order_items')
        .select('quantity, shipped_quantity')
        .eq('order_id', orderId)

      if (allItemsError) {
        console.error('❌ 주문 아이템 조회 실패:', allItemsError)
        continue
      }

      // 전체 주문 수량과 출고 수량 비교
      const totalQuantity = allOrderItems.reduce((sum: number, item: any) => sum + item.quantity, 0)
      const totalShipped = allOrderItems.reduce((sum: number, item: any) => sum + (item.shipped_quantity || 0), 0)

      let newStatus = 'confirmed'
      if (totalShipped > 0) {
        newStatus = totalShipped >= totalQuantity ? 'partial' : 'processing'
      }

      console.log(`📝 주문 상태 업데이트: ${orderId} - 총 수량: ${totalQuantity}, 출고 수량: ${totalShipped}, 새 상태: ${newStatus}`)

      await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: getKoreaTime()
        })
        .eq('id', orderId)
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