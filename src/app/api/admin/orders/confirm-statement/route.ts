import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime, getKoreaDateFormatted } from '@/shared/lib/utils'
import { sendEmail } from '@/shared/lib/email-utils'
import { generateConfirmedStatement } from '@/shared/lib/shipping-statement-utils'

// POST - 확정 명세서 생성 및 이메일 발송
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { orderIds } = await request.json()

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '주문 ID가 필요합니다.'
      }, { status: 400 })
    }

    console.log('확정 명세서 생성 시작:', { orderIds })

    // 주문 정보 상세 조회
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          id,
          company_name,
          representative_name,
          email,
          phone,
          address,
          mileage_balance
        ),
        order_items!order_items_order_id_fkey (
          id,
          product_name,
          quantity,
          shipped_quantity,
          unit_price,
          total_price,
          color,
          size
        )
      `)
      .in('id', orderIds)

    if (orderError) {
      console.error('주문 조회 오류:', orderError)
      return NextResponse.json({
        success: false,
        error: `주문 조회 오류: ${orderError.message}`
      }, { status: 500 })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: '주문을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    const results = []
    const currentTime = getKoreaTime()
    
    for (const order of orders) {
      try {
        console.log('확정 명세서 처리 시작:', order.order_number)

        // 이미 처리 중인 주문인지 확인 (중복 처리 방지)
        const { data: existingStatement, error: statementCheckError } = await supabase
          .from('statements')
          .select('id, statement_number')
          .eq('order_id', order.id)
          .eq('statement_type', 'confirmed')
          .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // 5분 이내 생성된 것
          .single()

        if (existingStatement && !statementCheckError) {
          console.log('최근 5분 이내 이미 처리된 주문:', order.order_number)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '최근에 이미 처리된 주문입니다. 중복 처리를 방지합니다.'
          })
          continue
        }

        // 이미 마일리지가 차감된 주문인지 확인
        const { data: existingMileageRecord, error: mileageCheckError } = await supabase
          .from('mileage')
          .select('id, amount, description, created_at')
          .eq('order_id', order.id)
          .eq('type', 'spend')
          .eq('source', 'order')
          .single()

        if (existingMileageRecord && !mileageCheckError) {
          console.log('이미 마일리지가 차감된 주문:', order.order_number, {
            차감금액: existingMileageRecord.amount,
            차감일시: existingMileageRecord.created_at,
            설명: existingMileageRecord.description
          })
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: `이미 마일리지가 차감된 주문입니다. (차감금액: ${existingMileageRecord.amount.toLocaleString()}원)`
          })
          continue
        }

        // 실제 출고된 상품만 필터링
        const shippedItems = order.order_items.filter((item: any) => 
          item.shipped_quantity && item.shipped_quantity > 0
        )

        if (shippedItems.length === 0) {
          console.log('출고된 상품이 없어 건너뜀:', order.order_number)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '출고된 상품이 없습니다.'
          })
          continue
        }

        // 🔍 디버깅: color/size 데이터 확인
        console.log('🔍 shippedItems color/size 데이터:', shippedItems.map((item: any) => ({
          product_name: item.product_name,
          color: item.color,
          size: item.size,
          shipped_quantity: item.shipped_quantity
        })))

        // 실제 출고 수량 및 금액 계산
        const totalShippedQuantity = shippedItems.reduce((sum: number, item: any) => 
          sum + item.shipped_quantity, 0
        )
        const shippedAmount = shippedItems.reduce((sum: number, item: any) => 
          sum + (item.unit_price * item.shipped_quantity), 0
        )

        // 세액 계산 (공급가액의 10%)
        const taxAmount = Math.floor(shippedAmount * 0.1)
        // 🔧 배송비 계산 (출고된 상품이 있고 20장 미만일 때만 3,000원)
        const shippingFee = (totalShippedQuantity > 0 && totalShippedQuantity < 20) ? 3000 : 0
        const totalAmount = shippedAmount + taxAmount + shippingFee

        // 1. 거래명세서 생성
        const timestamp = Date.now()
        const statementNumber = `TXN-${getKoreaDateFormatted()}-${timestamp}-${order.order_number}`
        
        const { data: statement, error: statementError } = await supabase
          .from('statements')
          .insert({
            statement_number: statementNumber,
            statement_type: 'transaction',
            user_id: order.user_id,
            order_id: order.id,
            total_amount: totalAmount,
            reason: '확정 명세서 생성',
            notes: `실제 출고 금액: ${shippedAmount.toLocaleString()}원${shippingFee > 0 ? ` + 배송비: ${shippingFee.toLocaleString()}원` : ''}`,
            status: 'issued',
            created_at: currentTime
          })
          .select()
          .single()

        if (statementError) {
          console.error('거래명세서 생성 오류:', statementError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '거래명세서 생성 실패'
          })
          continue
        }

        // 2. 거래명세서 아이템들 생성
        const statementItems = [
          ...shippedItems.map((item: any) => ({
            statement_id: statement.id,
            product_name: item.product_name,
            color: item.color,
            size: item.size,
            quantity: item.shipped_quantity,
            unit_price: item.unit_price,
            total_amount: item.unit_price * item.shipped_quantity
          }))
        ]

        // 배송비가 있는 경우 아이템에 추가
        if (shippingFee > 0) {
          statementItems.push({
            statement_id: statement.id,
            product_name: '배송비',
            color: '-',
            size: '-',
            quantity: 1,
            unit_price: shippingFee,
            total_amount: shippingFee
          })
        }

        const { error: itemsError } = await supabase
          .from('statement_items')
          .insert(statementItems)

        if (itemsError) {
          console.error('거래명세서 아이템 생성 오류:', itemsError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '거래명세서 아이템 생성 실패'
          })
          continue
        }

        // 3. 마일리지 차감 처리
        const currentMileage = order.users.mileage_balance || 0
        const mileageDeductionAmount = totalAmount // 공급가액 + 세액 + 배송비 모두 포함
        const newMileage = Math.max(0, currentMileage - mileageDeductionAmount)

        // 3-1. mileage 테이블에 차감 기록 생성
        const { data: insertedMileage, error: mileageRecordError } = await supabase
          .from('mileage')
          .insert({
            user_id: order.user_id,
            amount: mileageDeductionAmount,
            type: 'spend',
            source: 'order',
            description: `확정 명세서 생성 - 주문번호: ${order.order_number}`,
            status: 'completed',
            order_id: order.id,
            created_at: currentTime
          })
          .select('id')
          .single()

        if (mileageRecordError) {
          console.error('마일리지 기록 생성 오류:', mileageRecordError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '마일리지 기록 생성 실패'
          })
          continue
        }

        // final_balance 수동 계산 및 업데이트
        try {
          // 사용자의 최종 마일리지 잔액 계산
          const { data: userMileages } = await supabase
            .from('mileage')
            .select('amount, type')
            .eq('user_id', order.user_id)
            .eq('status', 'completed');
          
          let finalBalance = 0;
          if (userMileages) {
            finalBalance = userMileages.reduce((sum, m) => {
              const amount = Math.abs(m.amount); // 모든 amount를 양수로 변환
              if (m.type === 'earn') {
                return sum + amount; // 적립은 더하기
              } else {
                return sum - amount; // 차감은 빼기
              }
            }, 0);
          }
          
          // final_balance 업데이트
          await supabase
            .from('mileage')
            .update({ final_balance: finalBalance })
            .eq('id', insertedMileage.id);
        } catch (balanceError) {
          console.error('final_balance 업데이트 실패:', balanceError);
        }

        // 3-2. 사용자 마일리지 잔액 업데이트
        const { error: mileageBalanceError } = await supabase
          .from('users')
          .update({ 
            mileage_balance: newMileage,
            updated_at: currentTime
          })
          .eq('id', order.user_id)

        if (mileageBalanceError) {
          console.error('마일리지 잔액 업데이트 오류:', mileageBalanceError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '마일리지 잔액 업데이트 실패'
          })
          continue
        }

        // 4. 주문 상태를 confirmed로 업데이트 (명세서 확정)
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ 
            status: 'confirmed',
            updated_at: currentTime
          })
          .eq('id', order.id)

        if (orderUpdateError) {
          console.error('주문 상태 업데이트 오류:', orderUpdateError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '주문 상태 업데이트 실패'
          })
          continue
        }

        // 5. 이메일 발송 (확정 명세서 첨부)
        let emailSentSuccessfully = false
        let emailMessageId = ''
        
        try {
          // 확정 명세서 데이터 준비
          const statementData = {
            statement_number: statementNumber,
            order_number: order.order_number,
            order_date: new Date(order.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }),
            company_name: order.users.company_name,
            representative_name: order.users.representative_name,
            items: shippedItems.map((item: any) => ({
              product_name: item.product_name,
              color: item.color,
              size: item.size,
              ordered_quantity: item.quantity,
              shipped_quantity: item.shipped_quantity,
              unit_price: item.unit_price,
              total_price: item.unit_price * item.shipped_quantity
            })),
            total_amount: totalAmount,
            shipping_fee: shippingFee,
            notes: `확정 명세서 - 마일리지 차감: ${totalAmount.toLocaleString()}원`
          }

          // 엑셀 파일 생성
          const excelBuffer = await generateConfirmedStatement(statementData)
          const fileName = `확정명세서_${statementNumber}_${getKoreaDateFormatted()}.xlsx`

          // 이메일 발송
          const emailResult = await sendEmail({
            to: order.users.email,
            subject: `[루소] 확정 명세서 발송 - ${order.order_number}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
                  📋 확정 명세서 발송
                </h2>
                
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #007bff; margin-top: 0;">📊 주문 정보</h3>
                  <p><strong>주문번호:</strong> ${order.order_number}</p>
                  <p><strong>명세서번호:</strong> ${statementNumber}</p>
                  <p><strong>고객명:</strong> ${order.users.company_name}</p>
                  <p><strong>담당자:</strong> ${order.users.representative_name}</p>
                </div>
                
                <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #2e7d32; margin-top: 0;">💰 금액 정보</h3>
                  <p style="font-size: 18px; color: #2e7d32;"><strong>총 금액 (공급가액 + 세액${shippingFee > 0 ? ' + 배송비' : ''}):</strong> ${totalAmount.toLocaleString()}원</p>
                  <p><strong>마일리지 차감:</strong> ${totalAmount.toLocaleString()}원</p>
                  ${shippingFee > 0 ? `<p><strong>배송비:</strong> ${shippingFee.toLocaleString()}원 (20장 미만)</p>` : ''}
                </div>

                <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #28a745; margin-top: 0;">📦 출고 상품 목록</h3>
                  ${shippedItems.map((item: any) => `
                    <div style="border-bottom: 1px solid #dee2e6; padding: 10px 0;">
                      <p><strong>${item.product_name}</strong></p>
                      <p>색상: ${item.color} | 사이즈: ${item.size}</p>
                      <p>수량: ${item.shipped_quantity}개 | 단가: ${item.unit_price.toLocaleString()}원 | 소계: ${(item.unit_price * item.shipped_quantity).toLocaleString()}원</p>
                    </div>
                  `).join('')}
                </div>

                <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="color: #856404; margin-top: 0;">📎 첨부파일</h3>
                  <p>확정 명세서 엑셀 파일이 첨부되어 있습니다.</p>
                  <p>파일명: ${fileName}</p>
                </div>

                <div style="margin-top: 30px; padding: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #666;">
                  <p><strong>루소 (LUSSO)</strong></p>
                  <p>문의사항이 있으시면 고객센터로 연락주세요. 루소 Lusso</p>
                </div>
              </div>
            `,
            attachments: [
              {
                filename: fileName,
                content: excelBuffer,
                contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              }
            ]
          })

          if (emailResult && emailResult.messageId) {
            emailSentSuccessfully = true
            emailMessageId = emailResult.messageId
            
            // 명세서 테이블에 이메일 발송 완료 상태 업데이트
            await supabase
              .from('statements')
              .update({ 
                status: 'sent',
                sent_at: currentTime,
                updated_at: currentTime
              })
              .eq('id', statement.id)

            // 이메일 로그 기록
            await supabase
              .from('email_logs')
              .insert({
                order_id: order.id,
                recipient_email: order.users.email,
                email_type: 'confirmed_statement',
                subject: `[루소] 확정 명세서 발송 - ${order.order_number}`,
                status: 'sent',
                message_id: emailMessageId,
                sent_at: currentTime
              })

            console.log('확정 명세서 이메일 발송 완료:', order.users.email)
          } else {
            throw new Error('이메일 발송 실패 - messageId 없음')
          }
        } catch (emailError) {
          console.error('확정 명세서 이메일 발송 오류:', emailError)
          
          // 이메일 발송 실패 로그 기록
          await supabase
            .from('email_logs')
            .insert({
              order_id: order.id,
              recipient_email: order.users.email,
              email_type: 'confirmed_statement',
              subject: `[루소] 확정 명세서 발송 - ${order.order_number}`,
              status: 'failed',
              error_message: emailError instanceof Error ? emailError.message : '알 수 없는 오류',
              sent_at: currentTime
            })
        }

        results.push({
          orderId: order.id,
          orderNumber: order.order_number,
          success: true,
          statementNumber: statementNumber,
          shippedAmount: shippedAmount,
          mileageDeducted: totalAmount,
          newMileage: newMileage,
          orderStatus: 'confirmed',
          emailSent: emailSentSuccessfully,
          emailMessageId: emailMessageId || undefined,
          shippingFee: shippingFee
        })

        console.log('확정 명세서 생성 완료:', {
          orderNumber: order.order_number,
          statementNumber,
          shippedAmount,
          mileageDeducted: totalAmount,
          newMileage,
          orderStatus: 'confirmed'
        })

      } catch (error) {
        console.error('주문 처리 오류:', error)
        results.push({
          orderId: order.id,
          orderNumber: order.order_number,
          success: false,
          error: '처리 중 오류 발생'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      data: {
        total: results.length,
        success: successCount,
        failed: failCount,
        results: results
      },
      message: `${successCount}개 주문의 확정 명세서가 생성되고 이메일이 발송되었습니다.`
    })

  } catch (error) {
    console.error('확정 명세서 생성 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '확정 명세서 생성 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 