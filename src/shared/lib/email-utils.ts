import nodemailer from 'nodemailer'

interface EmailAttachment {
  filename: string
  content: Buffer
  contentType: string
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  attachments?: EmailAttachment[]
}

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

// 네이버 이메일 설정
const getEmailConfig = (): EmailConfig => {
  return {
    host: 'smtp.naver.com',
    port: 465,
    secure: true,
    auth: {
      user: 'lusso112',  // 네이버 아이디
      pass: process.env.EMAIL_PASS || ''  // 애플리케이션 비밀번호
    }
  }
}

// 이메일 발송 함수
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const config = getEmailConfig()
    
    // 이메일 설정이 없으면 에러
    if (!config.auth.user || !config.auth.pass) {
      throw new Error('이메일 설정이 없습니다. 환경변수를 확인해주세요.')
    }

    // transporter 생성 (네이버 SMTP 사용)
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth
    })

    // 연결 테스트
    await transporter.verify()

    // 메일 옵션 설정
    const mailOptions = {
      from: `"루소 (LUSSO)" <${config.auth.user}@naver.com>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map(attachment => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType
      }))
    }

    // 이메일 발송
    const info = await transporter.sendMail(mailOptions)
    
    console.log('이메일 발송 성공:', info.messageId)
    
    return {
      success: true,
      messageId: info.messageId
    }

  } catch (error) {
    console.error('이메일 발송 실패:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
}

// 거래명세서 이메일 발송 전용 함수
export async function sendShippingStatementEmail(
  recipientEmail: string,
  orderData: any,
  excelBuffer: Buffer
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #333; margin: 0;">루소 (LUSSO)</h1>
        <p style="color: #666; margin: 5px 0;">거래명세서 발송</p>
      </div>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2 style="color: #495057; margin-top: 0; font-size: 18px;">📋 주문 정보</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 120px;">주문번호:</td>
            <td style="padding: 8px 0;">${orderData.order_number}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">업체명:</td>
            <td style="padding: 8px 0;">${orderData.users?.company_name || orderData.shipping_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">출고일:</td>
            <td style="padding: 8px 0;">${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</td>
          </tr>
        </table>
      </div>
      
      <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2 style="color: #1976d2; margin-top: 0; font-size: 18px;">🚚 배송 정보</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 120px;">받는분:</td>
            <td style="padding: 8px 0;">${orderData.shipping_name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">연락처:</td>
            <td style="padding: 8px 0;">${orderData.shipping_phone}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">주소:</td>
            <td style="padding: 8px 0;">${orderData.shipping_address}</td>
          </tr>
        </table>
      </div>
      
      <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2 style="color: #f57c00; margin-top: 0; font-size: 18px;">📎 첨부파일</h2>
        <p style="margin: 10px 0; color: #666;">
          상세한 거래명세서가 첨부되어 있습니다.<br>
          엑셀 파일을 다운로드하여 확인해주세요.
        </p>
      </div>
      
      <div style="background: #f1f8e9; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2 style="color: #558b2f; margin-top: 0; font-size: 18px;">📌 중요 안내사항</h2>
        <ul style="margin: 10px 0; padding-left: 20px; color: #666;">
          <li>본 거래명세서는 실제 출고된 상품만을 기준으로 작성되었습니다.</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e0e0e0;">
        <p style="color: #666; font-size: 14px; margin: 5px 0;">
          <strong>(주) 루소 (LUSSO)</strong>
        </p>
        <p style="color: #666; font-size: 14px; margin: 5px 0;">
          고객센터: 010-2131-7540 | 이메일: bsion5185@gmail.com
        </p>
        <p style="color: #999; font-size: 12px; margin: 15px 0 0 0;">
          문의사항이 있으시면 고객센터로 연락주세요. 루소 Lusso
        </p>
      </div>
    </div>
  `

  const attachments: EmailAttachment[] = [{
    filename: `거래명세서_${orderData.order_number}_${new Date().toISOString().split('T')[0]}.xlsx`,
    content: excelBuffer,
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }]

  return await sendEmail({
    to: recipientEmail,
    subject: `[루소](으)로부터 [거래명세서](이)가 도착했습니다 - ${orderData.order_number}`,
    html: emailHtml,
    attachments
  })
}

// 이메일 설정 테스트 함수
export async function testEmailConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const config = getEmailConfig()
    
    if (!config.auth.user || !config.auth.pass) {
      throw new Error('이메일 설정이 없습니다. 환경변수를 확인해주세요.')
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth
    })

    await transporter.verify()
    
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    }
  }
} 