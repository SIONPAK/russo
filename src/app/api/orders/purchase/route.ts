import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { userId, items, totalAmount, shippingInfo } = body

    // 사용자 ID 확인
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: '사용자 정보가 필요합니다.' 
      }, { status: 400 })
    }

    // 주문 번호 생성
    const orderNumber = `PO${Date.now()}`

    // 총 수량 계산하여 배송비 결정 - 발주는 배송비 없음
    const totalQuantity = items.reduce((sum: number, item: any) => sum + item.quantity, 0)
    const shippingFee = 0 // 발주는 배송비 없음
    const finalTotalAmount = totalAmount // 배송비 추가하지 않음

    // 재고 확인 및 차감 (발주 주문도 재고 차감 필요)
    const itemAllocationResults = [] // 할당 결과 저장
    for (const item of items) {
      console.log(`발주 재고 확인 시작 - 상품 ID: ${item.productId}, 요청 수량: ${item.quantity}`)
      
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, inventory_options, stock_quantity')
        .eq('id', item.productId)
        .single()

      if (productError || !product) {
        console.error(`상품 조회 실패 - ID: ${item.productId}`, productError)
        return NextResponse.json(
          { success: false, error: `상품 정보를 찾을 수 없습니다: ${item.productName}` },
          { status: 400 }
        )
      }

      // 옵션별 재고 관리인 경우
      if (product.inventory_options && Array.isArray(product.inventory_options)) {
        const inventoryOption = product.inventory_options.find(
          (option: any) => option.color === item.color && option.size === item.size
        )

        if (!inventoryOption) {
          return NextResponse.json(
            { success: false, error: `선택한 옵션의 재고 정보를 찾을 수 없습니다: ${item.productName} (${item.color}/${item.size})` },
            { status: 400 }
          )
        }

                 // 가용 재고만큼만 할당 (부족해도 발주 접수)
         const availableStock = inventoryOption.stock_quantity
         const allocatedQuantity = Math.min(item.quantity, availableStock)
         
         console.log(`발주 재고 할당 - 요청: ${item.quantity}, 재고: ${availableStock}, 할당: ${allocatedQuantity}`)
         
         // 할당할 재고가 없는 경우에만 에러
         if (allocatedQuantity <= 0) {
           console.error(`재고 없음 - 상품: ${item.productName} (${item.color}/${item.size})`)
           return NextResponse.json(
             { success: false, error: `재고가 없습니다: ${item.productName} (${item.color}/${item.size})` },
             { status: 400 }
           )
         }

                 // 재고 차감 (할당된 수량만큼만)
         const updatedOptions = product.inventory_options.map((option: any) => {
           if (option.color === item.color && option.size === item.size) {
             return {
               ...option,
               stock_quantity: option.stock_quantity - allocatedQuantity
             }
           }
           return option
         })

        // 총 재고량 재계산
        const totalStock = updatedOptions.reduce((sum: number, option: any) => sum + option.stock_quantity, 0)

        const { error: updateError } = await supabase
          .from('products')
          .update({
            inventory_options: updatedOptions,
            stock_quantity: totalStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.productId)

        if (updateError) {
          console.error('재고 업데이트 오류:', updateError)
          return NextResponse.json(
            { success: false, error: '재고 업데이트에 실패했습니다.' },
            { status: 500 }
          )
        }

                 // 재고 변동 이력 기록 (할당된 수량만)
         try {
           const movementData = {
             product_id: item.productId,
             movement_type: 'order_reserve',
             quantity: -allocatedQuantity,
             notes: `발주 주문 생성 시 재고 예약 (${item.color}/${item.size}) - 요청: ${item.quantity}개, 할당: ${allocatedQuantity}개`,
             created_at: new Date().toISOString()
           }
          
          const { error: movementError } = await supabase
            .from('stock_movements')
            .insert(movementData)
          
          if (movementError) {
            console.error('재고 변동 이력 기록 실패:', movementError)
          }
                } catch (movementRecordError) {
          console.error('재고 변동 이력 기록 오류:', movementRecordError)
        }

        // 할당 결과 저장
        itemAllocationResults.push({
          productId: item.productId,
          requestedQuantity: item.quantity,
          allocatedQuantity: allocatedQuantity
        })
       } else {
         // 일반 재고 관리인 경우
         const availableStock = product.stock_quantity
         const allocatedQuantity = Math.min(item.quantity, availableStock)
         
         console.log(`발주 일반재고 할당 - 요청: ${item.quantity}, 재고: ${availableStock}, 할당: ${allocatedQuantity}`)
         
         if (allocatedQuantity <= 0) {
           return NextResponse.json(
             { success: false, error: `재고가 없습니다: ${item.productName}` },
             { status: 400 }
           )
         }

         // 재고 차감 (할당된 수량만)
         const newQuantity = product.stock_quantity - allocatedQuantity

        const { error: updateError } = await supabase
          .from('products')
          .update({
            stock_quantity: newQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.productId)

        if (updateError) {
          console.error('재고 업데이트 오류:', updateError)
          return NextResponse.json(
            { success: false, error: '재고 업데이트에 실패했습니다.' },
            { status: 500 }
          )
        }

                 // 재고 변동 이력 기록 (할당된 수량만)
         try {
           const movementData = {
             product_id: item.productId,
             movement_type: 'order_reserve',
             quantity: -allocatedQuantity,
             notes: `발주 주문 생성 시 재고 예약 - 요청: ${item.quantity}개, 할당: ${allocatedQuantity}개`,
             created_at: new Date().toISOString()
           }
          
          const { error: movementError } = await supabase
            .from('stock_movements')
            .insert(movementData)
          
          if (movementError) {
            console.error('재고 변동 이력 기록 실패:', movementError)
          }
        } catch (movementRecordError) {
          console.error('재고 변동 이력 기록 오류:', movementRecordError)
        }

        // 할당 결과 저장
        itemAllocationResults.push({
          productId: item.productId,
          requestedQuantity: item.quantity,
          allocatedQuantity: allocatedQuantity
        })
      }

      console.log(`발주 재고 업데이트 성공 - 상품 ID: ${item.productId}`)
    }

    // 주문 생성 (배송지 정보를 개별 필드로 저장)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        order_number: orderNumber,
        total_amount: finalTotalAmount,
        shipping_fee: shippingFee,
        status: 'pending',
        order_type: 'normal',
        shipping_name: shippingInfo?.shipping_name || '',
        shipping_phone: shippingInfo?.shipping_phone || '',
        shipping_address: shippingInfo?.shipping_address || '',
        shipping_postal_code: shippingInfo?.shipping_postal_code || '',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (orderError) {
      console.error('Order creation error:', orderError)
      return NextResponse.json({ 
        success: false, 
        error: '발주서 저장에 실패했습니다.' 
      }, { status: 500 })
    }

    // 주문 아이템 생성
    const orderItems = items.map((item: any) => ({
      order_id: orderData.id,
      product_id: item.productId,
      product_name: item.productName,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.supplyAmount + item.vat,
      shipped_quantity: 0 // 초기 출고 수량은 0
    }))

    // 배송비가 있는 경우 배송비 아이템 추가
    if (shippingFee > 0) {
      orderItems.push({
        order_id: orderData.id,
        product_id: null,
        product_name: '배송비',
        color: '-',
        size: '-',
        quantity: 1,
        unit_price: shippingFee,
        total_price: shippingFee,
        shipped_quantity: 1 // 배송비는 항상 출고 완료
      })
    }

    const { data: createdItems, error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)
      .select()

    if (itemsError) {
      console.error('Order items creation error:', itemsError)
      // 주문도 롤백
      await supabase.from('orders').delete().eq('id', orderData.id)
      
      // 재고 복구 로직
      for (const item of items) {
        const { data: product } = await supabase
          .from('products')
          .select('inventory_options, stock_quantity')
          .eq('id', item.productId)
          .single()

        if (product && product.inventory_options && Array.isArray(product.inventory_options)) {
          const updatedOptions = product.inventory_options.map((option: any) => {
            if (option.color === item.color && option.size === item.size) {
              return {
                ...option,
                stock_quantity: option.stock_quantity + item.quantity
              }
            }
            return option
          })

          const totalStock = updatedOptions.reduce((sum: number, option: any) => sum + option.stock_quantity, 0)

          await supabase
            .from('products')
            .update({
              inventory_options: updatedOptions,
              stock_quantity: totalStock
            })
            .eq('id', item.productId)
        } else if (product) {
          await supabase
            .from('products')
            .update({
              stock_quantity: product.stock_quantity + item.quantity
            })
            .eq('id', item.productId)
        }
      }
      
      return NextResponse.json({ 
        success: false, 
        error: '발주서 아이템 저장에 실패했습니다.' 
      }, { status: 500 })
    }

    // 할당된 수량을 shipped_quantity로 업데이트
    for (const item of createdItems || []) {
      if (item.product_id) { // 배송비 아이템 제외
        const allocationResult = itemAllocationResults.find(
          result => result.productId === item.product_id
        )
        
        if (allocationResult) {
          await supabase
            .from('order_items')
            .update({
              shipped_quantity: allocationResult.allocatedQuantity
            })
            .eq('id', item.id)
          
          console.log(`주문 아이템 할당 수량 업데이트: ${item.product_name} - 요청: ${allocationResult.requestedQuantity}, 할당: ${allocationResult.allocatedQuantity}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: orderData.id,
        orderNumber: orderData.order_number,
        message: '발주서가 성공적으로 저장되었습니다.'
      }
    })

  } catch (error) {
    console.error('Purchase order creation error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 