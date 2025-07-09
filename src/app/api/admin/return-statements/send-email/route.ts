import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { sendEmail } from '@/shared/lib/email-utils'
import { getKoreaTime } from '@/shared/lib/utils'
import { generateReturnStatement } from '@/shared/lib/shipping-statement-utils'

// 반품명세서 이메일 발송 API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { statementIds } = body

    if (!statementIds || statementIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '발송할 반품명세서를 선택해주세요.'
      }, { status: 400 })
    }

    // 반품명세서 정보 조회
    const { data: statements, error: statementsError } = await supabase
      .from('return_statements')
      .select(`
        *,
        orders!return_statements_order_id_fkey (
          order_number,
          users!orders_user_id_fkey (
            email,
            company_name,
            representative_name
          )
        )
      `)
      .in('id', statementIds)

    if (statementsError) {
      console.error('Return statements fetch error:', statementsError)
      return NextResponse.json({
        success: false,
        error: '반품명세서 조회 중 오류가 발생했습니다.'
      }, { status: 500 })
    }

    // 이메일 발송을 위한 병렬 처리 함수
    const sendReturnEmailBatch = async (statement: any) => {
      try {
        // company_name으로 users 테이블에서 사용자 정보 조회
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('email, company_name, representative_name, business_number, phone, address, postal_code, customer_grade')
          .eq('company_name', statement.company_name)
          .single()

        if (userError || !userData) {
          console.error('User fetch error:', userError)
          return {
            success: false,
            id: statement.id,
            reason: '사용자 정보를 찾을 수 없습니다.'
          }
        }

        const userEmail = userData.email
        const companyName = userData.company_name
        const representativeName = userData.representative_name

        if (!userEmail) {
          return {
            success: false,
            id: statement.id,
            reason: '이메일 주소가 없습니다.'
          }
        }

        // 반품명세서 엑셀 파일 생성
        const statementData = {
          statementNumber: statement.statement_number,
          companyName: userData.company_name,
          businessLicenseNumber: userData.business_number,
          email: userData.email,
          phone: userData.phone,
          address: userData.address,
          postalCode: userData.postal_code || '',
          customerGrade: userData.customer_grade || 'BRONZE',
          returnDate: statement.created_at,
          returnReason: statement.return_reason,
          items: (statement.items || []).map((item: any) => {
            // 반품 수량 우선 사용, 없으면 일반 수량 사용
            const actualQuantity = item.return_quantity || item.quantity || 0
            console.log('🔍 반품 아이템 수량 확인:', {
              productName: item.product_name,
              return_quantity: item.return_quantity,
              quantity: item.quantity,
              actualQuantity
            })
            return {
              productName: item.product_name,
              color: item.color || '기본',
              size: item.size || '',
              quantity: actualQuantity,
              unitPrice: item.unit_price,
              totalPrice: item.unit_price * actualQuantity
            }
          }),
          totalAmount: statement.refund_amount || statement.total_amount
        }

        // 반품 명세서 엑셀 파일 생성
        const excelBuffer = await generateReturnStatement(statementData)

        // 이메일 내용 생성
        const emailSubject = `[루소] 반품명세서 - ${statement.statement_number}`
        const emailBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
              반품명세서 발송
            </h2>
            
            <p>안녕하세요, ${companyName} ${representativeName}님</p>
            
            <p>요청하신 반품명세서를 발송해드립니다.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057;">반품명세서 정보</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>명세서 번호:</strong> ${statement.statement_number}</li>
                <li><strong>주문 번호:</strong> ${statement.orders.order_number}</li>
                <li><strong>반품 사유:</strong> ${statement.return_reason}</li>
                <li><strong>환불 금액:</strong> ${statement.refund_amount.toLocaleString()}원</li>
                <li><strong>발송일:</strong> ${new Date().toLocaleDateString('ko-KR')}</li>
              </ul>
            </div>
            
            <div style="background-color: #fff3e0; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #f57c00;">📎 첨부파일</h3>
              <p style="margin: 10px 0; color: #666;">
                상세한 반품명세서가 첨부되어 있습니다.<br>
                엑셀 파일을 다운로드하여 확인해주세요.
              </p>
            </div>
            
            <p>반품 처리에 관한 문의사항이 있으시면 언제든지 연락주시기 바랍니다.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px;">
              <p>본 메일은 발신전용입니다. 문의사항은 고객센터로 연락주시기 바랍니다.</p>
              <p>© 2024 루소(LUSSO). All rights reserved.</p>
            </div>
          </div>
        `

        // 이메일 발송 (엑셀 파일 첨부)
        await sendEmail({
          to: userEmail,
          subject: emailSubject,
          html: emailBody,
          attachments: [
            {
              filename: `반품명세서_${statement.statement_number}.xlsx`,
              content: excelBuffer,
              contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            }
          ]
        })

        // 이메일 발송 기록 업데이트
        await supabase
          .from('return_statements')
          .update({
            email_sent: true,
            email_sent_at: new Date().toISOString()
          })
          .eq('id', statement.id)

        return {
          success: true,
          id: statement.id
        }

      } catch (error) {
        console.error(`Failed to send email for statement ${statement.id}:`, error)
        return {
          success: false,
          id: statement.id,
          reason: '이메일 발송 실패'
        }
      }
    }

    // 병렬 처리 (배치 크기 제한: 5개씩)
    const batchSize = 5
    let successCount = 0
    const failedStatements: any[] = []

    for (let i = 0; i < statements.length; i += batchSize) {
      const batch = statements.slice(i, i + batchSize)
      const batchResults = await Promise.allSettled(
        batch.map(statement => sendReturnEmailBatch(statement))
      )

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const emailResult = result.value
          if (emailResult.success) {
            successCount++
          } else {
            failedStatements.push({
              id: emailResult.id,
              reason: emailResult.reason
            })
          }
        } else {
          const statement = batch[index]
          console.error(`Batch processing error for statement ${statement.id}:`, result.reason)
          failedStatements.push({
            id: statement.id,
            reason: '이메일 발송 중 오류 발생'
          })
        }
      })

      // 각 배치 간 잠시 대기 (SMTP 서버 부하 방지)
      if (i + batchSize < statements.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sent: successCount,
        failed: failedStatements.length,
        failedStatements
      }
    })

  } catch (error) {
    console.error('Return statement email send API error:', error)
    return NextResponse.json({
      success: false,
      error: '이메일 발송 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 