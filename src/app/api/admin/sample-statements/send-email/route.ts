import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { sendEmail } from '@/shared/lib/email-utils'

// 샘플 명세서 이메일 발송 API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { statementIds } = body

    if (!statementIds || statementIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '발송할 샘플 명세서를 선택해주세요.'
      }, { status: 400 })
    }

    // 샘플 명세서 정보 조회
    const { data: statements, error: statementsError } = await supabase
      .from('sample_statements')
      .select(`
        *,
        orders!sample_statements_order_id_fkey (
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
      console.error('Sample statements fetch error:', statementsError)
      return NextResponse.json({
        success: false,
        error: '샘플 명세서 조회 중 오류가 발생했습니다.'
      }, { status: 500 })
    }

    let successCount = 0
    const failedStatements = []

    // 각 샘플 명세서에 대해 이메일 발송
    for (const statement of statements) {
      try {
        const userEmail = statement.orders.users.email
        const companyName = statement.orders.users.company_name
        const representativeName = statement.orders.users.representative_name

        if (!userEmail) {
          failedStatements.push({
            id: statement.id,
            reason: '이메일 주소가 없습니다.'
          })
          continue
        }

        // 샘플 타입 한글 변환
        const getSampleTypeText = (type: string) => {
          return type === 'photo' ? '촬영용' : '판매용'
        }

        // 이메일 내용 생성
        const emailSubject = `[루소] 샘플 명세서 - ${statement.statement_number}`
        const emailBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333; border-bottom: 2px solid #28a745; padding-bottom: 10px;">
              샘플 명세서 발송
            </h2>
            
            <p>안녕하세요, ${companyName} ${representativeName}님</p>
            
            <p>요청하신 샘플 명세서를 발송해드립니다.</p>
            
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057;">샘플 명세서 정보</h3>
              <ul style="list-style: none; padding: 0;">
                <li><strong>명세서 번호:</strong> ${statement.statement_number}</li>
                <li><strong>주문 번호:</strong> ${statement.orders.order_number}</li>
                <li><strong>샘플 타입:</strong> ${getSampleTypeText(statement.sample_type)}</li>
                <li><strong>총 금액:</strong> ${statement.total_amount.toLocaleString()}원</li>
                <li><strong>발송일:</strong> ${new Date().toLocaleDateString('ko-KR')}</li>
              </ul>
            </div>
            
            ${statement.sample_type === 'photo' ? `
              <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                <p style="margin: 0; color: #155724;">
                  <strong>촬영용 샘플 안내:</strong> 촬영 완료 후 21일 이내에 반납해주시기 바랍니다.
                </p>
              </div>
            ` : `
              <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #17a2b8;">
                <p style="margin: 0; color: #0c5460;">
                  <strong>판매용 샘플 안내:</strong> 해당 샘플은 판매용으로 반납이 불필요합니다.
                </p>
              </div>
            `}
            
            <p>샘플 관련 문의사항이 있으시면 언제든지 연락주시기 바랍니다.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px;">
              <p>본 메일은 발신전용입니다. 문의사항은 고객센터로 연락주시기 바랍니다.</p>
              <p>© 2024 루소(LUSSO). All rights reserved.</p>
            </div>
          </div>
        `

        // 이메일 발송
        await sendEmail({
          to: userEmail,
          subject: emailSubject,
          html: emailBody
        })

        // 이메일 발송 기록 업데이트
        await supabase
          .from('sample_statements')
          .update({
            email_sent: true,
            email_sent_at: new Date().toISOString()
          })
          .eq('id', statement.id)

        successCount++

      } catch (error) {
        console.error(`Failed to send email for statement ${statement.id}:`, error)
        failedStatements.push({
          id: statement.id,
          reason: '이메일 발송 실패'
        })
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
    console.error('Sample statement email send API error:', error)
    return NextResponse.json({
      success: false,
      error: '이메일 발송 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 