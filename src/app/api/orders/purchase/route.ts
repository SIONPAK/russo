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

    // 양수/0과 음수 항목 분리
    const positiveItems = items.filter((item: any) => item.quantity >= 0)
    const negativeItems = items.filter((item: any) => item.quantity < 0)

    // 하루 1건 제한 확인 (양수 항목이 있는 경우만 - 반품은 제한 없음)
    if (positiveItems.length > 0 && user_id) {
      const now = new Date()
      const koreaTime = new Date(now.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }))
      
      // 현재 업무일 범위 계산 (전일 15:00 ~ 당일 14:59)
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

      // 현재 업무일 범위 내에서 해당 사용자의 발주 주문 확인
      const { data: existingOrders, error: existingOrdersError } = await supabase
        .from('orders')
        .select('id, order_number, created_at, order_type')
        .eq('user_id', user_id)
        .in('order_type', ['purchase', 'mixed'])
        .gte('created_at', workdayStart.toISOString())
        .lte('created_at', workdayEnd.toISOString())

      if (existingOrdersError) {
        console.error('기존 주문 조회 오류:', existingOrdersError)
        return NextResponse.json({ success: false, message: '기존 주문 조회에 실패했습니다.' }, { status: 500 })
      }

      // 발주 주문이 이미 있는지 확인 (반품 전용 주문은 제외)
      const purchaseOrders = existingOrders?.filter(order => order.order_type !== 'return_only') || []
      
      if (purchaseOrders.length > 0) {
        const existingOrder = purchaseOrders[0]
        const orderTime = new Date(existingOrder.created_at)
        const orderKoreaTime = new Date(orderTime.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }))
        
        return NextResponse.json({
          success: false,
          message: `하루에 발주는 1건만 가능합니다. 기존 발주서를 '수정'해서 이용해주세요.\n\n업무일 기준: ${workdayStart.toLocaleDateString('ko-KR')} 15:00 ~ ${workdayEnd.toLocaleDateString('ko-KR')} 14:59\n\n`
        }, { status: 400 })
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

    // 주문 상품 생성 (양수 수량만, 유효성 검사 추가)
    if (positiveItems.length > 0) {
      const orderItems = positiveItems.map((item: any) => {
        // UUID 유효성 검사
        if (!item.product_id || item.product_id === '' || typeof item.product_id !== 'string') {
          console.error('❌ 발주서 - 유효하지 않은 product_id:', item.product_id, '상품명:', item.product_name)
          throw new Error(`상품 ID가 유효하지 않습니다: ${item.product_name}`)
        }

        return {
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.unit_price * item.quantity
        }
      })

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsError) {
        console.error('주문 상품 생성 오류:', itemsError)
        return NextResponse.json({ success: false, message: '주문 상품 생성에 실패했습니다.' }, { status: 500 })
      }
    }

    // 간단한 가용재고 기반 할당 
    console.log('🔄 가용재고 기반 할당 시작')
    
    // 각 주문 아이템에 대해 개별적으로 할당
    for (const item of positiveItems) {
      if (!item.product_id || item.quantity <= 0) continue
      
      // 가용 재고 확인
      const { data: availableStock, error: stockError } = await supabase
        .rpc('calculate_available_stock', {
          p_product_id: item.product_id,
          p_color: item.color,
          p_size: item.size
        })

      if (stockError) {
        console.error('가용재고 조회 실패:', stockError)
        continue
      }

      // 가용재고 범위 내에서만 할당
      const allocatedQuantity = Math.min(item.quantity, availableStock || 0)
      
      console.log(`📊 가용재고 기반 할당:`, {
        productId: item.product_id,
        productName: item.product_name,
        color: item.color,
        size: item.size,
        requestedQuantity: item.quantity,
        availableStock: availableStock || 0,
        allocatedQuantity: allocatedQuantity
      })

      if (allocatedQuantity > 0) {
        // 재고 할당
        const { error: allocationError } = await supabase
          .rpc('allocate_stock', {
            p_product_id: item.product_id,
            p_quantity: allocatedQuantity,
            p_color: item.color,
            p_size: item.size
          })

        if (allocationError) {
          console.error('재고 할당 실패:', allocationError)
          continue
        }

        // 주문 아이템 업데이트
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            allocated_quantity: allocatedQuantity,
            shipped_quantity: allocatedQuantity
          })
          .eq('order_id', order.id)
          .eq('product_id', item.product_id)
          .eq('color', item.color)
          .eq('size', item.size)

        if (updateError) {
          console.error('주문 아이템 업데이트 실패:', updateError)
          continue
        }

        console.log(`✅ 가용재고 기반 할당 완료:`, {
          productId: item.product_id,
          color: item.color,
          size: item.size,
          allocatedQuantity: allocatedQuantity
        })
      }
    }
    
    console.log('✅ 가용재고 기반 할당 완료')

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
        company_name: userData?.company_name || '미확인',
        return_reason: '발주서 반품 요청',
        return_type: 'customer_change',
        total_amount: Math.abs(negativeItems.reduce((sum: number, item: any) => {
          const supplyAmount = Math.abs(item.unit_price * item.quantity)
          const vat = Math.floor(supplyAmount * 0.1)
          return sum + supplyAmount + vat
        }, 0)),
        refund_amount: Math.abs(negativeItems.reduce((sum: number, item: any) => {
          const supplyAmount = Math.abs(item.unit_price * item.quantity)
          const vat = Math.floor(supplyAmount * 0.1)
          return sum + supplyAmount + vat
        }, 0)),
        status: 'pending',
        refunded: false,
        email_sent: false,
        created_at: getKoreaTime(),
        items: negativeItems.map((item: any) => {
          const quantity = Math.abs(item.quantity)
          const supplyAmount = quantity * item.unit_price
          const vat = Math.floor(supplyAmount * 0.1)
          const totalPriceWithVat = supplyAmount + vat
          
          return {
            product_id: item.product_id,
            product_name: item.product_name,
            color: item.color,
            size: item.size,
            quantity: quantity,
            unit_price: item.unit_price,
            total_price: totalPriceWithVat // VAT 포함 금액
          }
        })
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
    let finalStatus = 'pending'  // 기본값: 대기중
    
    if (positiveItems.length > 0) {
      // 일반 발주가 있는 경우 - 할당 상태 확인
      const { data: orderItems, error: orderItemsError } = await supabase
        .from('order_items')
        .select('quantity, shipped_quantity')
        .eq('order_id', order.id)

      if (!orderItemsError && orderItems) {
        const hasAnyAllocation = orderItems.some(item => (item.shipped_quantity || 0) > 0)
        
        if (hasAnyAllocation) {
          finalStatus = 'processing' // 작업중 (일부 또는 전량 할당)
        } else {
          finalStatus = 'pending' // 대기중 (할당 없음)
        }
      } else {
        finalStatus = 'processing' // 조회 실패 시 기본값
      }
    } else if (negativeItems.length > 0) {
      // 반품만 있는 경우
      finalStatus = 'processing' // 작업중 (반품도 처리 중)
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

 