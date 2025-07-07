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

    // 자동 재고 할당 (양수 수량만)
    for (const item of positiveItems) {
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
                color: item.color || null,
                size: item.size || null,
                notes: `발주서 자동 재고 할당 (${orderNumber}) - ${item.color}/${item.size}`,
                reference_id: order.id,
                reference_type: 'order',
                created_at: getKoreaTime()
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
    console.log(`🔍 반품 처리 시작 - 전체 아이템 수: ${items.length}, 음수 아이템 수: ${negativeItems.length}`)
    console.log(`🔍 음수 아이템 상세:`, negativeItems)
    
    if (negativeItems.length > 0) {
      console.log(`✅ 반품명세서 생성 시작 - 음수 아이템 ${negativeItems.length}개`)
      
      // 반품명세서 번호 생성 (RO-YYYYMMDD-XXXX)
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
      const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase()
      const returnStatementNumber = `RO-${dateStr}-${randomStr}`
      console.log(`📋 반품명세서 번호 생성: ${returnStatementNumber}`)

      const returnItems = negativeItems.map((item: any) => ({
        product_name: item.product_name,
        color: item.color,
        size: item.size,
        quantity: Math.abs(item.quantity),
        unit_price: item.unit_price,
        total_amount: Math.abs(item.unit_price * item.quantity)
      }))
      console.log(`📦 반품 아이템 변환 완료:`, returnItems)

      // 사용자 정보 조회
      console.log(`👤 사용자 정보 조회 시작 - user_id: ${user_id}`)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('company_name')
        .eq('id', user_id)
        .single()

      if (userError) {
        console.error('❌ 사용자 정보 조회 오류:', userError)
      } else {
        console.log(`✅ 사용자 정보 조회 성공:`, userData)
      }

      const companyName = userData?.company_name || shipping_name || ''
      console.log(`🏢 회사명 결정: ${companyName}`)

      const returnStatementData = {
        id: randomUUID(),
        statement_number: returnStatementNumber,
        order_id: order.id,
        company_name: companyName,
        return_reason: '발주서 반품 요청',
        return_type: 'customer_change',
        items: returnItems,
        total_amount: returnItems.reduce((sum: number, item: any) => sum + item.total_amount, 0),
        refund_amount: returnItems.reduce((sum: number, item: any) => sum + item.total_amount, 0),
        status: 'pending',
        created_at: getKoreaTime()
      }
      console.log(`💾 반품명세서 데이터 준비 완료:`, returnStatementData)

      const { error: returnError } = await supabase
        .from('return_statements')
        .insert(returnStatementData)

      if (returnError) {
        console.error('❌ 반품명세서 생성 오류:', returnError)
        console.error('❌ 반품명세서 생성 실패 데이터:', returnStatementData)
        return NextResponse.json({ success: false, message: '반품명세서 생성에 실패했습니다.' }, { status: 500 })
      }

      console.log(`✅ 반품명세서 생성 완료 - 번호: ${returnStatementNumber}, 항목 수: ${negativeItems.length}`)
    } else {
      console.log(`ℹ️ 반품 아이템 없음 - 반품명세서 생성 건너뜀`)
    }

    // 자동 재고 할당 완료 후 주문 상태 변경
    if (positiveItems.length > 0) {
      // 일반 발주가 있는 경우
      await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          updated_at: getKoreaTime()
        })
        .eq('id', order.id)
    } else if (negativeItems.length > 0) {
      // 반품만 있는 경우
      await supabase
        .from('orders')
        .update({
          status: 'pending', // 반품은 pending 상태 유지
          updated_at: getKoreaTime()
        })
        .eq('id', order.id)
    }

    return NextResponse.json({ success: true, data: order })
  } catch (error) {
    console.error('발주서 생성 오류:', error)
    return NextResponse.json({ success: false, message: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

 