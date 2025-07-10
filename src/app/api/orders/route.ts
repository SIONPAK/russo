import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/shared/lib/supabase/server'
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
    const supabase = await createServerClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'all'
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const includeUnshipped = searchParams.get('includeUnshipped') === 'true'
    const userId = searchParams.get('userId')
    const orderNumber = searchParams.get('orderNumber')

    // orderNumber로 단일 주문 조회
    if (orderNumber) {
      const { data: order, error: orderError } = await supabase
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
        .single()

      if (orderError || !order) {
        return NextResponse.json({ 
          success: false, 
          error: '주문을 찾을 수 없습니다.' 
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: order
      })
    }

    // userId가 없으면 오류 반환
    if (!userId) {
      return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 })
    }

    const offset = (page - 1) * limit

    // 기본 주문 조회
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
      .eq('user_id', userId)

    // 검색 조건 적용
    if (search) {
      query = query.or(`order_number.ilike.%${search}%,shipping_name.ilike.%${search}%`)
    }

    // 상태 필터
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    // 날짜 범위 필터
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    // 페이지네이션 적용
    const { data: orders, error: ordersError, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (ordersError) {
      console.error('주문 조회 오류:', ordersError)
      return NextResponse.json({ error: '주문 조회 중 오류가 발생했습니다.' }, { status: 500 })
    }

    // 미발송 내역 조회 (요청 시에만)
    let unshippedStatements: any[] = []
    if (includeUnshipped) {
      const { data: unshippedData, error: unshippedError } = await supabase
        .from('unshipped_statements')
        .select(`
          id,
          statement_number,
          order_id,
          total_unshipped_amount,
          status,
          reason,
          created_at,
          updated_at,
          orders (
            order_number,
            created_at
          ),
          unshipped_statement_items (
            id,
            product_name,
            color,
            size,
            ordered_quantity,
            shipped_quantity,
            unshipped_quantity,
            unit_price,
            total_amount
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (!unshippedError) {
        unshippedStatements = unshippedData || []
      }
    }

    // 페이지네이션 정보 계산
    const totalPages = Math.ceil((count || 0) / limit)
    const pagination = {
      currentPage: page,
      totalPages,
      totalCount: count || 0,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }

    return NextResponse.json({
      orders: orders || [],
      unshippedStatements,
      pagination
    })

  } catch (error) {
    console.error('주문 조회 API 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
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

        // 가용 재고 확인
        const { data: availableStock, error: stockError } = await supabase
          .rpc('calculate_available_stock', {
            p_product_id: item.productId,
            p_color: item.color,
            p_size: item.size
          })

        console.log(`📦 가용 재고 확인 - 상품: ${item.productName}, 색상: ${item.color}, 사이즈: ${item.size}, 가용: ${availableStock}개`)

        if (!stockError && availableStock > 0) {
          allocatedQuantity = Math.min(requestedQuantity, availableStock)
          
          if (allocatedQuantity > 0) {
            // 재고 할당 - RPC 사용
            const { data: allocationResult, error: allocationError } = await supabase
              .rpc('allocate_stock', {
                p_product_id: item.productId,
                p_quantity: allocatedQuantity,
                p_color: item.color,
                p_size: item.size
              })

            if (allocationError || !allocationResult) {
              console.error('재고 할당 실패:', allocationError)
              allocatedQuantity = 0 // 할당 실패 시 0으로 리셋
              allItemsFullyAllocated = false
              continue
            }

            console.log(`✅ 재고 할당 성공 - 상품: ${item.productName}, 할당량: ${allocatedQuantity}개`)
          }
        } else {
          console.log(`❌ 가용 재고 없음 - 상품: ${item.productName}, 오류: ${stockError?.message || '없음'}`)
        }

        // 주문 아이템에 할당된 수량 업데이트 (할당 성공 시에만)
        if (allocatedQuantity > 0) {
          const { error: updateError } = await supabase
            .from('order_items')
            .update({
              shipped_quantity: allocatedQuantity
            })
            .eq('order_id', order.id)
            .eq('product_id', item.productId)
            .eq('color', item.color || '기본')
            .eq('size', item.size || '기본')

          if (updateError) {
            console.error('주문 아이템 업데이트 실패:', updateError)
            // 할당된 재고 롤백
            await supabase
              .rpc('deallocate_stock', {
                p_product_id: item.productId,
                p_quantity: allocatedQuantity,
                p_color: item.color,
                p_size: item.size
              })
            allocatedQuantity = 0
            allItemsFullyAllocated = false
            continue
          }

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
    let orderStatus = 'pending'  // 대기중
    if (allItemsFullyAllocated) {
      orderStatus = 'processing' // 작업중 (전량 할당 완료)
    } else if (hasPartialAllocation) {
      orderStatus = 'processing' // 작업중 (부분 할당)
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