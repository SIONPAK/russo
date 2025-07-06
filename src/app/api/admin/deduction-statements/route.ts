import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// 차감명세서 조회 API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const companyName = searchParams.get('companyName')
    const deductionType = searchParams.get('deductionType')
    const status = searchParams.get('status')

    let query = supabase
      .from('deduction_statements')
      .select(`
        *,
        orders!deduction_statements_order_id_fkey (
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

    // 차감 유형 필터
    if (deductionType && deductionType !== 'all') {
      query = query.eq('deduction_type', deductionType)
    }

    // 상태 필터
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Deduction statements fetch error:', error)
      return NextResponse.json({
        success: false,
        error: '차감명세서 조회 중 오류가 발생했습니다.'
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
      deduction_reason: statement.deduction_reason,
      deduction_type: statement.deduction_type,
      created_at: statement.created_at,
      processed_at: statement.processed_at,
      mileage_deducted: statement.mileage_deducted,
      mileage_amount: statement.mileage_amount,
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
    console.error('Deduction statements API error:', error)
    return NextResponse.json({
      success: false,
      error: '차감명세서 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 차감명세서 생성 API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const {
      orderId,
      deductionReason,
      deductionType,
      items
    } = body

    console.log('Received data:', { orderId, deductionReason, deductionType, items })

    // 입력 데이터 검증
    if (!orderId || !deductionReason || !deductionType || !items || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 })
    }

    // 주문 정보 확인
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          company_name,
          customer_grade,
          mileage_balance
        )
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Order fetch error:', orderError)
      return NextResponse.json({
        success: false,
        error: '주문을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 차감 총액 계산
    const total_amount = items.reduce((sum: number, item: any) => 
      sum + (item.unit_price * item.deduction_quantity), 0
    )

    // 마일리지 차감 금액 계산 (차감 금액과 동일)
    const mileage_amount = total_amount

    // 명세서 번호 생성
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
    
    // 당일 차감명세서 개수 조회
    const { count } = await supabase
      .from('deduction_statements')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today.toISOString().slice(0, 10)}T00:00:00`)
      .lt('created_at', `${today.toISOString().slice(0, 10)}T23:59:59`)

    const sequence = String((count || 0) + 1).padStart(4, '0')
    const statement_number = `DS-${dateStr}-${sequence}`

    // 차감명세서 생성
    const { data: statement, error: statementError } = await supabase
      .from('deduction_statements')
      .insert({
        statement_number,
        order_id: orderId,
        deduction_reason: deductionReason,
        deduction_type: deductionType,
        items,
        total_amount,
        mileage_amount,
        status: 'pending',
        mileage_deducted: false,
        email_sent: false
      })
      .select()
      .single()

    if (statementError) {
      console.error('Deduction statement creation error:', statementError)
      return NextResponse.json({
        success: false,
        error: '차감명세서 생성 중 오류가 발생했습니다: ' + statementError.message
      }, { status: 500 })
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
      error: '차감명세서 생성 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 차감명세서 일괄 처리 API
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { statementIds } = body

    if (!statementIds || statementIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '처리할 차감명세서를 선택해주세요.'
      }, { status: 400 })
    }

    // 처리할 차감명세서 조회 (주문 정보 포함)
    const { data: statements, error: fetchError } = await supabase
      .from('deduction_statements')
      .select(`
        *,
        orders!deduction_statements_order_id_fkey (
          user_id,
          order_number,
          users!orders_user_id_fkey (
            id,
            company_name,
            mileage_balance
          )
        )
      `)
      .in('id', statementIds)

    if (fetchError) {
      console.error('Statements fetch error:', fetchError)
      return NextResponse.json({
        success: false,
        error: '차감명세서 조회 중 오류가 발생했습니다: ' + fetchError.message
      }, { status: 500 })
    }

    if (!statements || statements.length === 0) {
      return NextResponse.json({
        success: false,
        error: '처리할 차감명세서를 찾을 수 없습니다. 이미 처리되었거나 존재하지 않는 명세서입니다.'
      }, { status: 404 })
    }

    let processedCount = 0
    let totalMileageDeducted = 0
    const errors = []

    // 각 차감명세서별로 처리
    for (const statement of statements) {
      try {
        // 이미 처리된 명세서는 건너뛰기
        if (statement.status === 'completed') {
          errors.push(`${statement.orders.users.company_name}: 이미 처리된 차감명세서입니다`)
          continue
        }

        const userId = statement.orders.user_id
        const mileageAmount = statement.mileage_amount
        const currentBalance = statement.orders.users.mileage_balance || 0

        // 트랜잭션으로 처리
        const { error: transactionError } = await supabase.rpc('process_deduction_statement', {
          p_statement_id: statement.id,
          p_user_id: userId,
          p_mileage_amount: mileageAmount,
          p_order_number: statement.orders.order_number,
          p_description: `차감명세서 처리 - ${statement.statement_number}`
        })

        if (transactionError) {
          // RPC 함수가 없다면 수동으로 트랜잭션 처리
          console.log('RPC function not found, processing manually')
          
          // 1. 마일리지 차감 기록 생성
          const { error: mileageError } = await supabase
            .from('mileage')
            .insert({
              user_id: userId,
              amount: mileageAmount, // 양수로 저장
              type: 'spend', // spend 타입으로 차감
              source: 'manual',
              description: `차감명세서 처리 - ${statement.statement_number}`,
              status: 'completed',
              order_id: statement.order_id,
              processed_by: null // 관리자 ID가 있다면 추가
            })

          if (mileageError) {
            console.error('Mileage insert error:', mileageError)
            errors.push(`${statement.orders.users.company_name}: 마일리지 기록 생성 실패`)
            continue
          }

          // 2. 사용자 마일리지 잔액 업데이트
          const { error: userUpdateError } = await supabase
            .from('users')
            .update({
              mileage_balance: currentBalance - mileageAmount,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId)

          if (userUpdateError) {
            console.error('User balance update error:', userUpdateError)
            errors.push(`${statement.orders.users.company_name}: 마일리지 잔액 업데이트 실패`)
            continue
          }

          // 3. 차감명세서 상태 업데이트
          const { error: statementUpdateError } = await supabase
            .from('deduction_statements')
            .update({
              status: 'completed',
              processed_at: new Date().toISOString(),
              mileage_deducted: true
            })
            .eq('id', statement.id)

          if (statementUpdateError) {
            console.error('Statement update error:', statementUpdateError)
            errors.push(`${statement.orders.users.company_name}: 차감명세서 상태 업데이트 실패`)
            continue
          }
        }

        processedCount++
        totalMileageDeducted += mileageAmount

      } catch (error) {
        console.error(`Statement ${statement.id} processing error:`, error)
        errors.push(`${statement.orders.users.company_name}: 처리 중 오류 발생`)
      }
    }

    // 처리 결과 반환
    return NextResponse.json({
      success: true,
      message: `차감명세서 처리 완료 (성공: ${processedCount}건, 실패: ${errors.length}건)`,
      data: {
        processedCount,
        totalMileageDeducted,
        errors
      }
    })

  } catch (error) {
    console.error('Deduction statement processing API error:', error)
    return NextResponse.json({
      success: false,
      error: '차감명세서 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 