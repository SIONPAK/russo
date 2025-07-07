import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// GET - 명세서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const statementType = searchParams.get('type') || ''
    const status = searchParams.get('status') || ''
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
        orders!statements_order_id_fkey (
          order_number
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

    // 검색 조건
    if (search) {
      query = query.or(
        `statement_number.ilike.%${search}%,` +
        `users.company_name.ilike.%${search}%,` +
        `users.representative_name.ilike.%${search}%`
      )
    }

    // 명세서 타입 필터
    if (statementType) {
      query = query.eq('statement_type', statementType)
    }

    // 상태 필터
    if (status) {
      query = query.eq('status', status)
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
        error: '명세서 목록을 불러오는데 실패했습니다.' 
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
          totalCount: count || 0,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    })

  } catch (error) {
    console.error('명세서 조회 API 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}

// POST - 명세서 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { 
      statementType,
      userId, 
      orderId,
      reason, 
      items, 
      notes 
    } = await request.json()

    // 명세서 번호 생성
    const prefix = statementType === 'transaction' ? 'TXN' : 
                   statementType === 'return' ? 'RTN' : 'DED'
    const statementNumber = `${prefix}${Date.now()}`

    // 총 금액 계산
    const totalAmount = items.reduce((sum: number, item: any) => {
      return sum + (item.quantity * item.unit_price)
    }, 0)

    // 명세서 생성
    const { data: statement, error: statementError } = await supabase
      .from('statements')
      .insert({
        statement_number: statementNumber,
        statement_type: statementType,
        user_id: userId,
        order_id: orderId || null,
        total_amount: totalAmount,
        reason,
        notes,
        status: 'issued',
        created_at: getKoreaTime()
      })
      .select()
      .single()

    if (statementError) {
      console.error('명세서 생성 오류:', statementError)
      return NextResponse.json({ 
        success: false, 
        error: '명세서 생성에 실패했습니다.' 
      }, { status: 500 })
    }

    // 명세서 아이템들 생성
    const statementItems = items.map((item: any) => ({
      statement_id: statement.id,
      product_name: item.product_name,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_amount: item.quantity * item.unit_price
    }))

    const { error: itemsError } = await supabase
      .from('statement_items')
      .insert(statementItems)

    if (itemsError) {
      console.error('명세서 아이템 생성 오류:', itemsError)
      return NextResponse.json({ 
        success: false, 
        error: '명세서 아이템 생성에 실패했습니다.' 
      }, { status: 500 })
    }

    // 차감명세서인 경우 마일리지 차감
    if (statementType === 'deduction') {
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('mileage')
        .eq('id', userId)
        .single()

      if (!userError && user) {
        const deductionAmount = Math.abs(totalAmount) // 차감 금액은 양수로 저장되어 있음
        const newMileage = Math.max(0, (user.mileage || 0) - deductionAmount)
        
        await supabase
          .from('users')
          .update({ mileage: newMileage })
          .eq('id', userId)

        // 마일리지 이력 기록
        await supabase
          .from('mileage_logs')
          .insert({
            user_id: userId,
            amount: -deductionAmount, // 음수로 기록
            type: 'deduction',
            description: `차감 명세서: ${statementNumber} - ${reason}`,
            balance_after: newMileage,
            statement_id: statement.id,
            created_at: getKoreaTime()
          })
      }
    }

    console.log('명세서 생성 완료:', { 
      statementNumber, 
      statementType,
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
    console.error('명세서 생성 API 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '명세서 생성 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}

// PUT - 명세서 상태 업데이트
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { statementIds, status } = await request.json()

    const updateData: any = { 
      status,
      updated_at: getKoreaTime()
    }

    if (status === 'sent') {
      updateData.sent_at = getKoreaTime()
    }

    const { data, error } = await supabase
      .from('statements')
      .update(updateData)
      .in('id', statementIds)
      .select()

    if (error) {
      console.error('명세서 상태 업데이트 오류:', error)
      return NextResponse.json({ 
        success: false, 
        error: '명세서 상태 업데이트에 실패했습니다.' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        updated: data.length 
      } 
    })

  } catch (error) {
    console.error('명세서 상태 업데이트 API 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '명세서 상태 업데이트 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 