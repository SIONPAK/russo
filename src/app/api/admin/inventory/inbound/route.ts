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

    console.log('🔄 [입고 등록] 물리적 재고 조정:', {
      productId: product_id,
      productName: product.name,
      color,
      size,
      quantity,
      reason: reason.trim()
    })

    // 새로운 재고 구조 사용 - 물리적 재고 조정
    const { data: adjustResult, error: adjustError } = await supabase
      .rpc('adjust_physical_stock', {
        p_product_id: product_id,
        p_color: color,
        p_size: size,
        p_quantity_change: quantity,
        p_reason: `입고 등록 - ${reason.trim()}`
      })

    if (adjustError || !adjustResult) {
      console.error('물리적 재고 조정 실패:', adjustError)
      return NextResponse.json({
        success: false,
        error: '재고 조정에 실패했습니다.'
      }, { status: 500 })
    }

    console.log('✅ [입고 등록] 물리적 재고 조정 완료')

    // 🎯 입고 후 미출고 주문 자동 할당 처리
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

// 🎯 미출고 주문 자동 할당 함수 (새로운 구조 적용)
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
        orders!order_items_order_id_fkey (
          id,
          order_number,
          status,
          created_at,
          users!orders_user_id_fkey (
            company_name,
            customer_grade
          )
        )
      `)
      .eq('product_id', productId)
      .in('orders.status', ['pending', 'processing', 'confirmed', 'partial'])
      .order('orders.created_at', { ascending: true })

    // 색상/사이즈 필터링
    if (color) query = query.eq('color', color)
    if (size) query = query.eq('size', size)

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
        // 재고 할당 (새로운 함수 사용)
        const { data: allocationResult, error: allocationError } = await supabase
          .rpc('allocate_stock', {
            p_product_id: productId,
            p_color: color,
            p_size: size,
            p_quantity: allocateQuantity
          })

        if (allocationError || !allocationResult) {
          console.error('❌ 재고 할당 실패:', allocationError)
          continue
        }

        // 출고 수량 업데이트
        const newShippedQuantity = (item.shipped_quantity || 0) + allocateQuantity
        
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            shipped_quantity: newShippedQuantity
          })
          .eq('id', item.id)

        if (updateError) {
          console.error('❌ 주문 아이템 업데이트 실패:', updateError)
          // 할당된 재고 롤백
          await supabase.rpc('deallocate_stock', {
            p_product_id: productId,
            p_color: color,
            p_size: size,
            p_quantity: allocateQuantity
          })
          continue
        }

        allocations.push({
          orderId: item.order_id,
          orderNumber: item.orders.order_number,
          companyName: item.orders.users?.company_name || '알 수 없음',
          customerGrade: item.orders.users?.customer_grade || 'normal',
          productName: item.product_name,
          color: item.color,
          size: item.size,
          allocatedQuantity: allocateQuantity,
          totalQuantity: item.quantity,
          previousShipped: item.shipped_quantity || 0,
          newShipped: newShippedQuantity,
          isFullyAllocated: newShippedQuantity >= item.quantity
        })

        remainingStock -= allocateQuantity
        console.log(`✅ 할당 완료: ${item.orders.order_number} - ${allocateQuantity}개`)
      }
    }

    // 4. 주문 상태 업데이트
    const orderIds = [...new Set(allocations.map((alloc: any) => alloc.orderId))]
    
    for (const orderId of orderIds) {
      // 해당 주문의 모든 아이템이 완전히 출고되었는지 확인
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

    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocatedQuantity, 0)
    
    console.log(`✅ 자동 할당 완료: ${totalAllocated}개 할당, ${allocations.length}개 주문 처리`)

    return {
      success: true,
      message: `${totalAllocated}개 자동 할당 완료`,
      allocations,
      totalAllocated,
      remainingStock
    }

  } catch (error) {
    console.error('❌ 자동 할당 처리 중 오류:', error)
    return { success: false, message: '자동 할당 처리 중 오류 발생' }
  }
} 