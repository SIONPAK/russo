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

    // 현재 아이템 정보 조회 (재고 복구 계산용)
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

    // 새 수량이 기존 출고 수량보다 작으면 출고 수량을 새 수량으로 조정
    const newShippedQuantity = Math.min(currentShippedQuantity, quantity)
    const shippedQuantityDiff = newShippedQuantity - currentShippedQuantity

    // 주문 아이템 업데이트
    const updateData = {
      quantity: quantity,
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

    // 시간순 재고 재할당 로직 (완전 복구)
    console.log('🔄 [관리자 수정] 시간순 재고 재할당 시작')
    
    // 1. 수정된 상품 ID 수집
    const modifiedProductIds = [currentItem.product_id]
    
    // 2. 관련된 상품이 포함된 미완료 주문들 조회
    const { data: relatedOrders, error: relatedOrdersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        status,
        order_items!inner (
          id,
          product_id,
          quantity,
          shipped_quantity,
          color,
          size,
          product_name
        )
      `)
      .in('order_type', ['purchase', 'mixed'])
      .in('status', ['pending', 'processing', 'confirmed'])
      .in('order_items.product_id', modifiedProductIds)
      .order('created_at', { ascending: true })

    if (relatedOrdersError) {
      console.error('❌ [관리자 수정] 관련 주문 조회 오류:', relatedOrdersError)
      return NextResponse.json({ error: '주문 조회에 실패했습니다.' }, { status: 500 })
    }

    console.log(`📊 [관리자 수정] 재할당 대상 주문 수: ${relatedOrders?.length || 0}`)

    // 3. 관련 상품들의 현재 할당량을 데이터베이스에서 실시간으로 복원
    for (const order of relatedOrders || []) {
      for (const item of order.order_items || []) {
        if (!item.product_id || !item.shipped_quantity || item.shipped_quantity <= 0) continue
        
        // 실시간으로 데이터베이스에서 최신 상품 정보 조회
        const { data: currentProduct, error: currentProductError } = await supabase
          .from('products')
          .select('id, name, inventory_options, stock_quantity')
          .eq('id', item.product_id)
          .single()
        
        if (currentProductError || !currentProduct) continue
        
        // 재고 복원 (데이터베이스 직접 업데이트)
        if (currentProduct.inventory_options && Array.isArray(currentProduct.inventory_options)) {
          const updatedOptions = currentProduct.inventory_options.map((option: any) => {
            if (option.color === item.color && option.size === item.size) {
              return {
                ...option,
                stock_quantity: option.stock_quantity + item.shipped_quantity
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
              updated_at: new Date().toISOString()
            })
            .eq('id', item.product_id)
        } else {
          await supabase
            .from('products')
            .update({
              stock_quantity: currentProduct.stock_quantity + item.shipped_quantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.product_id)
        }
      }
    }

    // 4. 관련 주문들의 shipped_quantity 초기화
    for (const order of relatedOrders || []) {
      await supabase
        .from('order_items')
        .update({ shipped_quantity: 0 })
        .eq('order_id', order.id)
        .in('product_id', modifiedProductIds)
    }

    // 5. 시간순으로 재할당 (실시간 데이터베이스 업데이트)
    for (const orderToProcess of relatedOrders || []) {
      let orderFullyAllocated = true
      let orderHasPartialAllocation = false
      
      for (const item of orderToProcess.order_items || []) {
        if (!item.product_id || item.quantity <= 0) continue
        
        // 실시간으로 데이터베이스에서 최신 상품 정보 조회
        const { data: currentProduct, error: currentProductError } = await supabase
          .from('products')
          .select('id, name, inventory_options, stock_quantity')
          .eq('id', item.product_id)
          .single()
        
        if (currentProductError || !currentProduct) {
          orderFullyAllocated = false
          continue
        }
        
        let allocatedQuantity = 0
        const requestedQuantity = item.quantity
        
        if (currentProduct.inventory_options && Array.isArray(currentProduct.inventory_options)) {
          // 옵션별 재고 관리
          const inventoryOption = currentProduct.inventory_options.find(
            (option: any) => option.color === item.color && option.size === item.size
          )
          
          if (inventoryOption) {
            const availableStock = inventoryOption.stock_quantity || 0
            allocatedQuantity = Math.min(requestedQuantity, availableStock)
            
            if (allocatedQuantity > 0) {
              // 옵션별 재고 차감 (데이터베이스 직접 업데이트)
              const updatedOptions = currentProduct.inventory_options.map((option: any) => {
                if (option.color === item.color && option.size === item.size) {
                  return {
                    ...option,
                    stock_quantity: option.stock_quantity - allocatedQuantity
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
                  updated_at: new Date().toISOString()
                })
                .eq('id', item.product_id)
            }
          }
        } else {
          // 일반 재고 관리
          const availableStock = currentProduct.stock_quantity || 0
          allocatedQuantity = Math.min(requestedQuantity, availableStock)
          
          if (allocatedQuantity > 0) {
            await supabase
              .from('products')
              .update({
                stock_quantity: availableStock - allocatedQuantity,
                updated_at: new Date().toISOString()
              })
              .eq('id', item.product_id)
          }
        }
        
        // 주문 아이템 업데이트
        if (allocatedQuantity > 0) {
          await supabase
            .from('order_items')
            .update({ shipped_quantity: allocatedQuantity })
            .eq('id', item.id)
        }
        
        // 할당 상태 확인
        if (allocatedQuantity < requestedQuantity) {
          orderFullyAllocated = false
          if (allocatedQuantity > 0) {
            orderHasPartialAllocation = true
          }
        }
      }
      
      // 주문 상태 업데이트
      let orderStatus = 'pending'  // 대기중
      if (orderFullyAllocated) {
        orderStatus = 'processing' // 작업중 (전량 할당 완료)
      } else if (orderHasPartialAllocation) {
        orderStatus = 'processing' // 작업중 (부분 할당)
      }
      
      await supabase
        .from('orders')
        .update({ 
          status: orderStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderToProcess.id)
    }

    console.log('✅ [관리자 수정] 시간순 재고 할당 완료')

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

    return NextResponse.json({
      success: true,
      message: '주문 아이템이 성공적으로 수정되었습니다.',
      data: {
        updatedItem
      }
    })

  } catch (error) {
    console.error('주문 아이템 수정 오류:', error)
    return NextResponse.json({ error: '주문 아이템 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

 