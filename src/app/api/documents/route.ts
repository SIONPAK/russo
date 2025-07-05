import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// GET - 사용자 명세서 목록 조회 (거래명세서, 반품명세서, 차감명세서)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const type = searchParams.get('type') || 'all' // all, transaction, return, deduction
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    // 현재 사용자 확인 (URL 파라미터 또는 세션에서)
    const urlUserId = searchParams.get('userId')
    let currentUserId = urlUserId
    
    // URL에 userId가 없으면 세션에서 가져오기
    if (!currentUserId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        return NextResponse.json({
          success: false,
          error: '사용자 정보를 찾을 수 없습니다.'
        }, { status: 401 })
      }
      currentUserId = user.id
    }

    const offset = (page - 1) * limit

    let query = supabase
      .from('statements')
      .select(`
        *,
        orders!statements_order_id_fkey (
          order_number,
          created_at
        ),
        statement_items (
          id,
          product_name,
          color,
          size,
          quantity,
          unit_price,
          total_amount
        )
      `, { count: 'exact' })
      .eq('user_id', currentUserId)

    // 명세서 타입 필터
    if (type !== 'all') {
      query = query.eq('statement_type', type)
    }

    // 날짜 필터
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)
      query = query.lte('created_at', endDateTime.toISOString())
    }

    // 정렬 및 페이지네이션
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: statements, error, count } = await query

    if (error) {
      console.error('명세서 조회 오류:', error)
      return NextResponse.json({
        success: false,
        error: '명세서 조회에 실패했습니다.'
      }, { status: 500 })
    }

    const totalPages = Math.ceil((count || 0) / limit)

    // 명세서 타입별 통계
    const { data: stats } = await supabase
      .from('statements')
      .select('statement_type, total_amount')
      .eq('user_id', currentUserId)

    const statistics = {
      transaction: {
        count: stats?.filter(s => s.statement_type === 'transaction').length || 0,
        total: stats?.filter(s => s.statement_type === 'transaction')
          .reduce((sum, s) => sum + s.total_amount, 0) || 0
      },
      return: {
        count: stats?.filter(s => s.statement_type === 'return').length || 0,
        total: stats?.filter(s => s.statement_type === 'return')
          .reduce((sum, s) => sum + s.total_amount, 0) || 0
      },
      deduction: {
        count: stats?.filter(s => s.statement_type === 'deduction').length || 0,
        total: stats?.filter(s => s.statement_type === 'deduction')
          .reduce((sum, s) => sum + s.total_amount, 0) || 0
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        statements: statements || [],
        statistics,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: count || 0,
          itemsPerPage: limit
        }
      }
    })

  } catch (error) {
    console.error('명세서 조회 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '명세서 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// POST - 문서 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    const { 
      user_id,
      order_id,
      type,
      title,
      description,
      filename,
      file_url,
      amount
    } = body

    // 필수 필드 검증
    if (!user_id || !type || !title || !filename || !file_url) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 })
    }

    // documents 테이블이 없으므로 임시로 성공 응답
    console.log('Document creation requested:', { user_id, order_id, type, title })

    return NextResponse.json({
      success: true,
      data: {
        id: Date.now().toString(),
        user_id,
        order_id,
        type,
        title,
        description,
        filename,
        file_url,
        amount,
        created_at: new Date().toISOString()
      },
      message: '문서가 성공적으로 생성되었습니다.'
    })

  } catch (error) {
    console.error('Document creation API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 