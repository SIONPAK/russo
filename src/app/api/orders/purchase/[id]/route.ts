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

    // 시간순 재고 할당 처리 (성능 최적화된 버전)
    console.log('🔄 [수정] 시간순 재고 할당 시작')
    
    // 1. 수정된 주문과 관련된 상품들만 추출 (양수 항목만)
    const modifiedProductIds = [...new Set(positiveItems.map((item: any) => item.product_id).filter(Boolean))]
    
    if (modifiedProductIds.length === 0) {
      console.log('ℹ️ [수정] 재할당할 상품이 없습니다.')
      
      // 주문 타입 업데이트
      let orderType = 'purchase'
      if (positiveItems.length === 0 && negativeItems.length > 0) {
        orderType = 'return_only'
      } else if (positiveItems.length > 0 && negativeItems.length > 0) {
        orderType = 'mixed'
      }

      await supabase
        .from('orders')
        .update({
          order_type: orderType,
          status: 'processing', // 반품만 있는 경우도 처리중으로
          updated_at: getKoreaTime()
        })
        .eq('id', orderId)
      
      return NextResponse.json({ success: true, message: '발주서가 수정되었습니다.' })
    }
    
    // 2. 관련된 상품이 포함된 미완료 주문들만 조회 (성능 최적화)
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
      console.error('❌ [수정] 관련 주문 조회 오류:', relatedOrdersError)
      return NextResponse.json({ success: false, message: '주문 조회에 실패했습니다.' }, { status: 500 })
    }

    console.log(`📊 [수정] 재할당 대상 주문 수: ${relatedOrders?.length || 0}`)

    // 3. 관련 상품들의 재고 정보 조회
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, inventory_options, stock_quantity')
      .in('id', modifiedProductIds)

    if (productsError) {
      console.error('❌ [수정] 상품 조회 오류:', productsError)
      return NextResponse.json({ success: false, message: '상품 조회에 실패했습니다.' }, { status: 500 })
    }

    // 4. 관련 상품들의 현재 할당량 계산 및 재고 복원
    const productMap = new Map(products?.map(p => [p.id, p]) || [])
    
    for (const order of relatedOrders || []) {
      for (const item of order.order_items || []) {
        if (!item.product_id || !item.shipped_quantity || item.shipped_quantity <= 0) continue
        
        const product = productMap.get(item.product_id)
        if (!product) continue
        
        // 재고 복원
        if (product.inventory_options && Array.isArray(product.inventory_options)) {
          const updatedOptions = product.inventory_options.map((option: any) => {
            if (option.color === item.color && option.size === item.size) {
              return {
                ...option,
                stock_quantity: option.stock_quantity + item.shipped_quantity
              }
            }
            return option
          })
          
          product.inventory_options = updatedOptions
          product.stock_quantity = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)
        } else {
          product.stock_quantity = product.stock_quantity + item.shipped_quantity
        }
      }
    }

    // 5. 관련 주문들의 shipped_quantity 초기화
    for (const order of relatedOrders || []) {
      await supabase
        .from('order_items')
        .update({ shipped_quantity: 0 })
        .eq('order_id', order.id)
        .in('product_id', modifiedProductIds)
    }

    // 6. 시간순으로 재할당
    for (const orderToProcess of relatedOrders || []) {
      let orderFullyAllocated = true
      let orderHasPartialAllocation = false
      
      for (const item of orderToProcess.order_items || []) {
        if (!item.product_id || item.quantity <= 0) continue
        
        const product = productMap.get(item.product_id)
        if (!product) {
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
              
              product.inventory_options = updatedOptions
              product.stock_quantity = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)
            }
          }
        } else {
          // 일반 재고 관리
          const availableStock = product.stock_quantity || 0
          allocatedQuantity = Math.min(requestedQuantity, availableStock)
          
          if (allocatedQuantity > 0) {
            product.stock_quantity = availableStock - allocatedQuantity
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
          updated_at: getKoreaTime()
        })
        .eq('id', orderToProcess.id)
    }

    // 7. 상품 재고 업데이트 (배치 처리)
    for (const product of productMap.values()) {
      await supabase
        .from('products')
        .update({
          inventory_options: product.inventory_options,
          stock_quantity: product.stock_quantity,
          updated_at: getKoreaTime()
        })
        .eq('id', product.id)
    }

    console.log('✅ [수정] 시간순 재고 할당 완료')

    // 수정된 주문의 할당 상태 계산
    const { data: updatedOrderItems, error: updatedOrderError } = await supabase
      .from('order_items')
      .select('quantity, shipped_quantity')
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