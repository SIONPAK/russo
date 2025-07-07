import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// PATCH - 반품 명세서 처리 (마일리지 증가)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { statementIds } = await request.json()

    if (!statementIds || !Array.isArray(statementIds) || statementIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '처리할 반품 명세서 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 반품 명세서 정보 조회 (orders를 통해 사용자 정보 가져오기)
    const { data: statements, error: statementsError } = await supabase
      .from('return_statements')
      .select(`
        id,
        statement_number,
        order_id,
        total_amount,
        refund_amount,
        status,
        refunded,
        company_name,
        orders!return_statements_order_id_fkey (
          id,
          user_id,
          users!orders_user_id_fkey (
            id,
            company_name,
            mileage_balance
          )
        )
      `)
      .in('id', statementIds)
      .eq('status', 'pending')

    if (statementsError) {
      console.error('반품 명세서 조회 오류:', statementsError)
      return NextResponse.json({
        success: false,
        error: '반품 명세서 조회에 실패했습니다.'
      }, { status: 500 })
    }

    if (!statements || statements.length === 0) {
      return NextResponse.json({
        success: false,
        error: '처리 가능한 반품 명세서가 없습니다.'
      }, { status: 404 })
    }

    let processedCount = 0
    let totalMileageAdded = 0
    const errors: string[] = []

    // 각 반품 명세서 처리
    for (const statement of statements) {
      try {
        if (statement.refunded) {
          errors.push(`${statement.statement_number}: 이미 처리됨`)
          continue
        }

        // 관리자가 직접 생성한 반품명세서의 경우 사용자 정보가 없을 수 있음
        const order = Array.isArray(statement.orders) ? statement.orders[0] : statement.orders
        const user = order?.users ? (Array.isArray(order.users) ? order.users[0] : order.users) : null

        if (!user && !order?.user_id) {
          // 사용자 정보가 없는 경우 (관리자가 직접 생성한 경우) 처리만 진행
          console.log(`⚠️ 사용자 정보 없음 - 관리자 생성 반품명세서: ${statement.statement_number}`)
          
          // 반품 명세서 상태만 업데이트
          const { error: statementError } = await supabase
            .from('return_statements')
            .update({
              status: 'refunded',
              refunded: true,
              processed_at: getKoreaTime(),
              updated_at: getKoreaTime()
            })
            .eq('id', statement.id)

          if (statementError) {
            console.error('반품 명세서 상태 업데이트 오류:', statementError)
            errors.push(`${statement.statement_number}: 상태 업데이트 실패`)
            continue
          }

          processedCount++
          console.log(`✅ 관리자 생성 반품 명세서 처리 완료: ${statement.statement_number}`)
          continue
        }

        const currentMileage = user?.mileage_balance || 0
        const refundAmount = statement.refund_amount || statement.total_amount
        const newMileage = currentMileage + refundAmount

        // 1. 마일리지 증가 기록을 mileage 테이블에 추가
        const { error: mileageRecordError } = await supabase
          .from('mileage')
          .insert({
            user_id: order.user_id,
            amount: refundAmount,
            type: 'earn',
            source: 'refund',
            description: `반품 명세서 처리 - ${statement.statement_number} (루소 실수로 인한 환불)`,
            status: 'completed',
            order_id: statement.order_id,
            created_at: getKoreaTime()
          })

        if (mileageRecordError) {
          console.error('마일리지 기록 추가 오류:', mileageRecordError)
          errors.push(`${statement.statement_number}: 마일리지 기록 추가 실패`)
          continue
        }

        // 2. 사용자 마일리지 잔액 업데이트 (반품은 루소의 실수로 인한 것이므로 마일리지 증가)
        const { error: mileageError } = await supabase
          .from('users')
          .update({
            mileage_balance: newMileage,
            updated_at: getKoreaTime()
          })
          .eq('id', order.user_id)

        if (mileageError) {
          console.error('마일리지 증가 오류:', mileageError)
          errors.push(`${statement.statement_number}: 마일리지 증가 실패`)
          continue
        }

        // 3. 반품 명세서 상태 업데이트
        const { error: statementError } = await supabase
          .from('return_statements')
          .update({
            status: 'refunded',
            refunded: true,
            processed_at: getKoreaTime(),
            updated_at: getKoreaTime()
          })
          .eq('id', statement.id)

        if (statementError) {
          console.error('반품 명세서 상태 업데이트 오류:', statementError)
          errors.push(`${statement.statement_number}: 상태 업데이트 실패`)
          continue
        }

        processedCount++
        totalMileageAdded += refundAmount

        console.log(`✅ 반품 명세서 처리 완료: ${statement.statement_number}, 환불 금액: ${refundAmount}`)

      } catch (error) {
        console.error(`반품 명세서 ${statement.statement_number} 처리 오류:`, error)
        errors.push(`${statement.statement_number}: 처리 중 오류 발생`)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processedCount,
        totalMileageAdded,
        errors: errors.length > 0 ? errors : null
      },
      message: `반품 처리 완료: 성공 ${processedCount}건, 총 환불 마일리지: ${totalMileageAdded.toLocaleString()}P`
    })

  } catch (error) {
    console.error('반품 명세서 처리 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '반품 명세서 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 