import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// GET - 차감 명세서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    const offset = (page - 1) * limit

    let query = supabase
      .from('statements')
      .select(`
        *,
        users!statements_user_id_fkey (
          company_name,
          representative_name,
          phone,
          email
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
      .eq('statement_type', 'deduction')

    // 검색 조건
    if (search) {
      query = query.or(
        `statement_number.ilike.%${search}%,` +
        `users.company_name.ilike.%${search}%,` +
        `users.representative_name.ilike.%${search}%`
      )
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
      console.error('차감 명세서 조회 오류:', error)
      return NextResponse.json({
        success: false,
        error: '차감 명세서 조회에 실패했습니다.'
      }, { status: 500 })
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: {
        statements: statements || [],
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: count || 0,
          itemsPerPage: limit
        }
      }
    })

  } catch (error) {
    console.error('차감 명세서 조회 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '차감 명세서 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// POST - 차감 명세서 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { 
      userId, 
      reason, 
      items, 
      notes 
    } = await request.json()

    // 차감 명세서 번호 생성
    const statementNumber = `DED-${Date.now()}`

    // 총 차감 금액 계산
    const totalAmount = items.reduce((sum: number, item: any) => {
      return sum + (item.quantity * item.unit_price)
    }, 0)

    // 차감 명세서 생성
    const { data: statement, error: statementError } = await supabase
      .from('statements')
      .insert({
        statement_number: statementNumber,
        statement_type: 'deduction',
        user_id: userId,
        total_amount: totalAmount,
        reason,
        notes,
        status: 'issued',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (statementError) {
      console.error('차감 명세서 생성 오류:', statementError)
      return NextResponse.json({ 
        success: false, 
        error: '차감 명세서 생성에 실패했습니다.' 
      }, { status: 500 })
    }

    // 차감 아이템들 생성
    const statementItems = items.map((item: any) => {
      const totalAmount = item.quantity * item.unit_price
      
      return {
        statement_id: statement.id,
        product_name: item.product_name,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_amount: totalAmount
      }
    })

    const { error: itemsError } = await supabase
      .from('statement_items')
      .insert(statementItems)

    if (itemsError) {
      console.error('차감 아이템 생성 오류:', itemsError)
      return NextResponse.json({ 
        success: false, 
        error: '차감 아이템 생성에 실패했습니다.' 
      }, { status: 500 })
    }

    // 사용자 마일리지 차감
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('mileage')
      .eq('id', userId)
      .single()

    if (!userError && user) {
      const newMileage = Math.max(0, (user.mileage || 0) - totalAmount)
      
      await supabase
        .from('users')
        .update({ mileage: newMileage })
        .eq('id', userId)

      // 마일리지 이력 기록
      await supabase
        .from('mileage_logs')
        .insert({
          user_id: userId,
          amount: -totalAmount,
          type: 'deduction',
          description: `차감 명세서: ${statementNumber} - ${reason}`,
          balance_after: newMileage,
          statement_id: statement.id,
          created_at: new Date().toISOString()
        })
    }

    console.log('차감 명세서 생성 완료:', { 
      statementNumber, 
      totalAmount, 
      itemsCount: items.length 
    })

    return NextResponse.json({
      success: true,
      data: {
        statement: statement,
        statement_number: statementNumber,
        total_amount: totalAmount,
        items_count: items.length
      }
    })

  } catch (error) {
    console.error('차감 명세서 생성 API 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '차감 명세서 생성 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}

// PUT - 차감 명세서 상태 업데이트
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { statementIds, status } = await request.json()

    const { data, error } = await supabase
      .from('statements')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .in('id', statementIds)
      .eq('statement_type', 'deduction')
      .select()

    if (error) {
      console.error('차감 명세서 상태 업데이트 오류:', error)
      return NextResponse.json({ 
        success: false, 
        error: '차감 명세서 상태 업데이트에 실패했습니다.' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        updated: data.length 
      } 
    })

  } catch (error) {
    console.error('차감 명세서 상태 업데이트 API 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '차감 명세서 상태 업데이트 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 