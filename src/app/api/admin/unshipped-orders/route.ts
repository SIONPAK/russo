import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'all'
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    const offset = (page - 1) * limit

    // 미출고 명세서 목록 조회
    let query = supabase
      .from('unshipped_statements')
      .select(`
        id,
        statement_number,
        order_id,
        user_id,
        total_unshipped_amount,
        status,
        reason,
        created_at,
        updated_at,
        orders (
          order_number,
          created_at
        ),
        users (
          company_name,
          representative_name,
          email,
          phone
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

    // 검색 조건 적용
    if (search) {
      // 회사명 또는 주문번호로 검색
      const { data: matchingUsers } = await supabase
        .from('users')
        .select('id')
        .ilike('company_name', `%${search}%`)
      
      const { data: matchingOrders } = await supabase
        .from('orders')
        .select('id')
        .ilike('order_number', `%${search}%`)

      const userIds = matchingUsers?.map(u => u.id) || []
      const orderIds = matchingOrders?.map(o => o.id) || []

      if (userIds.length > 0 || orderIds.length > 0) {
        const conditions = []
        if (userIds.length > 0) {
          query = query.in('user_id', userIds)
        }
        if (orderIds.length > 0) {
          query = query.in('order_id', orderIds)
        }
      } else {
        // 검색어와 일치하는 결과가 없으면 빈 결과 반환
        return NextResponse.json({
          success: true,
          data: {
            unshippedOrders: [],
            pagination: {
              currentPage: page,
              totalPages: 0,
              totalCount: 0,
              hasNextPage: false,
              hasPrevPage: false
            }
          }
        })
      }
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

    // 전체 개수 조회
    const { count } = await query

    // 페이지네이션 적용하여 데이터 조회
    const { data: unshippedStatements, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('미출고 내역 조회 오류:', error)
      return NextResponse.json({
        success: false,
        error: '미출고 내역 조회 중 오류가 발생했습니다.'
      }, { status: 500 })
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
      success: true,
      data: {
        unshippedOrders: unshippedStatements || [],
        pagination
      }
    })

  } catch (error) {
    console.error('미출고 내역 조회 오류:', error)
    return NextResponse.json({
      success: false,
      error: '미출고 내역 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 