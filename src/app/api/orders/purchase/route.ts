import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { randomUUID } from 'crypto'
import { getKoreaTime } from '@/shared/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const body = await request.json()
    const { items, shipping_address_id, shipping_address, shipping_postal_code, shipping_name, shipping_phone, user_id } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ success: false, message: '발주 상품이 없습니다.' }, { status: 400 })
    }

    // 사용자 정보 조회 (user_id가 있는 경우)
    let userData = null
    if (user_id) {
      const { data: userInfo, error: userDataError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user_id)
        .single()

      if (!userDataError && userInfo) {
        userData = userInfo
      }
    }

    // 발주번호 생성
    const orderNumber = `PO${Date.now()}`
    
    // 총 금액 계산
    const totalAmount = items.reduce((sum: number, item: any) => {
      const supplyAmount = item.unit_price * item.quantity
      const vat = Math.floor(supplyAmount * 0.1)
      return sum + supplyAmount + vat
    }, 0)

    // 양수와 음수 항목 분리
    const positiveItems = items.filter((item: any) => item.quantity > 0)
    const negativeItems = items.filter((item: any) => item.quantity < 0)
    
    // 주문 타입 결정
    let orderType = 'purchase'
    if (positiveItems.length === 0 && negativeItems.length > 0) {
      orderType = 'return_only'
    }

    // 주문 생성
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user_id,
        order_number: orderNumber,
        total_amount: totalAmount,
        shipping_address: shipping_address,
        shipping_postal_code: shipping_postal_code,
        shipping_name: shipping_name,
        shipping_phone: shipping_phone,
        status: 'pending',
        order_type: orderType
      })
      .select()
      .single()

    if (orderError) {
      console.error('주문 생성 오류:', orderError)
      return NextResponse.json({ success: false, message: '주문 생성에 실패했습니다.' }, { status: 500 })
    }

    // 주문 상품 생성 (양수 수량만)
    if (positiveItems.length > 0) {
      const orderItems = positiveItems.map((item: any) => ({
        order_id: order.id,
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

    // 시간순 자동 재고 할당 (양수 수량만) - 전체 주문 재계산
    console.log('🔄 시간순 재고 할당 시작 - 전체 주문 재계산')
    
    // 1. 먼저 모든 발주 주문의 할당된 재고를 초기화 (재고 복원)
    const { data: allPurchaseOrders, error: allOrdersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        status,
        order_items (
          id,
          product_id,
          quantity,
          shipped_quantity,
          color,
          size,
          product_name
        )
      `)
      .eq('order_type', 'purchase')
      .in('status', ['pending', 'confirmed', 'partial'])
      .order('created_at', { ascending: true }) // 시간 순서대로 정렬
    
    if (allOrdersError) {
      console.error('전체 발주 주문 조회 오류:', allOrdersError)
      return NextResponse.json({ success: false, message: '재고 할당 중 오류가 발생했습니다.' }, { status: 500 })
    }
    
    console.log(`📊 전체 발주 주문 수: ${allPurchaseOrders?.length || 0}`)
    
    // 2. 모든 상품의 재고를 원래 상태로 복원 (할당 해제)
    const productsToReset = new Set()
    for (const order of allPurchaseOrders || []) {
      for (const item of order.order_items || []) {
        if (item.product_id && item.shipped_quantity > 0) {
          productsToReset.add(item.product_id)
        }
      }
    }
    
    console.log(`📦 재고 복원 대상 상품 수: ${productsToReset.size}`)
    
    // 각 상품별로 재고 복원
    for (const productId of productsToReset) {
      try {
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, name, inventory_options, stock_quantity')
          .eq('id', productId)
          .single()
        
        if (productError || !product) continue
        
        // 해당 상품의 모든 할당량 계산
        let totalAllocatedByOption = new Map() // 옵션별 할당량
        let totalAllocatedGeneral = 0 // 일반 재고 할당량
        
        for (const order of allPurchaseOrders || []) {
          for (const item of order.order_items || []) {
            if (item.product_id === productId && item.shipped_quantity > 0) {
              if (product.inventory_options && Array.isArray(product.inventory_options)) {
                const optionKey = `${item.color}-${item.size}`
                const currentAllocated = totalAllocatedByOption.get(optionKey) || 0
                totalAllocatedByOption.set(optionKey, currentAllocated + item.shipped_quantity)
              } else {
                totalAllocatedGeneral += item.shipped_quantity
              }
            }
          }
        }
        
        // 재고 복원
        if (product.inventory_options && Array.isArray(product.inventory_options)) {
          const restoredOptions = product.inventory_options.map((option: any) => {
            const optionKey = `${option.color}-${option.size}`
            const allocatedAmount = totalAllocatedByOption.get(optionKey) || 0
            return {
              ...option,
              stock_quantity: option.stock_quantity + allocatedAmount
            }
          })
          
          const totalStock = restoredOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)
          
          await supabase
            .from('products')
            .update({
              inventory_options: restoredOptions,
              stock_quantity: totalStock,
              updated_at: getKoreaTime()
            })
            .eq('id', productId)
        } else {
          await supabase
            .from('products')
            .update({
              stock_quantity: product.stock_quantity + totalAllocatedGeneral,
              updated_at: getKoreaTime()
            })
            .eq('id', productId)
        }
        
        console.log(`✅ 재고 복원 완료 - 상품 ID: ${productId}`)
      } catch (error) {
        console.error(`❌ 재고 복원 오류 - 상품 ID: ${productId}`, error)
      }
    }
    
    // 3. 모든 주문의 shipped_quantity 초기화
    for (const order of allPurchaseOrders || []) {
      await supabase
        .from('order_items')
        .update({ shipped_quantity: 0 })
        .eq('order_id', order.id)
    }
    
    console.log('🔄 모든 할당 초기화 완료, 시간순 재할당 시작')
    
    // 4. 시간 순서대로 재고 재할당
    let globalAllocationResults = new Map() // 주문별 할당 결과
    
    for (const order of allPurchaseOrders || []) {
      console.log(`🔄 주문 처리 중: ${order.order_number} (${order.created_at})`)
      
      let orderFullyAllocated = true
      let orderHasPartialAllocation = false
      
      for (const item of order.order_items || []) {
        if (!item.product_id || item.quantity <= 0) continue
        
        try {
          // 최신 상품 정보 조회
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, inventory_options, stock_quantity')
            .eq('id', item.product_id)
            .single()
          
          if (productError || !product) {
            console.error(`상품 조회 실패 - ID: ${item.product_id}`)
            orderFullyAllocated = false
            continue
          }
          
          let allocatedQuantity = 0
          const requestedQuantity = item.quantity
          
          if (product.inventory_options && Array.isArray(product.inventory_options)) {
            // 옵션별 재고 관리
            const inventoryOption = product.inventory_options.find(
              (option: any) => option.color === item.color && option.size === item.size
            )
            
            if (inventoryOption) {
              const availableStock = inventoryOption.stock_quantity || 0
              allocatedQuantity = Math.min(requestedQuantity, availableStock)
              
              if (allocatedQuantity > 0) {
                // 옵션별 재고 차감
                const updatedOptions = product.inventory_options.map((option: any) => {
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
                    updated_at: getKoreaTime()
                  })
                  .eq('id', item.product_id)
              }
            }
          } else {
            // 일반 재고 관리
            const availableStock = product.stock_quantity || 0
            allocatedQuantity = Math.min(requestedQuantity, availableStock)
            
            if (allocatedQuantity > 0) {
              await supabase
                .from('products')
                .update({
                  stock_quantity: availableStock - allocatedQuantity,
                  updated_at: getKoreaTime()
                })
                .eq('id', item.product_id)
            }
          }
          
          // 주문 아이템에 할당된 수량 업데이트
          if (allocatedQuantity > 0) {
            await supabase
              .from('order_items')
              .update({
                shipped_quantity: allocatedQuantity
              })
              .eq('id', item.id)
            
            // 재고 변동 이력 기록
            await supabase
              .from('stock_movements')
              .insert({
                product_id: item.product_id,
                movement_type: 'order_allocation',
                quantity: -allocatedQuantity,
                color: item.color || null,
                size: item.size || null,
                notes: `시간순 재고 할당 (${order.order_number}) - ${item.color}/${item.size}`,
                reference_id: order.id,
                reference_type: 'order',
                created_at: getKoreaTime()
              })
          }
          
          console.log(`  ✅ ${item.product_name} (${item.color}/${item.size}): 요청 ${requestedQuantity}, 할당 ${allocatedQuantity}`)
          
          // 할당 상태 확인
          if (allocatedQuantity < requestedQuantity) {
            orderFullyAllocated = false
            if (allocatedQuantity > 0) {
              orderHasPartialAllocation = true
            }
          }
          
        } catch (error) {
          console.error(`재고 할당 오류 - 상품 ID: ${item.product_id}`, error)
          orderFullyAllocated = false
        }
      }
      
      // 주문 상태 업데이트
      let orderStatus = 'pending'
      if (orderFullyAllocated) {
        orderStatus = 'confirmed'
      } else if (orderHasPartialAllocation) {
        orderStatus = 'partial'
      }
      
      await supabase
        .from('orders')
        .update({
          status: orderStatus,
          updated_at: getKoreaTime()
        })
        .eq('id', order.id)
      
      globalAllocationResults.set(order.id, {
        fullyAllocated: orderFullyAllocated,
        hasPartialAllocation: orderHasPartialAllocation,
        status: orderStatus
      })
      
      console.log(`  📊 주문 ${order.order_number} 상태: ${orderStatus}`)
    }
    
    console.log('🎉 시간순 재고 할당 완료')
    
    // 현재 생성된 주문의 결과 반환
    const currentOrderResult = globalAllocationResults.get(order.id)
    const allItemsFullyAllocated = currentOrderResult?.fullyAllocated || false
    const hasPartialAllocation = currentOrderResult?.hasPartialAllocation || false

    // 음수 수량 항목이 있으면 반품명세서 생성 (기존 negativeItems 변수 사용)
    console.log(`🔍 반품 처리 시작 - 전체 아이템 수: ${items.length}, 음수 아이템 수: ${negativeItems.length}`)
    console.log(`🔍 음수 아이템 상세:`, negativeItems)

    if (negativeItems.length > 0) {
      // 반품명세서 번호 생성
      const returnStatementNumber = `RT${Date.now()}`
      
      // 반품명세서 생성
      const returnStatementData = {
        statement_number: returnStatementNumber,
        order_id: order.id,
        user_id: user_id,
        company_name: userData?.company_name || '미확인',
        total_amount: Math.abs(negativeItems.reduce((sum: number, item: any) => {
          const supplyAmount = Math.abs(item.unit_price * item.quantity)
          const vat = Math.floor(supplyAmount * 0.1)
          return sum + supplyAmount + vat
        }, 0)),
        status: 'pending',
        created_at: getKoreaTime(),
        items: negativeItems.map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          color: item.color,
          size: item.size,
          quantity: Math.abs(item.quantity),
          unit_price: item.unit_price,
          total_price: Math.abs(item.unit_price * item.quantity)
        }))
      }

      console.log(`🔍 반품명세서 생성 시도:`, returnStatementData)

      const { data: returnStatement, error: returnError } = await supabase
        .from('return_statements')
        .insert(returnStatementData)
        .select()
        .single()

      if (returnError) {
        console.error('❌ 반품명세서 생성 오류:', returnError)
        console.error('❌ 반품명세서 생성 실패 데이터:', returnStatementData)
        return NextResponse.json({ success: false, message: '반품명세서 생성에 실패했습니다.' }, { status: 500 })
      }

      console.log(`✅ 반품명세서 생성 완료 - 번호: ${returnStatementNumber}, 항목 수: ${negativeItems.length}`)
    } else {
      console.log(`ℹ️ 반품 아이템 없음 - 반품명세서 생성 건너뜀`)
    }

    // 주문 상태 최종 업데이트
    let finalStatus = 'confirmed'
    
    if (positiveItems.length > 0) {
      // 일반 발주가 있는 경우
      if (allItemsFullyAllocated) {
        finalStatus = 'confirmed' // 전량 할당 완료
      } else if (hasPartialAllocation) {
        finalStatus = 'partial' // 부분 할당
      } else {
        finalStatus = 'pending' // 할당 불가
      }
    } else if (negativeItems.length > 0) {
      // 반품만 있는 경우
      finalStatus = 'confirmed' // 반품도 확정 처리
    }

    await supabase
      .from('orders')
      .update({
        status: finalStatus,
        updated_at: getKoreaTime()
      })
      .eq('id', order.id)

    console.log(`🔄 발주 주문 상태 업데이트 완료 - 상태: ${finalStatus}`)

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('발주서 생성 오류:', error)
    return NextResponse.json({ success: false, message: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

 