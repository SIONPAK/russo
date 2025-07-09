import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { getKoreaTime } from '@/shared/lib/utils'

// RLS를 무시하는 클라이언트 생성
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-js-admin'
      }
    }
  }
)

// 오후 3시 기준 날짜 범위 계산
const getDateRangeFromCutoff = (startDate?: string | null, endDate?: string | null) => {
  // 한국 시간 기준으로 현재 시간 계산
  const now = new Date()
  const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
  const currentHour = koreaTime.getHours()
  
  // 사용자가 날짜를 직접 지정한 경우 한국 시간으로 변환
  if (startDate && endDate) {
    const startDateTime = new Date(startDate + 'T00:00:00+09:00')
    const endDateTime = new Date(endDate + 'T23:59:59+09:00')
    return {
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString()
    }
  }
  
  // 오후 3시 기준 자동 계산 (한국 시간)
  let cutoffDate = new Date(koreaTime)
  
  if (currentHour < 15) {
    // 오후 3시 이전: 전날 오후 3시부터
    cutoffDate.setDate(cutoffDate.getDate() - 1)
  }
  
  // 오후 3시로 설정
  cutoffDate.setHours(15, 0, 0, 0)
  
  return {
    start: cutoffDate.toISOString(),
    end: koreaTime.toISOString()
  }
}

// GET - 주문 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const orderNumber = searchParams.get('orderNumber')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status') || ''
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const type = searchParams.get('type') // 'purchase' | 'sample' | 'normal'
    
    // 특정 주문 조회 (orderNumber가 있는 경우)
    if (orderNumber) {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (
              name,
              price,
              images:product_images!product_images_product_id_fkey (
                image_url,
                is_main
              )
            )
          )
        `)
        .eq('order_number', orderNumber)

      // userId가 제공된 경우에만 필터 적용 (보안을 위해)
      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data: order, error } = await query.single()

      if (error) {
        console.error('Order fetch error:', error)
        return NextResponse.json(
          { success: false, error: '주문을 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      // 반품 접수의 경우 return_statements에서 데이터 가져오기
      if (order.order_type === 'return_only' && (!order.order_items || order.order_items.length === 0)) {
        const { data: returnStatements, error: returnError } = await supabase
          .from('return_statements')
          .select('*')
          .eq('order_id', order.id)
          .single()

        if (!returnError && returnStatements && returnStatements.items) {
          // return_statements의 items를 order_items 형태로 변환
          const convertedItems = returnStatements.items.map((item: any, index: number) => ({
            id: `return-${index}`,
            order_id: order.id,
            product_id: item.product_id || null,
            product_name: item.product_name,
            color: item.color || '',
            size: item.size || '',
            quantity: -item.quantity, // 반품이므로 음수로 변환
            unit_price: item.unit_price,
            total_price: -item.total_price, // 반품이므로 음수로 변환
            shipped_quantity: 0,
            products: null
          }))

          order.order_items = convertedItems
        }
      }

      return NextResponse.json({
        success: true,
        data: order
      })
    }
    
    // 주문 목록 조회
    const offset = (page - 1) * limit

    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (
            name,
            price,
            images:product_images!product_images_product_id_fkey (
              image_url,
              is_main
            )
          )
        )
      `, { count: 'exact' })

    // 사용자 필터
    if (userId) {
      query = query.eq('user_id', userId)
    }

    // 상태 필터
    if (status) {
      query = query.eq('status', status)
    }

    // 주문 타입 필터 (발주 주문의 경우 order_number가 PO로 시작)
    if (type === 'purchase') {
      query = query.like('order_number', 'PO%')
    } else if (type === 'sample') {
      query = query.like('order_number', 'SP%')
    } else if (type === 'normal') {
      query = query.not('order_number', 'like', 'PO%')
      query = query.not('order_number', 'like', 'SP%')
    }

    // 날짜 필터
    if (startDate) {
      // 발주 관리에서 전달된 ISO 문자열을 그대로 사용
      query = query.gte('created_at', startDate)
      if (endDate) {
        query = query.lt('created_at', endDate)
      } else {
        // endDate가 없으면 startDate 기준으로 하루 범위 설정
        const start = new Date(startDate)
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
        query = query.lt('created_at', end.toISOString())
      }
    }

    // 정렬 및 페이지네이션
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: orders, error, count } = await query

    if (error) {
      console.error('Orders fetch error:', error)
      return NextResponse.json(
        { success: false, error: '주문 목록을 불러오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    // 반품 접수 주문들의 반품명세서 상태 조회
    let ordersWithReturnStatus = orders || []
    
    if (orders && orders.length > 0) {
      // 반품 접수 주문들 필터링 (order_type이 return_only이거나 total_amount가 음수)
      const returnOrderIds = orders
        .filter(order => order.order_type === 'return_only' || order.total_amount < 0)
        .map(order => order.id)

      if (returnOrderIds.length > 0) {
        // 반품명세서 상태 조회
        const { data: returnStatements, error: returnError } = await supabase
          .from('return_statements')
          .select('order_id, status')
          .in('order_id', returnOrderIds)

        if (!returnError && returnStatements) {
          // 반품명세서 상태를 주문에 추가
          ordersWithReturnStatus = orders.map(order => {
            const returnStatement = returnStatements.find(rs => rs.order_id === order.id)
            return {
              ...order,
              return_statement_status: returnStatement?.status || null
            }
          })
        }
      }
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: ordersWithReturnStatus,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount: count || 0,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      dateRange: {
        start: startDate,
        end: endDate,
        cutoffInfo: `오후 3시 기준 조회 (${startDate ? new Date(startDate).toLocaleString('ko-KR') : '시작 날짜 없음'} ~ ${endDate ? new Date(endDate).toLocaleString('ko-KR') : '종료 날짜 없음'})`
      }
    })

  } catch (error) {
    console.error('Orders API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// POST - 주문 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      items,
      shippingInfo,
      totalAmount,
      shippingFee,
      notes
    } = body

    console.log('주문 생성 요청:', { userId, itemsCount: items?.length, totalAmount })

    // 필수 필드 검증
    if (!userId || !items || items.length === 0 || !shippingInfo) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 총 수량 계산 (20장 이상 무료배송 확인용)
    const totalQuantity = items.reduce((sum: number, item: any) => sum + item.quantity, 0)
    
    // 일반 주문: 20장 이상 무료배송
    let finalShippingFee = totalQuantity >= 20 ? 0 : 3000
    let finalTotalAmount = totalAmount + finalShippingFee

    // 재고 확인 (주문 생성 전 재고 부족 체크)
    for (const item of items) {
      console.log(`재고 확인 시작 - 상품 ID: ${item.productId}, 요청 수량: ${item.quantity}`)
      
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

      console.log(`상품 조회 성공 - 이름: ${product.name}, 현재 총 재고: ${product.stock_quantity}`)

      // 옵션별 재고 관리인 경우
      if (product.inventory_options && Array.isArray(product.inventory_options)) {
        console.log(`옵션별 재고 관리 - 옵션 개수: ${product.inventory_options.length}`)
        
        const inventoryOption = product.inventory_options.find(
          (option: any) => option.color === item.color && option.size === item.size
        )

        if (!inventoryOption) {
          console.error(`재고 옵션 찾기 실패 - 색상: ${item.color}, 사이즈: ${item.size}`)
          return NextResponse.json(
            { success: false, error: `선택한 옵션의 재고 정보를 찾을 수 없습니다: ${item.productName} (${item.color}/${item.size})` },
            { status: 400 }
          )
        }

        console.log(`옵션 재고 확인 - 색상: ${item.color}, 사이즈: ${item.size}, 현재 재고: ${inventoryOption.stock_quantity}`)

        // 재고가 완전히 없는 경우에만 에러 (부족해도 주문 접수)
        if (inventoryOption.stock_quantity <= 0) {
          console.error(`재고 없음 - 상품: ${item.productName} (${item.color}/${item.size})`)
          return NextResponse.json(
            { success: false, error: `재고가 없습니다: ${item.productName} (${item.color}/${item.size})` },
            { status: 400 }
          )
        }
      } else {
        // 일반 재고 관리인 경우
        console.log(`일반 재고 관리 - 현재 재고: ${product.stock_quantity}`)
        
        // 재고가 완전히 없는 경우에만 에러 (부족해도 주문 접수)
        if (product.stock_quantity <= 0) {
          console.error(`재고 없음 - 상품: ${item.productName}`)
          return NextResponse.json(
            { success: false, error: `재고가 없습니다: ${item.productName}` },
            { status: 400 }
          )
        }
      }
    }

    // 사용자 인증 확인 (헤더에서 토큰 가져오기)
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    let authenticatedUser = null
    if (token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      authenticatedUser = user
      console.log('인증 상태:', { user: user?.id, authError })
    }

    // 주문번호 생성
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '')
    const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase()
    
    const orderNumber = `${dateStr}-${timeStr}-${randomStr}`

    console.log('생성할 주문 데이터:', {
      user_id: userId,
      order_number: orderNumber,
      order_type: 'normal',
      total_amount: finalTotalAmount,
      shipping_fee: finalShippingFee,
      status: 'pending',
      shipping_name: shippingInfo.name,
      shipping_phone: shippingInfo.phone,
      shipping_address: shippingInfo.address,
      shipping_postal_code: shippingInfo.postalCode,
      notes: notes || null
    })

    // 주문 생성
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        order_number: orderNumber,
        order_type: 'normal',
        total_amount: finalTotalAmount,
        shipping_fee: finalShippingFee,
        status: 'pending',
        shipping_name: shippingInfo.name,
        shipping_phone: shippingInfo.phone,
        shipping_address: shippingInfo.address,
        shipping_postal_code: shippingInfo.postalCode,
        notes: notes || null
      })
      .select()
      .single()

    if (orderError) {
      console.error('Order creation error:', orderError)
      return NextResponse.json(
        { success: false, error: '주문 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 주문 아이템 생성
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.productName,
      color: item.color || '기본',
      size: item.size || '기본',
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.totalPrice,
      options: item.options || null
    }))

    // 배송비가 있는 경우 배송비 아이템 추가
    if (finalShippingFee > 0) {
      orderItems.push({
        order_id: order.id,
        product_id: null,
        product_name: '배송비',
        color: '-',
        size: '-',
        quantity: 1,
        unit_price: finalShippingFee,
        total_price: finalShippingFee,
        options: null
      })
    }

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('Order items creation error:', itemsError)
      // 주문 아이템 생성 실패 시 주문도 삭제
      await supabase.from('orders').delete().eq('id', order.id)
      
      return NextResponse.json(
        { success: false, error: '주문 상품 정보 저장에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 시간순 재고 할당 처리
    console.log('🔄 시간순 재고 할당 시작')
    let allItemsFullyAllocated = true
    let hasPartialAllocation = false

    for (const item of items) {
      try {
        // 최신 상품 정보 다시 조회
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, name, inventory_options, stock_quantity')
          .eq('id', item.productId)
          .single()

        if (productError || !product) {
          console.error(`재고 할당 중 상품 조회 실패 - ID: ${item.productId}`, productError)
          allItemsFullyAllocated = false
          continue
        }

        let allocatedQuantity = 0
        const requestedQuantity = item.quantity

        // 옵션별 재고 관리인 경우
        if (product.inventory_options && Array.isArray(product.inventory_options)) {
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

              // 전체 재고량 재계산
              const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)

              const { error: stockUpdateError } = await supabase
                .from('products')
                .update({
                  inventory_options: updatedOptions,
                  stock_quantity: totalStock,
                  updated_at: getKoreaTime()
                })
                .eq('id', item.productId)

              if (stockUpdateError) {
                console.error('재고 업데이트 실패:', stockUpdateError)
                allItemsFullyAllocated = false
                continue
              }
            }
          }
        } else {
          // 일반 재고 관리인 경우
          const availableStock = product.stock_quantity || 0
          allocatedQuantity = Math.min(requestedQuantity, availableStock)
          
          if (allocatedQuantity > 0) {
            const { error: stockUpdateError } = await supabase
              .from('products')
              .update({
                stock_quantity: availableStock - allocatedQuantity,
                updated_at: getKoreaTime()
              })
              .eq('id', item.productId)

            if (stockUpdateError) {
              console.error('재고 업데이트 실패:', stockUpdateError)
              allItemsFullyAllocated = false
              continue
            }
          }
        }

        // 주문 아이템에 할당된 수량 업데이트
        if (allocatedQuantity > 0) {
          await supabase
            .from('order_items')
            .update({
              shipped_quantity: allocatedQuantity
            })
            .eq('order_id', order.id)
            .eq('product_id', item.productId)
            .eq('color', item.color || '기본')
            .eq('size', item.size || '기본')

          // 재고 변동 이력 기록
          await supabase
            .from('stock_movements')
            .insert({
              product_id: item.productId,
              movement_type: 'order_allocation',
              quantity: -allocatedQuantity,
              color: item.color || null,
              size: item.size || null,
              notes: `주문 시간순 자동 할당 (${orderNumber}) - ${item.color}/${item.size}`,
              reference_id: order.id,
              reference_type: 'order',
              created_at: getKoreaTime()
            })
        }

        console.log(`✅ 재고 할당 완료 - 상품: ${item.productName}, 요청: ${requestedQuantity}, 할당: ${allocatedQuantity}`)

        // 할당 상태 확인
        if (allocatedQuantity < requestedQuantity) {
          allItemsFullyAllocated = false
          if (allocatedQuantity > 0) {
            hasPartialAllocation = true
          }
        }

      } catch (allocationError) {
        console.error(`재고 할당 오류 - 상품 ID: ${item.productId}`, allocationError)
        allItemsFullyAllocated = false
      }
    }

    // 주문 상태 업데이트 (재고 할당 결과에 따라)
    let orderStatus = 'pending'
    if (allItemsFullyAllocated) {
      orderStatus = 'confirmed' // 전량 할당 완료
    } else if (hasPartialAllocation) {
      orderStatus = 'partial' // 부분 할당
    }

    await supabase
      .from('orders')
      .update({
        status: orderStatus,
        updated_at: getKoreaTime()
      })
      .eq('id', order.id)

    console.log(`🔄 주문 상태 업데이트 완료 - 상태: ${orderStatus}`)

    // 생성된 주문 정보 반환
    const { data: createdOrder } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (
            name,
            price,
            images:product_images!product_images_product_id_fkey (
              image_url,
              is_main
            )
          )
        )
      `)
      .eq('id', order.id)
      .single()

    const message = allItemsFullyAllocated 
      ? '주문이 성공적으로 생성되었습니다.' 
      : hasPartialAllocation 
        ? '주문이 생성되었습니다. 일부 상품은 재고 부족으로 대기 상태입니다.'
        : '주문이 생성되었습니다. 재고 부족으로 관리자 확인 후 처리됩니다.'

    return NextResponse.json({
      success: true,
      data: createdOrder,
      message
    }, { status: 201 })

  } catch (error) {
    console.error('Order creation API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 