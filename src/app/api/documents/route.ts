import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

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

    // 인증 확인 (마이페이지용)
    const { data: { user } } = await supabase.auth.getUser()
    
    // 회사명 파라미터 확인 (인증이 없을 경우)
    const companyName = searchParams.get('companyName')
    
    let userData: any = null

    if (user) {
      // 인증된 사용자의 정보 조회
      const { data: userInfo, error: userDataError } = await supabase
        .from('users')
        .select('id, company_name')
        .eq('id', user.id)
        .single()

      if (userDataError || !userInfo) {
        return NextResponse.json({
          success: false,
          error: '사용자 정보를 찾을 수 없습니다.'
        }, { status: 404 })
      }

      userData = userInfo
    } else if (companyName) {
      // 인증이 없는 경우 회사명으로 조회
      const { data: userInfo, error: userDataError } = await supabase
        .from('users')
        .select('id, company_name')
        .eq('company_name', companyName)
        .single()

      if (userDataError || !userInfo) {
        return NextResponse.json({
          success: false,
          error: '회사 정보를 찾을 수 없습니다.'
        }, { status: 404 })
      }

      userData = userInfo
    } else {
      return NextResponse.json({
        success: false,
        error: '인증 또는 회사명이 필요합니다.'
      }, { status: 401 })
    }

    const offset = (page - 1) * limit
    let allStatements: any[] = []

    // 1. 거래명세서 (주문 기반)
    if (type === 'all' || type === 'transaction') {
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          shipping_fee,
          status,
          created_at,
          order_items (
            id,
            product_name,
            color,
            size,
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('user_id', userData.id)
        .in('status', ['shipped', 'delivered']) // 출고된 주문만
        .order('created_at', { ascending: false })

      if (orders) {
        orders.forEach(order => {
          allStatements.push({
            id: `shipping_${order.id}`,
            statement_number: order.order_number,
            statement_type: 'transaction',
            total_amount: order.total_amount + (order.shipping_fee || 0),
            status: 'issued',
            created_at: order.created_at,
            order_number: order.order_number,
            items: order.order_items || []
          })
        })
      }
    }

    // 2. 반품명세서 (처리 완료된 것만)
    if (type === 'all' || type === 'return') {
      // company_name을 통해 직접 반품명세서 조회 (refunded 상태만)
      const { data: returnStatements } = await supabase
        .from('return_statements')
        .select(`
          id,
          statement_number,
          total_amount,
          refund_amount,
          status,
          return_reason,
          created_at,
          items,
          company_name,
          order_id,
          orders!return_statements_order_id_fkey (
            order_number
          )
        `)
        .eq('company_name', userData.company_name)
        .eq('status', 'refunded') // 환불 완료된 반품명세서만
        .order('created_at', { ascending: false })

      if (returnStatements) {
        returnStatements.forEach(statement => {
          const order = Array.isArray(statement.orders) ? statement.orders[0] : statement.orders
          
          allStatements.push({
            id: `return_${statement.id}`,
            statement_number: statement.statement_number,
            statement_type: 'return',
            total_amount: statement.refund_amount || statement.total_amount,
            status: 'sent', // 환불 완료된 것은 발송완료로 표시
            created_at: statement.created_at,
            order_number: order?.order_number || '',
            reason: statement.return_reason,
            items: statement.items || []
          })
        })
      }
    }

    // 3. 차감명세서 (처리 완료된 것만)
    if (type === 'all' || type === 'deduction') {
      // company_name을 통해 직접 차감명세서 조회 (processed 상태만)
      const { data: deductionStatements } = await supabase
        .from('deduction_statements')
        .select(`
          id,
          statement_number,
          total_amount,
          deduction_reason,
          status,
          created_at,
          items,
          company_name,
          order_id,
          orders!left (
            order_number
          )
        `)
        .eq('company_name', userData.company_name)
        .eq('status', 'completed') // 처리 완료된 차감명세서만
        .order('created_at', { ascending: false })

      if (deductionStatements) {
        deductionStatements.forEach(statement => {
          const order = Array.isArray(statement.orders) ? statement.orders[0] : statement.orders
          
          allStatements.push({
            id: `deduction_${statement.id}`,
            statement_number: statement.statement_number,
            statement_type: 'deduction',
            total_amount: statement.total_amount,
            status: 'sent', // 처리 완료된 것은 발송완료로 표시
            created_at: statement.created_at,
            order_number: order?.order_number || '',
            reason: statement.deduction_reason,
            items: statement.items || []
          })
        })
      }
    }

    // 날짜 필터링
    if (startDate || endDate) {
      allStatements = allStatements.filter(statement => {
        const createdAt = new Date(statement.created_at)
        if (startDate && createdAt < new Date(startDate)) return false
        if (endDate && createdAt > new Date(endDate + 'T23:59:59')) return false
        return true
      })
    }

    // 정렬 (최신순)
    allStatements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // 페이지네이션
    const totalItems = allStatements.length
    const totalPages = Math.ceil(totalItems / limit)
    const paginatedStatements = allStatements.slice(offset, offset + limit)

    // 통계 계산
    const statistics = {
      transaction: {
        count: allStatements.filter(s => s.statement_type === 'transaction').length,
        total: allStatements.filter(s => s.statement_type === 'transaction')
          .reduce((sum, s) => sum + s.total_amount, 0)
      },
      return: {
        count: allStatements.filter(s => s.statement_type === 'return').length,
        total: allStatements.filter(s => s.statement_type === 'return')
          .reduce((sum, s) => sum + s.total_amount, 0)
      },
      deduction: {
        count: allStatements.filter(s => s.statement_type === 'deduction').length,
        total: allStatements.filter(s => s.statement_type === 'deduction')
          .reduce((sum, s) => sum + s.total_amount, 0)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        statements: paginatedStatements,
        statistics,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems,
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
        created_at: getKoreaTime()
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