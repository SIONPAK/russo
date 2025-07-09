import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { getKoreaTime } from '@/shared/lib/utils'

interface StockAdjustmentRequest {
  adjustment: number
  color?: string
  size?: string
  reason: string
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

    // 옵션별 재고 조정
    if (color && size) {
      const inventoryOptions = product.inventory_options || []
      const optionIndex = inventoryOptions.findIndex(
        (option: any) => option.color === color && option.size === size
      )

      if (optionIndex === -1) {
        return NextResponse.json({
          success: false,
          error: '해당 옵션을 찾을 수 없습니다.'
        }, { status: 404 })
      }

      const currentQuantity = inventoryOptions[optionIndex].stock_quantity
      const newQuantity = Math.max(0, currentQuantity + adjustment)

      // 재고가 부족한 경우 체크
      if (adjustment < 0 && currentQuantity < Math.abs(adjustment)) {
        return NextResponse.json({
          success: false,
          error: `현재 재고(${currentQuantity}개)가 부족합니다.`
        }, { status: 400 })
      }

      // 옵션 재고 업데이트
      inventoryOptions[optionIndex].stock_quantity = newQuantity

      // 전체 재고량 재계산
      const totalStock = inventoryOptions.reduce((sum: number, option: any) => sum + option.stock_quantity, 0)

      const { error: updateError } = await supabase
        .from('products')
        .update({
          inventory_options: inventoryOptions,
          stock_quantity: totalStock,
          updated_at: getKoreaTime()
        })
        .eq('id', productId)

      if (updateError) {
        console.error('Stock update error:', updateError)
        return NextResponse.json({
          success: false,
          error: '재고 조정에 실패했습니다.'
        }, { status: 500 })
      }

      // 재고 변동 이력 기록
      const movementData = {
        product_id: productId,
        movement_type: 'adjustment',
        quantity: adjustment,
        color: color || null,
        size: size || null,
        notes: `옵션별 재고 조정 (${color}/${size}) - ${reason || '수동 재고 조정'}`,
        created_at: getKoreaTime()
      }
      
      console.log('재고 변동 이력 기록 시도:', movementData)
      
      const { data: movementResult, error: movementError } = await supabase
        .from('stock_movements')
        .insert(movementData)
        .select()
      
      if (movementError) {
        console.error('재고 변동 이력 기록 실패:', movementError)
      } else {
        console.log('재고 변동 이력 기록 성공:', movementResult)
      }

      console.log(`재고 조정 완료: ${product.id} (${color}/${size}) ${currentQuantity} → ${newQuantity}`)

      // 🎯 재고 증가 시 자동 할당 처리
      if (adjustment > 0) {
        console.log(`🔄 재고 증가로 자동 할당 시작 - 상품: ${productId}, 색상: ${color}, 사이즈: ${size}, 증가량: ${adjustment}`)
        allocationResults = await autoAllocateToUnshippedOrders(supabase, productId, color, size)
        console.log(`🔄 자동 할당 결과:`, allocationResults)
      }

    } else {
      // 일반 재고 조정
      const currentQuantity = product.stock_quantity
      const newQuantity = Math.max(0, currentQuantity + adjustment)

      // 재고가 부족한 경우 체크
      if (adjustment < 0 && currentQuantity < Math.abs(adjustment)) {
        return NextResponse.json({
          success: false,
          error: `현재 재고(${currentQuantity}개)가 부족합니다.`
        }, { status: 400 })
      }

      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock_quantity: newQuantity,
          updated_at: getKoreaTime()
        })
        .eq('id', productId)

      if (updateError) {
        console.error('Stock update error:', updateError)
        return NextResponse.json({
          success: false,
          error: '재고 조정에 실패했습니다.'
        }, { status: 500 })
      }

      // 재고 변동 이력 기록
      const movementData = {
        product_id: productId,
        movement_type: 'adjustment',
        quantity: adjustment,
        notes: `전체 재고 조정 - ${reason || '수동 재고 조정'}`,
        created_at: getKoreaTime()
      }
      
      console.log('재고 변동 이력 기록 시도:', movementData)
      
      const { data: movementResult, error: movementError } = await supabase
        .from('stock_movements')
        .insert(movementData)
        .select()
      
      if (movementError) {
        console.error('재고 변동 이력 기록 실패:', movementError)
      } else {
        console.log('재고 변동 이력 기록 성공:', movementResult)
      }

      console.log(`재고 조정 완료: ${product.id} ${currentQuantity} → ${newQuantity}`)

      // 🎯 재고 증가 시 자동 할당 처리
      if (adjustment > 0) {
        console.log(`🔄 재고 증가로 자동 할당 시작 - 상품: ${productId}, 증가량: ${adjustment}`)
        allocationResults = await autoAllocateToUnshippedOrders(supabase, productId)
        console.log(`🔄 자동 할당 결과:`, allocationResults)
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

// 🎯 미출고 주문 자동 할당 함수
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