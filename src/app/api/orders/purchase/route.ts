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

    // 양수와 음수 항목 분리
    const positiveItems = items.filter((item: any) => item.quantity > 0)
    const negativeItems = items.filter((item: any) => item.quantity < 0)

    // 하루 1건 제한 확인 (양수 항목이 있는 경우만 - 반품은 제한 없음)
    if (positiveItems.length > 0 && user_id) {
      const now = new Date()
      const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
      
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
        const orderKoreaTime = new Date(orderTime.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
        
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

    // 시간순 재고 할당 (성능 최적화된 버전)
    console.log('🔄 시간순 재고 할당 시작')
    
    // 1. 현재 주문과 관련된 상품들과 미완료 주문들만 조회
    const currentOrderProductIds = [...new Set(positiveItems.map((item: any) => item.product_id).filter(Boolean))]
    
    if (currentOrderProductIds.length === 0) {
      console.log('ℹ️ 할당할 상품이 없습니다.')
      return NextResponse.json({ success: true, data: order })
    }
    
    // 현재 주문과 관련된 상품이 포함된 미완료 주문들만 조회 (성능 최적화)
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
      .eq('order_type', 'purchase')
      .in('status', ['pending', 'confirmed', 'partial'])
      .in('order_items.product_id', currentOrderProductIds)
      .order('created_at', { ascending: true })
    
    if (relatedOrdersError) {
      console.error('관련 주문 조회 오류:', relatedOrdersError)
      return NextResponse.json({ success: false, message: '주문 조회에 실패했습니다.' }, { status: 500 })
    }
    
    console.log(`📊 재할당 대상 주문 수: ${relatedOrders?.length || 0}`)
    
    // 2. 관련 상품들의 재고 정보 조회
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, inventory_options, stock_quantity')
      .in('id', currentOrderProductIds)
    
    if (productsError) {
      console.error('상품 조회 오류:', productsError)
      return NextResponse.json({ success: false, message: '상품 조회에 실패했습니다.' }, { status: 500 })
    }
    
    // 3. 관련 상품들의 현재 할당량 계산 및 재고 복원
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
    
    // 4. 모든 관련 주문의 shipped_quantity 초기화
    for (const order of relatedOrders || []) {
      await supabase
        .from('order_items')
        .update({ shipped_quantity: 0 })
        .eq('order_id', order.id)
        .in('product_id', currentOrderProductIds)
    }
    
    // 5. 시간순으로 재할당
    let allItemsFullyAllocated = true
    let hasPartialAllocation = false
    
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
        
        // 현재 주문인 경우 결과 저장
        if (orderToProcess.id === order.id) {
          if (allocatedQuantity < requestedQuantity) {
            allItemsFullyAllocated = false
            if (allocatedQuantity > 0) {
              hasPartialAllocation = true
            }
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
        .update({ status: orderStatus })
        .eq('id', orderToProcess.id)
    }
    
    // 6. 상품 재고 업데이트 (배치 처리)
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
    
    console.log('✅ 시간순 재고 할당 완료')

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
    let finalStatus = 'processing'  // 작업중
    
    if (positiveItems.length > 0) {
      // 일반 발주가 있는 경우
      if (allItemsFullyAllocated) {
        finalStatus = 'processing' // 작업중 (전량 할당 완료)
      } else if (hasPartialAllocation) {
        finalStatus = 'processing' // 작업중 (부분 할당)
      } else {
        finalStatus = 'pending' // 대기중 (할당 불가)
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

 