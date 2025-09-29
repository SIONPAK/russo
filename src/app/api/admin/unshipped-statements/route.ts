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
        if (userIds.length > 0 && orderIds.length > 0) {
          query = query.or(`user_id.in.(${userIds.join(',')}),order_id.in.(${orderIds.join(',')})`)
        } else if (userIds.length > 0) {
          query = query.in('user_id', userIds)
        } else if (orderIds.length > 0) {
          query = query.in('order_id', orderIds)
        }
      } else {
        // 검색어와 일치하는 결과가 없으면 빈 결과 반환
        return NextResponse.json({
          success: true,
          data: {
            statements: [],
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

    // 전체 개수 조회를 위한 별도 쿼리 (페이지네이션으로 모든 데이터 가져오기)
    let allStatements: any[] = [];
    let countPage = 0;
    const countLimit = 1000; // Supabase 기본 limit
    let hasMoreCount = true;

    console.log('🔍 미발송 내역 전체 데이터 페이지네이션으로 조회 시작...');

    while (hasMoreCount) {
      let countQuery = supabase
        .from('unshipped_statements')
        .select('id, created_at')
        .order('created_at', { ascending: false })
        .range(countPage * countLimit, (countPage + 1) * countLimit - 1);

      // 검색 조건 적용 (카운트에도 동일하게)
      if (search) {
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
          if (userIds.length > 0 && orderIds.length > 0) {
            countQuery = countQuery.or(`user_id.in.(${userIds.join(',')}),order_id.in.(${orderIds.join(',')})`)
          } else if (userIds.length > 0) {
            countQuery = countQuery.in('user_id', userIds)
          } else if (orderIds.length > 0) {
            countQuery = countQuery.in('order_id', orderIds)
          }
        } else {
          // 검색어와 일치하는 결과가 없으면 빈 결과
          hasMoreCount = false;
          break;
        }
      }

      // 상태 필터 적용 (카운트에도 동일하게)
      if (status !== 'all') {
        countQuery = countQuery.eq('status', status)
      }

      // 날짜 필터 적용 (카운트에도 동일하게)
      if (startDate) {
        countQuery = countQuery.gte('created_at', startDate)
      }
      if (endDate) {
        countQuery = countQuery.lte('created_at', endDate)
      }

      const { data: countPageData, error: countError } = await countQuery;

      if (countError) {
        console.error(`미발송 내역 카운트 페이지 ${countPage} 조회 오류:`, countError);
        break;
      }

      if (countPageData && countPageData.length > 0) {
        allStatements = allStatements.concat(countPageData);
        console.log(`🔍 미발송 내역 카운트 페이지 ${countPage + 1}: ${countPageData.length}건 조회 (총 ${allStatements.length}건)`);
        countPage++;
        
        // 1000건 미만이면 마지막 페이지
        if (countPageData.length < countLimit) {
          hasMoreCount = false;
        }
      } else {
        hasMoreCount = false;
      }
    }

    console.log(`🔍 미발송 내역 전체 데이터 조회 완료: ${allStatements.length}건`);

    // 페이지네이션 적용하여 데이터 조회
    const { data: statements, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('미출고 명세서 조회 오류:', error)
      return NextResponse.json({
        success: false,
        error: '미출고 명세서 조회 중 오류가 발생했습니다.'
      }, { status: 500 })
    }

    // 페이지네이션 정보 계산 (전체 데이터 수 사용)
    const totalCount = allStatements.length;
    const totalPages = Math.ceil(totalCount / limit)
    const pagination = {
      currentPage: page,
      totalPages,
      totalCount,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }

    return NextResponse.json({
      success: true,
      data: {
        statements: statements || [],
        pagination
      }
    })

  } catch (error) {
    console.error('미출고 명세서 조회 오류:', error)
    return NextResponse.json({
      success: false,
      error: '미출고 명세서 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 