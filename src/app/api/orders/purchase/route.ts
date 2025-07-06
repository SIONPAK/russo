import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { randomUUID } from 'crypto'

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

    // 주문 생성
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user_id || null,
        order_number: orderNumber,
        total_amount: totalAmount,
        shipping_address: shipping_address,
        shipping_postal_code: shipping_postal_code,
        shipping_name: shipping_name,
        shipping_phone: shipping_phone,
        status: 'pending',
        order_type: 'purchase'
      })
      .select()
      .single()

    if (orderError) {
      console.error('주문 생성 오류:', orderError)
      return NextResponse.json({ success: false, message: '주문 생성에 실패했습니다.' }, { status: 500 })
    }

    // 주문 상품 생성
    const orderItems = items.map((item: any) => ({
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

    // 자동 재고 할당
    for (const item of items) {
      if (item.product_id && item.quantity > 0) {
        try {
          // 상품 정보 조회
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, inventory_options, stock_quantity')
            .eq('id', item.product_id)
            .single()

          if (productError || !product) {
            console.error(`상품 조회 실패 - ID: ${item.product_id}`, productError)
            continue
          }

          // 재고 할당 로직
          let allocatedQuantity = 0
          
          if (product.inventory_options && Array.isArray(product.inventory_options)) {
            // 옵션별 재고 관리
            const inventoryOption = product.inventory_options.find(
              (option: any) => option.color === item.color && option.size === item.size
            )

            if (inventoryOption) {
              const availableStock = inventoryOption.stock_quantity || 0
              allocatedQuantity = Math.min(item.quantity, availableStock)
              
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

                // 전체 재고량 재계산
                const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)

                await supabase
                  .from('products')
                  .update({
                    inventory_options: updatedOptions,
                    stock_quantity: totalStock
                  })
                  .eq('id', item.product_id)
              }
            }
          } else {
            // 일반 재고 관리
            const availableStock = product.stock_quantity || 0
            allocatedQuantity = Math.min(item.quantity, availableStock)
            
            if (allocatedQuantity > 0) {
              await supabase
                .from('products')
                .update({
                  stock_quantity: availableStock - allocatedQuantity
                })
                .eq('id', item.product_id)
            }
          }

          // 주문 아이템에 할당된 수량 업데이트
          if (allocatedQuantity > 0) {
            await supabase
              .from('order_items')
              .update({
                allocated_quantity: allocatedQuantity
              })
              .eq('order_id', order.id)
              .eq('product_id', item.product_id)
              .eq('color', item.color)
              .eq('size', item.size)

            // 재고 변동 이력 기록
            await supabase
              .from('stock_movements')
              .insert({
                product_id: item.product_id,
                movement_type: 'outbound',
                quantity: -allocatedQuantity,
                notes: `발주서 자동 재고 할당 (${orderNumber}) - ${item.color}/${item.size}`,
                reference_id: order.id,
                reference_type: 'order',
                created_at: new Date().toISOString()
              })
          }

          console.log(`재고 할당 완료 - 상품: ${item.product_name}, 요청: ${item.quantity}, 할당: ${allocatedQuantity}`)
        } catch (allocationError) {
          console.error(`재고 할당 오류 - 상품 ID: ${item.product_id}`, allocationError)
          // 재고 할당 실패는 로그만 남기고 계속 진행
        }
      }
    }

    // 음수 수량 항목이 있으면 반품명세서 생성
    const negativeItems = items.filter((item: any) => item.quantity < 0)
    if (negativeItems.length > 0) {
      const returnItems = negativeItems.map((item: any) => ({
        product_name: item.product_name,
        color: item.color,
        size: item.size,
        quantity: Math.abs(item.quantity),
        unit_price: item.unit_price,
        total_amount: Math.abs(item.unit_price * item.quantity)
      }))

      const { error: returnError } = await supabase
        .from('return_statements')
        .insert({
          id: randomUUID(),
          user_id: user_id || null,
          company_name: userData?.company_name || userData?.shipping_name || shipping_name || '',
          items: returnItems,
          total_amount: returnItems.reduce((sum: number, item: any) => sum + item.total_amount, 0),
          status: 'pending'
        })

      if (returnError) {
        console.error('반품명세서 생성 오류:', returnError)
      }
    }

    // 자동 재고 할당 완료 후 주문 상태 변경
    await supabase
      .from('orders')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('발주서 생성 오류:', error)
    return NextResponse.json({ success: false, message: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

 