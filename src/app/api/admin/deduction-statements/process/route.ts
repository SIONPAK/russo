import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// PATCH - 차감 명세서 처리 (마일리지 차감)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { statementIds } = await request.json()

    if (!statementIds || !Array.isArray(statementIds) || statementIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '처리할 차감 명세서 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 차감 명세서 정보 조회
    const { data: statements, error: statementsError } = await supabase
      .from('deduction_statements')
      .select('id, statement_number, company_name, total_amount, mileage_amount, status, mileage_deducted')
      .in('id', statementIds)
      .eq('status', 'pending')

    if (statementsError) {
      console.error('차감 명세서 조회 오류:', statementsError)
      return NextResponse.json({
        success: false,
        error: '차감 명세서 조회에 실패했습니다.'
      }, { status: 500 })
    }

    if (!statements || statements.length === 0) {
      return NextResponse.json({
        success: false,
        error: '처리 가능한 차감 명세서가 없습니다.'
      }, { status: 404 })
    }

    let processedCount = 0
    let totalMileageDeducted = 0
    const errors: string[] = []

    // 각 차감 명세서 처리
    for (const statement of statements) {
      try {
        if (statement.mileage_deducted) {
          errors.push(`${statement.statement_number}: 이미 처리됨`)
          continue
        }

        if (!statement.company_name) {
          errors.push(`${statement.statement_number}: 회사명 정보 없음`)
          continue
        }

        // 회사명으로 사용자 정보 조회
        const { data: user, error: userError } = await supabase
          .from('users')
          .select('id, company_name, mileage_balance')
          .eq('company_name', statement.company_name)
          .single()

        if (userError || !user) {
          console.error('사용자 조회 오류:', userError)
          errors.push(`${statement.statement_number}: 사용자 정보 없음`)
          continue
        }

        const currentMileage = user.mileage_balance || 0
        const deductionAmount = statement.mileage_amount || statement.total_amount
        const newMileage = currentMileage - deductionAmount // 음수 허용

        // 1. 마일리지 차감 기록을 mileage 테이블에 추가
        const { error: mileageRecordError } = await supabase
          .from('mileage')
          .insert({
            user_id: user.id,
            amount: -deductionAmount, // 차감이므로 음수
            type: 'spend',
            source: 'manual',
            description: `차감 명세서 처리 - ${statement.statement_number}`,
            status: 'completed',
            created_at: getKoreaTime(),
            updated_at: getKoreaTime()
          })

        if (mileageRecordError) {
          console.error('마일리지 기록 추가 오류:', mileageRecordError)
          errors.push(`${statement.statement_number}: 마일리지 기록 추가 실패`)
          continue
        }

        // 2. 사용자 마일리지 잔액 업데이트
        const { error: mileageError } = await supabase
          .from('users')
          .update({
            mileage_balance: newMileage,
            updated_at: getKoreaTime()
          })
          .eq('id', user.id)

        if (mileageError) {
          console.error('마일리지 차감 오류:', mileageError)
          errors.push(`${statement.statement_number}: 마일리지 차감 실패`)
          continue
        }

        // 3. 차감 명세서 상태 업데이트
        const { error: statementError } = await supabase
          .from('deduction_statements')
          .update({
            status: 'completed',
            mileage_deducted: true,
            processed_at: getKoreaTime(),
            updated_at: getKoreaTime()
          })
          .eq('id', statement.id)

        if (statementError) {
          console.error('차감 명세서 상태 업데이트 오류:', statementError)
          errors.push(`${statement.statement_number}: 상태 업데이트 실패`)
          continue
        }

        processedCount++
        totalMileageDeducted += deductionAmount

        console.log(`✅ 차감 명세서 처리 완료: ${statement.statement_number}, 차감 금액: ${deductionAmount}`)

      } catch (error) {
        console.error(`차감 명세서 ${statement.statement_number} 처리 오류:`, error)
        errors.push(`${statement.statement_number}: 처리 중 오류 발생`)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processedCount,
        totalMileageDeducted,
        errors: errors.length > 0 ? errors : null
      },
      message: `차감 처리 완료: 성공 ${processedCount}건, 총 차감 마일리지: ${totalMileageDeducted.toLocaleString()}P`
    })

  } catch (error) {
    console.error('차감 명세서 처리 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '차감 명세서 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 