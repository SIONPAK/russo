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
        items,
        orders!return_statements_order_id_fkey (
          id,
          user_id,
          order_type,
          users!orders_user_id_fkey (
            id,
            company_name,
            mileage_balance
          )
        ),
        return_reason
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

        // 발주서 기반 반품인지 확인 (return_reason이 '발주서 반품 요청'인 경우만 마일리지 적립)
        const isPurchaseReturn = statement.return_reason === '발주서 반품 요청'

        if (!user && !order?.user_id) {
          // 사용자 정보가 없는 경우 (관리자가 직접 생성한 경우) 회사명으로 사용자 찾기
          console.log(`⚠️ 사용자 정보 없음 - 관리자 생성 반품명세서: ${statement.statement_number}`)
          
          // 회사명으로 사용자 정보 조회
          const { data: userByCompany, error: userError } = await supabase
            .from('users')
            .select('id, company_name, mileage_balance')
            .eq('company_name', statement.company_name)
            .single()

          if (userError || !userByCompany) {
            console.log(`⚠️ 회사명으로 사용자 찾기 실패: ${statement.company_name}`)
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

                      // 관리자 생성 반품 명세서도 재고 복원 처리
          if (statement.items && Array.isArray(statement.items)) {
            for (const item of statement.items) {
              if (item.product_id && item.return_quantity && item.return_quantity > 0) {
                try {
                  const { data: restoreResult, error: restoreError } = await supabase
                    .rpc('adjust_physical_stock', {
                      p_product_id: item.product_id,
                      p_color: item.color || null,
                      p_size: item.size || null,
                      p_quantity_change: item.return_quantity, // 양수로 복원
                      p_reason: `관리자 생성 반품 완료 - ${statement.statement_number} (${item.product_name})`
                    })

                  if (restoreError || !restoreResult) {
                    console.error('❌ 관리자 생성 반품 재고 복원 실패:', restoreError)
                  } else {
                    console.log('✅ 관리자 생성 반품 재고 복원 완료:', item.product_name)
                    
                    // 재고 변동 이력 기록
                    await supabase
                      .from('stock_movements')
                      .insert({
                        product_id: item.product_id,
                        movement_type: 'return_in',
                        quantity: item.return_quantity,
                        color: item.color || null,
                        size: item.size || null,
                        notes: `관리자 생성 반품 완료 - ${statement.statement_number} (${item.product_name})`,
                        reference_id: statement.id,
                        reference_type: 'return_statement',
                        created_at: getKoreaTime()
                      })
                  }
                } catch (restoreError) {
                  console.error('❌ 관리자 생성 반품 재고 복원 처리 오류:', restoreError)
                }
              }
            }
          }

          // 관련 주문 상태 업데이트 (선택사항)
          await supabase
            .from('orders')
            .update({
              updated_at: getKoreaTime()
            })
            .eq('id', statement.order_id)

          processedCount++
          console.log(`✅ 관리자 생성 반품 명세서 처리 완료 (사용자 없음): ${statement.statement_number}`)
          continue
          }

          // 관리자 생성 반품명세서도 마일리지 적립 진행
          const currentMileage = userByCompany.mileage_balance || 0
          const refundAmount = statement.refund_amount || statement.total_amount
          const newMileage = currentMileage + refundAmount

          // 1. 마일리지 증가 기록을 mileage 테이블에 추가
          const { error: mileageRecordError } = await supabase
            .from('mileage')
            .insert({
              user_id: userByCompany.id,
              amount: refundAmount,
              type: 'earn',
              source: 'refund',
              description: `관리자 생성 반품명세서 처리 - ${statement.statement_number}`,
              status: 'completed',
              order_id: statement.order_id,
              created_at: getKoreaTime()
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
            .eq('id', userByCompany.id)

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

          // 4. 관련 주문 상태 업데이트 (선택사항)
          await supabase
            .from('orders')
            .update({
              updated_at: getKoreaTime()
            })
            .eq('id', statement.order_id)

          processedCount++
          totalMileageAdded += refundAmount
          console.log(`✅ 관리자 생성 반품 명세서 처리 완료 (마일리지 적립): ${statement.statement_number}, 환불 금액: ${refundAmount}`)
          continue
        }

        // 발주서 기반 반품이 아닌 경우 마일리지 적립 없이 처리
        if (!isPurchaseReturn) {
          console.log(`⚠️ 발주서 기반 반품이 아님 - 마일리지 적립 없이 처리: ${statement.statement_number}`)
          
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

          // 발주서 기반 반품이 아닌 경우에도 재고 복원 처리
          if (statement.items && Array.isArray(statement.items)) {
            for (const item of statement.items) {
              if (item.product_id && item.return_quantity && item.return_quantity > 0) {
                try {
                  const { data: restoreResult, error: restoreError } = await supabase
                    .rpc('adjust_physical_stock', {
                      p_product_id: item.product_id,
                      p_color: item.color || null,
                      p_size: item.size || null,
                      p_quantity_change: item.return_quantity, // 양수로 복원
                      p_reason: `반품 완료 (마일리지 적립 없음) - ${statement.statement_number} (${item.product_name})`
                    })

                  if (restoreError || !restoreResult) {
                    console.error('❌ 반품 재고 복원 실패:', restoreError)
                  } else {
                    console.log('✅ 반품 재고 복원 완료:', item.product_name)
                    
                    // 재고 변동 이력 기록
                    await supabase
                      .from('stock_movements')
                      .insert({
                        product_id: item.product_id,
                        movement_type: 'return_in',
                        quantity: item.return_quantity,
                        color: item.color || null,
                        size: item.size || null,
                        notes: `반품 완료 (마일리지 적립 없음) - ${statement.statement_number} (${item.product_name})`,
                        reference_id: statement.id,
                        reference_type: 'return_statement',
                        created_at: getKoreaTime()
                      })
                  }
                } catch (restoreError) {
                  console.error('❌ 반품 재고 복원 처리 오류:', restoreError)
                }
              }
            }
          }

          // 관련 주문 상태 업데이트 (선택사항)
          await supabase
            .from('orders')
            .update({
              updated_at: getKoreaTime()
            })
            .eq('id', statement.order_id)

          processedCount++
          console.log(`✅ 반품 명세서 처리 완료 (마일리지 적립 없음): ${statement.statement_number}`)
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

        // 4. 반품 완료 시 재고 복원 (새로운 재고 관리 시스템 사용)
        if (statement.items && Array.isArray(statement.items)) {
          for (const item of statement.items) {
            if (item.product_id && item.return_quantity && item.return_quantity > 0) {
              try {
                const { data: restoreResult, error: restoreError } = await supabase
                  .rpc('adjust_physical_stock', {
                    p_product_id: item.product_id,
                    p_color: item.color || null,
                    p_size: item.size || null,
                    p_quantity_change: item.return_quantity, // 양수로 복원
                    p_reason: `반품 완료 - ${statement.statement_number} (${item.product_name})`
                  })

                if (restoreError || !restoreResult) {
                  console.error('❌ 반품 재고 복원 실패:', restoreError)
                } else {
                  console.log('✅ 반품 재고 복원 완료:', item.product_name)
                  
                  // 재고 변동 이력 기록
                  await supabase
                    .from('stock_movements')
                    .insert({
                      product_id: item.product_id,
                      movement_type: 'return_in',
                      quantity: item.return_quantity,
                      color: item.color || null,
                      size: item.size || null,
                      notes: `반품 완료 - ${statement.statement_number} (${item.product_name})`,
                      reference_id: statement.id,
                      reference_type: 'return_statement',
                      created_at: getKoreaTime()
                    })
                }
              } catch (restoreError) {
                console.error('❌ 반품 재고 복원 처리 오류:', restoreError)
              }
            }
          }
        }

        // 5. 관련 주문 상태 업데이트 (선택사항)
        await supabase
          .from('orders')
          .update({
            updated_at: getKoreaTime()
          })
          .eq('id', statement.order_id)

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