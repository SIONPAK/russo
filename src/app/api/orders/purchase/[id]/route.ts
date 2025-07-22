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
    const koreaTime = new Date(now.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }))
    const orderTime = new Date(existingOrder.created_at)
    const orderKoreaTime = new Date(orderTime.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }))
    
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

    // 기존 반품명세서 삭제 (반품 접수 수정 시)
    const { error: deleteReturnError } = await supabase
      .from('return_statements')
      .delete()
      .eq('order_id', orderId)

    if (deleteReturnError) {
      console.error('기존 반품명세서 삭제 오류:', deleteReturnError)
      // 반품명세서 삭제 실패해도 수정은 진행
    }

    // 💡 진짜 UPDATE 방식으로 수정 - 개별 아이템 처리
    console.log('🔄 [진짜 수정] 개별 아이템 UPDATE/INSERT/DELETE 시작')
    
    const positiveItems = items.filter((item: any) => item.quantity >= 0)
    const processedExistingItems: string[] = []

    // 1단계: 기존 아이템 UPDATE 또는 새 아이템 INSERT
    for (const item of positiveItems) {
      // 기존 아이템인지 확인 (product_id, color, size로 매칭)
      const existingItem = existingItems?.find(existing => 
        existing.product_id === item.product_id &&
        existing.color === item.color &&
        existing.size === item.size
      )

      if (existingItem) {
        // 기존 아이템 UPDATE
        processedExistingItems.push(existingItem.id)
        
        const quantityDiff = item.quantity - existingItem.quantity
        
        console.log(`📝 [UPDATE] 기존 아이템 수정:`, {
          id: existingItem.id,
          productId: item.product_id,
          color: item.color,
          size: item.size,
          oldQuantity: existingItem.quantity,
          newQuantity: item.quantity,
          quantityDiff: quantityDiff
        })

        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.unit_price * item.quantity
          })
          .eq('id', existingItem.id)

        if (updateError) {
          console.error('아이템 업데이트 오류:', updateError)
          return NextResponse.json({ success: false, message: '주문 상품 업데이트에 실패했습니다.' }, { status: 500 })
        }

        // 재고 이력 생성 (수량 변경이 있는 경우만)
        if (quantityDiff !== 0) {
          await supabase
            .from('inventory_history')
            .insert({
              id: randomUUID(),
              product_id: item.product_id,
              quantity: quantityDiff,
              type: quantityDiff > 0 ? 'outbound' : 'inbound',
              reason: `발주 수정 - 수량 변경 (${existingOrder.order_number})`,
              reference_id: orderId,
              reference_type: 'order_update'
            })
        }
      } else {
        // 새 아이템 INSERT
        console.log(`➕ [INSERT] 새 아이템 추가:`, {
          productId: item.product_id,
          color: item.color,
          size: item.size,
          quantity: item.quantity
        })

        const { error: insertError } = await supabase
          .from('order_items')
          .insert({
            order_id: orderId,
            product_id: item.product_id,
            product_name: item.product_name,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.unit_price * item.quantity,
            shipped_quantity: 0,
            allocated_quantity: 0
          })

        if (insertError) {
          console.error('새 아이템 추가 오류:', insertError)
          return NextResponse.json({ success: false, message: '새 주문 상품 추가에 실패했습니다.' }, { status: 500 })
        }

        // 재고 이력 생성
        if (item.quantity > 0) {
          await supabase
            .from('inventory_history')
            .insert({
              id: randomUUID(),
              product_id: item.product_id,
              quantity: item.quantity,
              type: 'outbound',
              reason: `발주 수정 - 신규 상품 추가 (${existingOrder.order_number})`,
              reference_id: orderId,
              reference_type: 'order_update_add'
            })
        }
      }
    }

    // 2단계: 제거된 기존 아이템 DELETE
    const itemsToDelete = existingItems?.filter(existing => 
      !processedExistingItems.includes(existing.id)
    ) || []

    for (const itemToDelete of itemsToDelete) {
      console.log(`🗑️ [DELETE] 제거된 아이템 삭제:`, {
        id: itemToDelete.id,
        productId: itemToDelete.product_id,
        color: itemToDelete.color,
        size: itemToDelete.size,
        quantity: itemToDelete.quantity
      })

      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('id', itemToDelete.id)

      if (deleteError) {
        console.error('아이템 삭제 오류:', deleteError)
        return NextResponse.json({ success: false, message: '주문 상품 삭제에 실패했습니다.' }, { status: 500 })
      }

      // 재고 이력 생성 (재고 복원)
      if (itemToDelete.quantity !== 0) {
        await supabase
          .from('inventory_history')
          .insert({
            id: randomUUID(),
            product_id: itemToDelete.product_id,
            quantity: -itemToDelete.quantity,
            type: itemToDelete.quantity > 0 ? 'inbound' : 'outbound',
            reason: `발주 수정 - 상품 제거 (${existingOrder.order_number})`,
            reference_id: orderId,
            reference_type: 'order_update_remove'
          })
      }
    }

    console.log(`✅ [진짜 수정] 완료 - 업데이트: ${processedExistingItems.length}개, 추가: ${positiveItems.length - processedExistingItems.length}개, 삭제: ${itemsToDelete.length}개`)

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

    // 💡 자동 재고 재할당 처리 (전체 시스템 자동 할당)
    console.log('🔄 [수정] 자동 재고 재할당 호출')
    
    try {
      const autoAllocationResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/orders/auto-allocation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      })

      const autoAllocationResult = await autoAllocationResponse.json()
      
      if (autoAllocationResult.success) {
        console.log('✅ [수정] 자동 재할당 완료:', autoAllocationResult.summary)
      } else {
        console.log('ℹ️ [수정] 자동 재할당 결과:', autoAllocationResult.message)
      }
    } catch (error) {
      console.error('❌ [수정] 자동 재할당 호출 실패:', error)
      // 에러가 발생해도 수정은 계속 진행
    }

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