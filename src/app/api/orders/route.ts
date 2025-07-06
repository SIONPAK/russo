import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { createClient } from '@supabase/supabase-js'

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
  const now = new Date()
  const currentHour = now.getHours()
  
  // 사용자가 날짜를 직접 지정한 경우 그대로 사용
  if (startDate && endDate) {
    const endDateTime = new Date(endDate)
    endDateTime.setHours(23, 59, 59, 999)
    return {
      start: startDate,
      end: endDateTime.toISOString()
    }
  }
  
  // 오후 3시 기준 자동 계산
  let cutoffDate = new Date()
  
  if (currentHour < 15) {
    // 오후 3시 이전: 전날 오후 3시부터
    cutoffDate.setDate(cutoffDate.getDate() - 1)
  }
  
  // 오후 3시로 설정
  cutoffDate.setHours(15, 0, 0, 0)
  
  return {
    start: cutoffDate.toISOString(),
    end: now.toISOString()
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

    // 날짜 범위 필터 (오후 3시 기준)
    const dateRange = getDateRangeFromCutoff(startDate, endDate)
    query = query.gte('created_at', dateRange.start)
    query = query.lte('created_at', dateRange.end)

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

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: orders || [],
      pagination: {
        currentPage: page,
        totalPages,
        totalCount: count || 0,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      dateRange: {
        start: dateRange.start,
        end: dateRange.end,
        cutoffInfo: `오후 3시 기준 조회 (${new Date(dateRange.start).toLocaleString('ko-KR')} ~ ${new Date(dateRange.end).toLocaleString('ko-KR')})`
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

    // 재고 확인 및 차감
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

        // 가용 재고만큼만 할당 (부족해도 주문 접수)
        const availableStock = inventoryOption.stock_quantity
        const allocatedQuantity = Math.min(item.quantity, availableStock)
        
        console.log(`재고 할당 - 요청: ${item.quantity}, 재고: ${availableStock}, 할당: ${allocatedQuantity}`)
        
        // 할당할 재고가 없는 경우에만 에러
        if (allocatedQuantity <= 0) {
          console.error(`재고 없음 - 상품: ${item.productName} (${item.color}/${item.size})`)
          return NextResponse.json(
            { success: false, error: `재고가 없습니다: ${item.productName} (${item.color}/${item.size})` },
            { status: 400 }
          )
        }

        // 재고 차감 (할당된 수량만)
        const updatedOptions = product.inventory_options.map((option: any) => {
          if (option.color === item.color && option.size === item.size) {
            const newQuantity = option.stock_quantity - allocatedQuantity
            console.log(`재고 차감 - ${option.color}/${option.size}: ${option.stock_quantity} → ${newQuantity}`)
            return {
              ...option,
              stock_quantity: newQuantity
            }
          }
          return option
        })

        // 총 재고량 재계산
        const totalStock = updatedOptions.reduce((sum: number, option: any) => sum + option.stock_quantity, 0)
        console.log(`총 재고량 재계산 - ${product.stock_quantity} → ${totalStock}`)

        const { error: updateError } = await supabase
          .from('products')
          .update({
            inventory_options: updatedOptions,
            stock_quantity: totalStock
          })
          .eq('id', item.productId)

        if (updateError) {
          console.error('재고 업데이트 오류:', updateError)
          return NextResponse.json(
            { success: false, error: '재고 업데이트에 실패했습니다.' },
            { status: 500 }
          )
        }

                 // 재고 변동 이력 기록 (옵션별, 할당된 수량만)
         try {
           const movementData = {
             product_id: item.productId,
             movement_type: 'order_reserve',
             quantity: -allocatedQuantity, // 음수 (출고 예약)
             notes: `주문 생성 시 재고 예약 (${item.color}/${item.size}) - 요청: ${item.quantity}개, 할당: ${allocatedQuantity}개`,
             created_at: new Date().toISOString()
           }
          
          const { error: movementError } = await supabase
            .from('stock_movements')
            .insert(movementData)
          
          if (movementError) {
            console.error('재고 변동 이력 기록 실패:', movementError)
            // 이력 기록 실패는 경고만 하고 계속 진행
          } else {
            console.log(`재고 변동 이력 기록 성공 - 상품 ID: ${item.productId}`)
          }
        } catch (movementRecordError) {
          console.error('재고 변동 이력 기록 오류:', movementRecordError)
        }

        console.log(`재고 업데이트 성공 - 상품 ID: ${item.productId}`)
      } else {
        // 일반 재고 관리인 경우
        console.log(`일반 재고 관리 - 현재 재고: ${product.stock_quantity}`)
        
        // 가용 재고만큼만 할당 (부족해도 주문 접수)
        const availableStock = product.stock_quantity
        const allocatedQuantity = Math.min(item.quantity, availableStock)
        
        console.log(`일반재고 할당 - 요청: ${item.quantity}, 재고: ${availableStock}, 할당: ${allocatedQuantity}`)
        
        // 할당할 재고가 없는 경우에만 에러
        if (allocatedQuantity <= 0) {
          console.error(`재고 없음 - 상품: ${item.productName}`)
          return NextResponse.json(
            { success: false, error: `재고가 없습니다: ${item.productName}` },
            { status: 400 }
          )
        }

        // 재고 차감 (할당된 수량만)
        const newQuantity = product.stock_quantity - allocatedQuantity
        console.log(`재고 차감 - ${product.stock_quantity} → ${newQuantity}`)

        const { error: updateError } = await supabase
          .from('products')
          .update({
            stock_quantity: newQuantity
          })
          .eq('id', item.productId)

        if (updateError) {
          console.error('재고 업데이트 오류:', updateError)
          return NextResponse.json(
            { success: false, error: '재고 업데이트에 실패했습니다.' },
            { status: 500 }
          )
        }

                 // 재고 변동 이력 기록 (일반 재고, 할당된 수량만)
         try {
           const movementData = {
             product_id: item.productId,
             movement_type: 'order_reserve',
             quantity: -allocatedQuantity, // 음수 (출고 예약)
             notes: `주문 생성 시 재고 예약 - 요청: ${item.quantity}개, 할당: ${allocatedQuantity}개`,
             created_at: new Date().toISOString()
           }
          
          const { error: movementError } = await supabase
            .from('stock_movements')
            .insert(movementData)
          
          if (movementError) {
            console.error('재고 변동 이력 기록 실패:', movementError)
            // 이력 기록 실패는 경고만 하고 계속 진행
          } else {
            console.log(`재고 변동 이력 기록 성공 - 상품 ID: ${item.productId}`)
          }
        } catch (movementRecordError) {
          console.error('재고 변동 이력 기록 오류:', movementRecordError)
        }

        console.log(`재고 업데이트 성공 - 상품 ID: ${item.productId}`)
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
      // 주문 아이템 생성 실패 시 주문도 삭제하고 재고 복구
      await supabase.from('orders').delete().eq('id', order.id)
      
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

      return NextResponse.json(
        { success: false, error: '주문 상품 정보 저장에 실패했습니다.' },
        { status: 500 }
      )
    }

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

    const message = '주문이 성공적으로 생성되었습니다.'

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