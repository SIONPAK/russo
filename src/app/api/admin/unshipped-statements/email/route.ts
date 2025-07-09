import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { sendEmail } from '@/shared/lib/email-utils'
import { getKoreaTime } from '@/shared/lib/utils'
import { generateUnshippedStatement, UnshippedStatementData } from '@/shared/lib/shipping-statement-utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { statementIds } = await request.json()
    
    if (!statementIds || !Array.isArray(statementIds) || statementIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '명세서 ID가 필요합니다.'
      }, { status: 400 })
    }

    let successCount = 0
    let failCount = 0
    const results = []

    for (const statementId of statementIds) {
      try {
        // 미출고 명세서 정보 조회
        const { data: statement, error: statementError } = await supabase
          .from('unshipped_statements')
          .select(`
            id,
            statement_number,
            order_id,
            user_id,
            total_unshipped_amount,
            status,
            reason,
            created_at,
            orders (
              order_number,
              created_at
            ),
            users (
              company_name,
              representative_name,
              email,
              phone
            ),
            unshipped_statement_items (
              id,
              product_name,
              color,
              size,
              ordered_quantity,
              shipped_quantity,
              unshipped_quantity,
              unit_price,
              total_amount
            )
          `)
          .eq('id', statementId)
          .single()

        if (statementError || !statement) {
          results.push({
            statementId,
            success: false,
            error: '명세서를 찾을 수 없습니다.'
          })
          failCount++
          continue
        }

        // 이메일 주소 확인
        const userInfo = statement.users as any
        const orderInfo = statement.orders as any
        
        if (!userInfo.email) {
          results.push({
            statementId,
            success: false,
            error: '이메일 주소가 없습니다.'
          })
          failCount++
          continue
        }

        // 미출고 명세서 엑셀 파일 생성
        const statementData: UnshippedStatementData = {
          statementNumber: statement.statement_number,
          companyName: userInfo.company_name,
          email: userInfo.email,
          phone: userInfo.phone || '',
          address: '',
          postalCode: '',
          customerGrade: 'BRONZE',
          unshippedDate: statement.created_at,
          unshippedReason: statement.reason || '재고 부족',
          items: statement.unshipped_statement_items.map((item: any) => ({
            productName: item.product_name,
            color: item.color || '기본',
            size: item.size || '',
            quantity: 0,        // 수량 0으로 처리
            unitPrice: 0,       // 단가 0으로 처리
            totalPrice: 0       // 총액 0으로 처리
          })),
          totalAmount: 0  // 총 금액 0으로 처리
        }

        const excelBuffer = await generateUnshippedStatement(statementData)

        // 이메일 내용 생성
        const emailSubject = `[미출고 안내] ${orderInfo.order_number} 주문 관련`
        const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #333; margin: 0;">루소 (LUSSO)</h1>
        <p style="color: #666; margin: 5px 0;">미출고 명세서 발송</p>
      </div>
      
      <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2 style="color: #f57c00; margin-top: 0; font-size: 18px;">⚠️ 미출고 안내</h2>
        <p style="margin: 10px 0; color: #333;">
          안녕하세요, <strong>${userInfo.company_name}</strong> 담당자님.
        </p>
        <p style="margin: 10px 0; color: #666;">
          주문번호 <strong>${orderInfo.order_number}</strong>의 일부 상품이 재고 부족으로 인해 출고되지 못했습니다.
        </p>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2 style="color: #495057; margin-top: 0; font-size: 18px;">📋 미출고 명세서 정보</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 140px;">명세서 번호:</td>
            <td style="padding: 8px 0;">${statement.statement_number}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">미출고 사유:</td>
            <td style="padding: 8px 0;">${statement.reason}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">미출고 금액:</td>
            <td style="padding: 8px 0; color: #d32f2f; font-weight: bold;">${statement.total_unshipped_amount.toLocaleString()}원</td>
          </tr>
        </table>
      </div>
      
      <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2 style="color: #1976d2; margin-top: 0; font-size: 18px;">📦 미출고 상품 목록</h2>
        <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
          ${statement.unshipped_statement_items.map(item => 
            `<li style="margin: 8px 0;">${item.product_name} ${item.color ? `(${item.color})` : ''} ${item.size || ''} - <strong>${item.unshipped_quantity}개</strong> (${item.total_amount.toLocaleString()}원)</li>`
          ).join('')}
        </ul>
      </div>
      
      <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2 style="color: #f57c00; margin-top: 0; font-size: 18px;">📎 첨부파일</h2>
        <p style="margin: 10px 0; color: #666;">
          상세한 미출고 명세서가 첨부되어 있습니다.<br>
          엑셀 파일을 다운로드하여 확인해주세요.
        </p>
      </div>
      
                   
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e0e0e0;">
        <p style="color: #666; font-size: 14px; margin: 5px 0;">
                     <strong>(주) 루소 (LUSSO)</strong>
        </p>
        <p style="color: #666; font-size: 14px; margin: 5px 0;">
          고객센터: 010-2131-7540 | 이메일: bsion5185@gmail.com
        </p>
        <p style="color: #999; font-size: 12px; margin: 15px 0 0 0;">
          본 메일은 발신전용입니다. 문의사항은 고객센터로 연락주세요.
        </p>
      </div>
    </div>
`

        // 첨부파일 설정
        const attachments = [{
          filename: `미출고명세서_${statement.statement_number}_${new Date().toISOString().split('T')[0]}.xlsx`,
          content: excelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }]

        // 이메일 발송 (첨부파일 포함)
        const emailResult = await sendEmail({
          to: userInfo.email,
          subject: emailSubject,
          html: emailContent,
          attachments
        })

        if (emailResult.success) {
          // 상태를 'notified'로 업데이트
          await supabase
            .from('unshipped_statements')
            .update({
              status: 'notified',
              updated_at: getKoreaTime()
            })
            .eq('id', statementId)

          results.push({
            statementId,
            success: true,
            email: userInfo.email
          })
          successCount++
        } else {
          results.push({
            statementId,
            success: false,
            error: emailResult.error
          })
          failCount++
        }

      } catch (error) {
        console.error(`명세서 ${statementId} 이메일 발송 중 오류:`, error)
        results.push({
          statementId,
          success: false,
          error: '이메일 발송 중 오류가 발생했습니다.'
        })
        failCount++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        successCount,
        failCount,
        results
      }
    })

  } catch (error) {
    console.error('미출고 명세서 이메일 발송 오류:', error)
    return NextResponse.json({
      success: false,
      error: '이메일 발송 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 