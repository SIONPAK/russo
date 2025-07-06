import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const color = searchParams.get('color')
    const size = searchParams.get('size')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const supabase = await createClient()

    // 상품 정보 조회
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, code')
      .eq('id', id)
      .single()

    if (productError || !product) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 먼저 날짜 필터에 맞는 주문들을 조회
    let ordersQuery = supabase
      .from('orders')
      .select('id, created_at')

    if (startDate) {
      ordersQuery = ordersQuery.gte('created_at', startDate)
    }
    if (endDate) {
      ordersQuery = ordersQuery.lte('created_at', endDate + 'T23:59:59')
    }

    const { data: filteredOrders, error: ordersError } = await ordersQuery.order('created_at', { ascending: false })

    if (ordersError) {
      console.error('Orders fetch error:', ordersError)
      return NextResponse.json({
        success: false,
        error: '주문 데이터 조회 실패'
      }, { status: 500 })
    }

    const filteredOrderIds = (filteredOrders || []).map(order => order.id)

    // 재고 이력 조회 (주문 아이템에서 출고 이력)
    let orderHistoryQuery = supabase
      .from('order_items')
      .select(`
        id,
        quantity,
        shipped_quantity,
        color,
        size,
        order_id
      `)
      .eq('product_id', id)

    if (filteredOrderIds.length > 0) {
      orderHistoryQuery = orderHistoryQuery.in('order_id', filteredOrderIds)
    }

    if (color) {
      orderHistoryQuery = orderHistoryQuery.eq('color', color)
    }
    if (size) {
      orderHistoryQuery = orderHistoryQuery.eq('size', size)
    }

    const { data: orderHistory, error: orderError } = await orderHistoryQuery.limit(limit)

    if (orderError) {
      console.error('Order history error:', orderError)
      return NextResponse.json({
        success: false,
        error: '주문 이력 조회 실패'
      }, { status: 500 })
    }

    // 주문 정보 조회
    const orderIds = (orderHistory || []).map(item => item.order_id)
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_number, status, created_at, user_id')
      .in('id', orderIds)

    // 사용자 정보 조회
    const userIds = [...new Set((orders || []).map(order => order.user_id))]
    const { data: users } = await supabase
      .from('users')
      .select('id, company_name')
      .in('id', userIds)

    // 매핑 생성
    const orderMap = new Map((orders || []).map(order => [order.id, order]))
    const userMap = new Map((users || []).map(user => [user.id, user]))

    // 재고 조정 이력 (가상의 테이블 - 실제로는 로그 테이블이 필요)
    // 현재는 주문 이력만 제공하고, 추후 재고 조정 로그 테이블 추가 시 확장

    // 이력 데이터 포맷팅
    const history = (orderHistory || []).map((item: any) => {
      const order = orderMap.get(item.order_id)
      const user = order ? userMap.get(order.user_id) : null
      
      return {
        id: item.id,
        type: 'order',
        description: `주문 출고 - ${user?.company_name || '알 수 없음'}`,
        quantity: -(item.shipped_quantity || 0), // 출고는 음수
        color: item.color,
        size: item.size,
        order_number: order?.order_number || '',
        order_status: order?.status || '',
        created_at: order?.created_at || item.created_at,
        reference_id: order?.id || ''
      }
    })

    // 현재 재고 상태 조회
    let currentStock = 0
    if (product && color && size) {
      // 옵션별 재고 조회
      const { data: currentProduct } = await supabase
        .from('products')
        .select('inventory_options')
        .eq('id', id)
        .single()

      if (currentProduct?.inventory_options) {
        const option = currentProduct.inventory_options.find(
          (opt: any) => opt.color === color && opt.size === size
        )
        currentStock = option?.stock_quantity || 0
      }
    } else {
      // 전체 재고 조회
      const { data: currentProduct } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', id)
        .single()
      
      currentStock = currentProduct?.stock_quantity || 0
    }

    return NextResponse.json({
      success: true,
      data: {
        product,
        currentStock,
        history,
        filter: { color, size, startDate, endDate },
        totalCount: history.length
      }
    })

  } catch (error) {
    console.error('Inventory history API error:', error)
    return NextResponse.json({
      success: false,
      error: '재고 이력 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 