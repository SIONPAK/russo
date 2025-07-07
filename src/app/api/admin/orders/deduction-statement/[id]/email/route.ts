import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import nodemailer from 'nodemailer'
import { getKoreaTime } from '@/shared/lib/utils'

// POST - 차감명세서 이메일 발송
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 차감명세서 정보 조회
    const { data: statement, error: statementError } = await supabase
      .from('statements')
      .select(`
        *,
        users!statements_user_id_fkey (
          id,
          company_name,
          representative_name,
          email,
          phone
        ),
        orders!statements_order_id_fkey (
          id,
          order_number,
          total_amount
        ),
        statement_items!statement_items_statement_id_fkey (
          id,
          product_name,
          color,
          size,
          quantity,
          unit_price,
          total_amount
        )
      `)
      .eq('id', id)
      .single()

    if (statementError || !statement) {
      return NextResponse.json({
        success: false,
        error: '차감명세서를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 고객 이메일 확인
    if (!statement.users?.email) {
      return NextResponse.json({
        success: false,
        error: '고객 이메일 주소가 없습니다.'
      }, { status: 400 })
    }

    // 이메일 발송
    const emailResult = await sendDeductionStatementEmail(statement)

    if (!emailResult.success) {
      return NextResponse.json({
        success: false,
        error: emailResult.error
      }, { status: 500 })
    }

    // 이메일 발송 로그 기록
    await supabase
      .from('email_logs')
      .insert({
        statement_id: statement.id,
        recipient_email: statement.users.email,
        email_type: 'deduction_statement',
        subject: `[루소] 차감명세서 발송 - ${statement.statement_number}`,
        status: 'sent',
        sent_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      message: '차감명세서가 성공적으로 발송되었습니다.',
      data: {
        statement_number: statement.statement_number,
        recipient_email: statement.users.email
      }
    })

  } catch (error) {
    console.error('Deduction statement email API error:', error)
    return NextResponse.json({
      success: false,
      error: '이메일 발송 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 차감명세서 이메일 발송 함수
async function sendDeductionStatementEmail(statement: any) {
  try {
    // 네이버 SMTP 설정
    const transporter = nodemailer.createTransport({
      host: 'smtp.naver.com',
      port: 587,
      secure: false,
      auth: {
        user: 'lusso112@naver.com',
        pass: process.env.NAVER_SMTP_PASSWORD
      }
    })

    // 이메일 내용 생성
    const emailContent = generateDeductionStatementHTML(statement)

    // 이메일 발송
    await transporter.sendMail({
      from: '"루소 관리팀" <lusso112@naver.com>',
      to: statement.users.email,
      subject: `[루소] 차감명세서 발송 - ${statement.statement_number}`,
      html: emailContent
    })

    return { success: true }

  } catch (error) {
    console.error('Email sending error:', error)
    return { 
      success: false, 
      error: '이메일 발송에 실패했습니다.' 
    }
  }
}

// 차감명세서 HTML 생성 함수
function generateDeductionStatementHTML(statement: any) {
  const items = statement.statement_items || []
  const itemsHTML = items.map((item: any) => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.product_name}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.color || '-'}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.size || '-'}</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${item.quantity}개</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${item.unit_price.toLocaleString()}원</td>
      <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${item.total_amount.toLocaleString()}원</td>
    </tr>
  `).join('')

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>차감명세서</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
      <div style="max-width: 800px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        
        <!-- 헤더 -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0; font-size: 28px;">차감명세서</h1>
          <p style="color: #666; margin: 10px 0 0 0; font-size: 16px;">Deduction Statement</p>
        </div>

        <!-- 기본 정보 -->
        <div style="margin-bottom: 25px;">
          <h3 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 5px;">📋 기본 정보</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="padding: 8px; background-color: #f8f9fa; border: 1px solid #ddd; width: 120px; font-weight: bold;">명세서 번호</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${statement.statement_number}</td>
              <td style="padding: 8px; background-color: #f8f9fa; border: 1px solid #ddd; width: 120px; font-weight: bold;">발행일</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${new Date(statement.created_at).toLocaleDateString('ko-KR')}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background-color: #f8f9fa; border: 1px solid #ddd; font-weight: bold;">업체명</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${statement.users.company_name}</td>
              <td style="padding: 8px; background-color: #f8f9fa; border: 1px solid #ddd; font-weight: bold;">대표자명</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${statement.users.representative_name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; background-color: #f8f9fa; border: 1px solid #ddd; font-weight: bold;">차감 유형</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${getDeductionTypeText(statement.statement_type)}</td>
              <td style="padding: 8px; background-color: #f8f9fa; border: 1px solid #ddd; font-weight: bold;">관련 주문</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${statement.orders?.order_number || '-'}</td>
            </tr>
          </table>
        </div>

        <!-- 차감 사유 -->
        <div style="margin-bottom: 25px;">
          <h3 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 5px;">📝 차감 사유</h3>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; border: 1px solid #ddd;">
            ${statement.reason}
          </div>
        </div>

        <!-- 차감 항목 -->
        <div style="margin-bottom: 25px;">
          <h3 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 5px;">📦 차감 항목</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <thead>
              <tr style="background-color: #007bff; color: white;">
                <th style="padding: 10px; border: 1px solid #ddd;">상품명</th>
                <th style="padding: 10px; border: 1px solid #ddd;">색상</th>
                <th style="padding: 10px; border: 1px solid #ddd;">사이즈</th>
                <th style="padding: 10px; border: 1px solid #ddd;">수량</th>
                <th style="padding: 10px; border: 1px solid #ddd;">단가</th>
                <th style="padding: 10px; border: 1px solid #ddd;">금액</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHTML}
            </tbody>
          </table>
        </div>

        <!-- 총 차감 금액 -->
        <div style="margin-bottom: 25px;">
          <h3 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 5px;">💰 총 차감 금액</h3>
          <div style="text-align: right; font-size: 24px; font-weight: bold; color: #dc3545; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
            ${statement.total_amount.toLocaleString()}원
          </div>
        </div>

        <!-- 추가 메모 -->
        ${statement.notes ? `
        <div style="margin-bottom: 25px;">
          <h3 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 5px;">📌 추가 메모</h3>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; border: 1px solid #ddd;">
            ${statement.notes}
          </div>
        </div>
        ` : ''}

        <!-- 안내사항 -->
        <div style="margin-top: 30px; padding: 20px; background-color: #e9ecef; border-radius: 5px;">
          <h4 style="color: #333; margin: 0 0 10px 0;">📢 중요 안내사항</h4>
          <ul style="margin: 0; padding-left: 20px; color: #666;">
            <li>본 차감명세서는 마일리지에서 자동 차감 처리됩니다.</li>
            <li>차감 내역에 대한 문의사항은 고객센터로 연락 주시기 바랍니다.</li>
            <li>차감 처리 후 잔여 마일리지는 마이페이지에서 확인 가능합니다.</li>
          </ul>
        </div>

        <!-- 푸터 -->
        <div style="margin-top: 30px; text-align: center; padding-top: 20px; border-top: 1px solid #ddd;">
          <p style="color: #666; margin: 0; font-size: 14px;">
            <strong>(주) 루소</strong><br>
            고객센터: 010-2131-7540 | 이메일: bsion5185@gmail.com<br>
            발행일시: ${new Date().toLocaleString('ko-KR')}
          </p>
        </div>

      </div>
    </body>
    </html>
  `
}

// 차감 유형 텍스트 변환
function getDeductionTypeText(type: string): string {
  switch (type) {
    case 'deduction': return '차감'
    case 'return': return '반품'
    case 'refund': return '환불'
    default: return type
  }
} 