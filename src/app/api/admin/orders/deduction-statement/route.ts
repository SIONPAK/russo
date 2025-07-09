import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { executeBatchQuery } from '@/shared/lib/batch-utils'

// GET - 차감명세서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const companyName = searchParams.get('companyName') || ''
    const deductionType = searchParams.get('deductionType') || 'all'
    const status = searchParams.get('status') || 'all'

    const offset = (page - 1) * limit

    // 차감명세서 조회 (statements 테이블에서 차감 관련 명세서)
    let query = supabase
      .from('statements')
      .select(`
        *,
        users!statements_user_id_fkey (
          id,
          company_name,
          representative_name,
          email,
          phone,
          address
        ),
        orders!statements_order_id_fkey (
          id,
          order_number,
          total_amount,
          created_at
        ),
        statement_items!statement_items_statement_id_fkey (
          id,
          product_name,
          color,
          size,
          quantity,
          unit_price,
          total_amount
        )
      `)
      .in('statement_type', ['deduction', 'return', 'refund']) // 차감 관련 명세서만

    // 검색 조건 적용
    if (search) {
      query = query.or(`statement_number.ilike.%${search}%,reason.ilike.%${search}%`)
    }

    // 업체명 필터
    if (companyName) {
      // 사용자 테이블과 조인해서 업체명으로 필터링
      query = query.eq('users.company_name', companyName)
    }

    // 차감 유형 필터
    if (deductionType !== 'all') {
      query = query.eq('statement_type', deductionType)
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
      query = query.lte('created_at', endDate + 'T23:59:59')
    }

    // 배치 처리로 전체 데이터 조회
    const batchResult = await executeBatchQuery(
      query.order('created_at', { ascending: false }),
      '차감명세서'
    )

    if (batchResult.error) {
      console.error('차감명세서 조회 오류:', batchResult.error)
      return NextResponse.json({
        success: false,
        error: '차감명세서 조회에 실패했습니다.'
      }, { status: 500 })
    }

    const allStatements = batchResult.data
    const count = batchResult.totalCount

    // 페이지네이션 적용
    const statements = allStatements.slice(offset, offset + limit)

    // 차감명세서 데이터 가공
    const deductionStatements = statements?.map((statement: any) => ({
      id: statement.id,
      statement_number: statement.statement_number,
      statement_type: statement.statement_type,
      company_name: statement.users?.company_name || '알 수 없음',
      representative_name: statement.users?.representative_name || '',
      customer_email: statement.users?.email || '',
      customer_phone: statement.users?.phone || '',
      order_number: statement.orders?.order_number || '',
      total_amount: statement.total_amount,
      reason: statement.reason || '',
      notes: statement.notes || '',
      status: statement.status,
      created_at: statement.created_at,
      updated_at: statement.updated_at,
      items: statement.statement_items || [],
      original_order_amount: statement.orders?.total_amount || 0,
      deduction_date: statement.created_at
    })) || []

    return NextResponse.json({
      success: true,
      data: deductionStatements,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error) {
    console.error('Deduction statements API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// POST - 차감명세서 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { 
      userId, 
      orderId, 
      deductionType, 
      reason, 
      items, 
      totalAmount,
      notes 
    } = await request.json()

    if (!userId || !deductionType || !reason || !items || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 })
    }

    // 차감명세서 번호 생성
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '')
    const timeStr = now.toTimeString().slice(0, 5).replace(':', '')
    const statementNumber = `DED-${dateStr}-${timeStr}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`

    // 차감명세서 생성
    const { data: statement, error: statementError } = await supabase
      .from('statements')
      .insert({
        statement_number: statementNumber,
        statement_type: deductionType,
        user_id: userId,
        order_id: orderId,
        total_amount: totalAmount,
        reason,
        notes,
        status: 'issued',
        created_at: now.toISOString()
      })
      .select()
      .single()

    if (statementError) {
      console.error('Deduction statement creation error:', statementError)
      return NextResponse.json({
        success: false,
        error: '차감명세서 생성에 실패했습니다.'
      }, { status: 500 })
    }

    // 차감명세서 아이템 생성
    const statementItems = items.map((item: any) => ({
      statement_id: statement.id,
      product_name: item.product_name,
      color: item.color || '',
      size: item.size || '',
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_amount: item.total_amount
    }))

    const { error: itemsError } = await supabase
      .from('statement_items')
      .insert(statementItems)

    if (itemsError) {
      console.error('Deduction statement items creation error:', itemsError)
      // 차감명세서 롤백
      await supabase.from('statements').delete().eq('id', statement.id)
      return NextResponse.json({
        success: false,
        error: '차감명세서 아이템 생성에 실패했습니다.'
      }, { status: 500 })
    }

    // 사용자 마일리지 차감 처리 (차감명세서인 경우)
    if (deductionType === 'deduction') {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('mileage_balance')
        .eq('id', userId)
        .single()

      if (!userError && userData) {
        const newMileageBalance = Math.max(0, userData.mileage_balance - totalAmount)
        
        await supabase
          .from('users')
          .update({ mileage_balance: newMileageBalance })
          .eq('id', userId)

        // 마일리지 변동 이력 기록
        await supabase
          .from('mileage_logs')
          .insert({
            user_id: userId,
            amount: -totalAmount,
            balance_after: newMileageBalance,
            type: 'deduction',
            description: `차감명세서 발행 (${statementNumber})`,
            reference_type: 'statement',
            reference_id: statement.id,
            created_at: now.toISOString()
          })
      }
    }

    return NextResponse.json({
      success: true,
      data: statement,
      message: '차감명세서가 성공적으로 생성되었습니다.'
    })

  } catch (error) {
    console.error('Deduction statement creation API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 