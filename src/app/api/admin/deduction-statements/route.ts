import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime, getKoreaDate } from '@/shared/lib/utils'

// 차감명세서 조회 API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const yearMonth = searchParams.get('yearMonth') || getKoreaDate().slice(0, 7)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const companyName = searchParams.get('companyName')
    const deductionType = searchParams.get('deductionType')
    const status = searchParams.get('status')

    let query = supabase
      .from('deduction_statements')
      .select('*')
      .order('created_at', { ascending: false })

    // 날짜 필터 (DB에 이미 한국 시간으로 저장되어 있음)
    if (startDate) {
      const startDateObj = new Date(startDate)
      const startTimeStr = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')} 00:00:00`
      query = query.gte('created_at', startTimeStr)
    }
    if (endDate) {
      const endDateObj = new Date(endDate)
      const endTimeStr = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')} 23:59:59`
      query = query.lte('created_at', endTimeStr)
    }

    // 차감 유형 필터
    if (deductionType && deductionType !== 'all') {
      query = query.eq('deduction_type', deductionType)
    }

    // 상태 필터
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // 페이지네이션으로 모든 데이터 가져오기
    console.log('🔍 차감명세서 데이터 페이지네이션으로 조회 시작...')
    
    let allData: any[] = []
    let page = 0
    const limit = 1000
    let hasMore = true

    while (hasMore) {
      const { data: pageData, error } = await query
        .range(page * limit, (page + 1) * limit - 1)

      if (error) {
        console.error(`차감명세서 페이지 ${page} 조회 오류:`, error)
        return NextResponse.json({
          success: false,
          error: '차감명세서 조회 중 오류가 발생했습니다.'
        }, { status: 500 })
      }

      if (pageData && pageData.length > 0) {
        allData = allData.concat(pageData)
        console.log(`🔍 차감명세서 페이지 ${page + 1}: ${pageData.length}건 조회 (총 ${allData.length}건)`)
        page++
        
        if (pageData.length < limit) {
          hasMore = false
        }
      } else {
        hasMore = false
      }
    }

    console.log(`🔍 차감명세서 전체 데이터 조회 완료: ${allData.length}건`)
    const data = allData

    // 회사명으로 필터링 (클라이언트 사이드)
    let statements = data || []
    if (companyName) {
      statements = statements.filter(statement => {
        // company_name 필드가 있는 경우 직접 검색
        if (statement.company_name) {
          return statement.company_name.toLowerCase().includes(companyName.toLowerCase())
        }
        return false
      })
    }

    // 회사 정보 추가 조회 (customer_grade를 위해)
    const companyNames = [...new Set(statements.map(s => s.company_name).filter(Boolean))]
    const { data: companies } = await supabase
      .from('users')
      .select('company_name, customer_grade')
      .in('company_name', companyNames)

    const companyGradeMap = new Map(
      companies?.map(c => [c.company_name, c.customer_grade]) || []
    )

    // 데이터 변환 (주문번호 제거)
    const transformedStatements = statements.map(statement => ({
      id: statement.id,
      statement_number: statement.statement_number,
      company_name: statement.company_name || '',
      customer_grade: companyGradeMap.get(statement.company_name) || 'BRONZE',
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
    }))

    return NextResponse.json({
      success: true,
      data: transformedStatements
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
      company_name,
      deductionReason,
      deductionType,
      items
    } = body

    console.log('Received data:', { company_name, deductionReason, deductionType, items })

    // 입력 데이터 검증
    if (!company_name || !deductionReason || !deductionType || !items || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 })
    }

    // 회사 정보 확인
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, company_name, customer_grade, mileage_balance')
      .eq('company_name', company_name)
      .single()

    if (userError || !user) {
      console.error('User fetch error:', userError)
      return NextResponse.json({
        success: false,
        error: '회사를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 차감 총액 계산 (부가세 포함)
    const total_amount = items.reduce((sum: number, item: any) => {
      const supplyAmount = item.unit_price * item.deduction_quantity
      const vat = Math.floor(supplyAmount * 0.1)
      return sum + supplyAmount + vat
    }, 0)

    // 마일리지 차감 금액 계산 (차감 금액과 동일)
    const mileage_amount = total_amount

    // 명세서 번호 생성
    const today = new Date()
    const koreaTime = new Date(today.getTime() + (9 * 60 * 60 * 1000))
    const dateStr = koreaTime.toISOString().slice(0, 10).replace(/-/g, '')
    
    // 당일 차감명세서 개수 조회
    const { count } = await supabase
      .from('deduction_statements')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${koreaTime.toISOString().slice(0, 10)}T00:00:00+09:00`)
      .lt('created_at', `${koreaTime.toISOString().slice(0, 10)}T23:59:59+09:00`)

    const sequence = String((count || 0) + 1).padStart(4, '0')
    const statement_number = `DS-${dateStr}-${sequence}`

    // 차감명세서 생성 (company_name 직접 저장)
    const { data: statement, error: statementError } = await supabase
      .from('deduction_statements')
      .insert({
        statement_number,
        company_name,
        deduction_reason: deductionReason,
        deduction_type: deductionType,
        items,
        total_amount,
        mileage_amount,
        status: 'pending',
        mileage_deducted: false,
        email_sent: false,
        created_at: getKoreaTime(),
        updated_at: getKoreaTime()
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
              processed_by: null, // 관리자 ID가 있다면 추가
              created_at: getKoreaTime(),
              updated_at: getKoreaTime()
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
              updated_at: getKoreaTime()
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
              processed_at: getKoreaTime(),
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