import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// 반품명세서 조회 API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const companyName = searchParams.get('companyName')
    const returnType = searchParams.get('returnType')
    const status = searchParams.get('status')

    let query = supabase
      .from('return_statements')
      .select(`
        *,
        orders!return_statements_order_id_fkey (
          order_number,
          users!orders_user_id_fkey (
            company_name,
            customer_grade
          )
        )
      `)
      .order('created_at', { ascending: false })

    // 날짜 필터
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate + 'T23:59:59')
    }

    // 회사명 필터
    if (companyName) {
      query = query.ilike('orders.users.company_name', `%${companyName}%`)
    }

    // 반품 유형 필터
    if (returnType && returnType !== 'all') {
      query = query.eq('return_type', returnType)
    }

    // 상태 필터
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Return statements fetch error:', error)
      return NextResponse.json({
        success: false,
        error: '반품명세서 조회 중 오류가 발생했습니다.'
      }, { status: 500 })
    }

    // 데이터 변환
    const statements = data?.map(statement => ({
      id: statement.id,
      statement_number: statement.statement_number,
      order_id: statement.order_id,
      order_number: statement.orders?.order_number || '',
      company_name: statement.orders?.users?.company_name || '',
      customer_grade: statement.orders?.users?.customer_grade || 'BRONZE',
      return_reason: statement.return_reason,
      return_type: statement.return_type,
      created_at: statement.created_at,
      processed_at: statement.processed_at,
      refunded: statement.refunded,
      refund_amount: statement.refund_amount,
      refund_method: statement.refund_method,
      status: statement.status,
      items: statement.items || [],
      total_amount: statement.total_amount,
      email_sent: statement.email_sent,
      email_sent_at: statement.email_sent_at
    })) || []

    return NextResponse.json({
      success: true,
      data: statements
    })

  } catch (error) {
    console.error('Return statements API error:', error)
    return NextResponse.json({
      success: false,
      error: '반품명세서 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 반품명세서 생성 API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const {
      order_id,
      return_reason,
      return_type,
      items,
      refund_method = 'mileage'
    } = body

    // 주문 정보 확인
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({
        success: false,
        error: '주문을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 반품 총액 계산
    const total_amount = items.reduce((sum: number, item: any) => 
      sum + (item.unit_price * item.return_quantity), 0
    )

    // 반품명세서 생성
    const { data: statement, error: statementError } = await supabase
      .from('return_statements')
      .insert({
        order_id,
        return_reason,
        return_type,
        items,
        total_amount,
        refund_amount: total_amount,
        refund_method,
        status: 'pending'
      })
      .select()
      .single()

    if (statementError) {
      console.error('Return statement creation error:', statementError)
      return NextResponse.json({
        success: false,
        error: '반품명세서 생성 중 오류가 발생했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: statement
    })

  } catch (error) {
    console.error('Return statement creation API error:', error)
    return NextResponse.json({
      success: false,
      error: '반품명세서 생성 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 반품명세서 일괄 처리 API
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { statementIds } = body

    if (!statementIds || statementIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '처리할 반품명세서를 선택해주세요.'
      }, { status: 400 })
    }

    // 반품명세서 승인 처리
    const { data, error } = await supabase
      .from('return_statements')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString()
      })
      .in('id', statementIds)
      .select()

    if (error) {
      console.error('Return statement processing error:', error)
      return NextResponse.json({
        success: false,
        error: '반품명세서 처리 중 오류가 발생했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: data?.length || 0
      }
    })

  } catch (error) {
    console.error('Return statement processing API error:', error)
    return NextResponse.json({
      success: false,
      error: '반품명세서 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 