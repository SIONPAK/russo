import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'

// GET - 어드민 주문 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    
    const offset = (page - 1) * limit
    const supabase = createClient()

    // 기본 쿼리
    let query = supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          company_name,
          representative_name,
          phone,
          email
        ),
        order_items (
          id,
          product_name,
          color,
          size,
          quantity,
          unit_price,
          total_price,
          products (
            name,
            images:product_images!product_images_product_id_fkey (
              image_url,
              is_main
            )
          )
        )
      `, { count: 'exact' })

    // 검색 조건 (주문번호, 회사명으로 검색)
    if (search) {
      query = query.or(`order_number.ilike.%${search}%,users.company_name.ilike.%${search}%`)
    }

    // 상태 필터
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // 날짜 필터
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate + 'T23:59:59.999Z')
    }

    // 정렬 및 페이지네이션
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: orders, error, count } = await query

    if (error) {
      console.error('Admin orders fetch error:', error)
      return NextResponse.json(
        { success: false, error: '주문 목록을 불러오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    // 주문 통계 계산
    const { data: stats } = await supabase
      .from('orders')
      .select('status')

    const orderStats = {
      pending: stats?.filter(order => order.status === 'pending').length || 0,
      confirmed: stats?.filter(order => order.status === 'confirmed').length || 0,
      shipped: stats?.filter(order => order.status === 'shipped').length || 0,
      delivered: stats?.filter(order => order.status === 'delivered').length || 0,
      cancelled: stats?.filter(order => order.status === 'cancelled').length || 0,
      total: stats?.length || 0
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: {
        orders: orders || [],
        stats: orderStats,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount: count || 0,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    })

  } catch (error) {
    console.error('Admin orders API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// PUT - 주문 상태 일괄 업데이트
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderIds, status, trackingNumbers } = body

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { success: false, error: '주문 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    if (!status) {
      return NextResponse.json(
        { success: false, error: '상태가 필요합니다.' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    const updates: any = { 
      status,
      updated_at: new Date().toISOString()
    }

    // 배송 상태로 변경하는 경우 배송 시작 시간 기록
    if (status === 'shipped') {
      updates.shipped_at = new Date().toISOString()
    }

    // 배송 완료로 변경하는 경우 배송 완료 시간 기록
    if (status === 'delivered') {
      updates.delivered_at = new Date().toISOString()
    }

    // 운송장 번호가 제공된 경우
    if (trackingNumbers && Array.isArray(trackingNumbers)) {
      // 각 주문별로 개별 업데이트 (운송장 번호가 다를 수 있음)
      for (let i = 0; i < orderIds.length; i++) {
        const orderId = orderIds[i]
        const trackingNumber = trackingNumbers[i]
        
        const updateData = { ...updates }
        if (trackingNumber) {
          updateData.tracking_number = trackingNumber
        }

        const { error } = await supabase
          .from('orders')
          .update(updateData)
          .eq('id', orderId)

        if (error) {
          console.error(`Order ${orderId} update error:`, error)
        }
      }
    } else {
      // 일괄 업데이트 (운송장 번호 없는 경우)
      const { error } = await supabase
        .from('orders')
        .update(updates)
        .in('id', orderIds)

      if (error) {
        console.error('Bulk order update error:', error)
        return NextResponse.json(
          { success: false, error: '주문 상태 업데이트에 실패했습니다.' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      message: `${orderIds.length}건의 주문이 성공적으로 업데이트되었습니다.`
    })

  } catch (error) {
    console.error('Admin orders update API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 