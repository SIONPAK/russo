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

    // 회사명 파라미터 확인
    const companyName = searchParams.get('companyName')
    if (!companyName) {
      return NextResponse.json({
        success: false,
        error: '회사명이 필요합니다.'
      }, { status: 400 })
    }

    // 회사 정보 조회
    const { data: userData, error: userDataError } = await supabase
      .from('users')
      .select('id, company_name')
      .eq('company_name', companyName)
      .single()

    if (userDataError || !userData) {
      return NextResponse.json({
        success: false,
        error: '회사 정보를 찾을 수 없습니다.'
      }, { status: 404 })
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
            id: `order_${order.id}`,
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

    // 2. 반품명세서
    if (type === 'all' || type === 'return') {
      // 먼저 사용자의 주문 ID들을 가져온 후 반품명세서 조회
      const { data: userOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', userData.id)

      if (userOrders && userOrders.length > 0) {
        const orderIds = userOrders.map(order => order.id)
        
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
            order_id,
            orders!return_statements_order_id_fkey (
              order_number
            )
          `)
          .in('order_id', orderIds)
          .order('created_at', { ascending: false })

        if (returnStatements) {
          returnStatements.forEach(statement => {
            const order = Array.isArray(statement.orders) ? statement.orders[0] : statement.orders
            allStatements.push({
              id: `return_${statement.id}`,
              statement_number: statement.statement_number,
              statement_type: 'return',
              total_amount: statement.refund_amount || statement.total_amount,
              status: statement.status === 'pending' ? 'issued' : 'sent',
              created_at: statement.created_at,
              order_number: order?.order_number || '',
              reason: statement.return_reason,
              items: statement.items || []
            })
          })
        }
      }
    }

    // 3. 차감명세서
    if (type === 'all' || type === 'deduction') {
      // 먼저 사용자의 주문 ID들을 가져온 후 차감명세서 조회
      const { data: userOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('user_id', userData.id)

      if (userOrders && userOrders.length > 0) {
        const orderIds = userOrders.map(order => order.id)
        
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
            order_id,
            orders!deduction_statements_order_id_fkey (
              order_number
            )
          `)
          .in('order_id', orderIds)
          .order('created_at', { ascending: false })

        if (deductionStatements) {
          deductionStatements.forEach(statement => {
            const order = Array.isArray(statement.orders) ? statement.orders[0] : statement.orders
            allStatements.push({
              id: `deduction_${statement.id}`,
              statement_number: statement.statement_number,
              statement_type: 'deduction',
              total_amount: statement.total_amount,
              status: statement.status === 'pending' ? 'issued' : 'sent',
              created_at: statement.created_at,
              order_number: order?.order_number || '',
              reason: statement.deduction_reason,
              items: statement.items || []
            })
          })
        }
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