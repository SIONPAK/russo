import { NextRequest, NextResponse } from 'next/server'
import { testEmailConnection, sendEmail } from '@/shared/lib/email-utils'

// 이메일 연결 테스트 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'test-connection') {
      // 이메일 설정 연결 테스트
      const result = await testEmailConnection()
      
      return NextResponse.json({
        success: result.success,
        message: result.success ? '이메일 설정이 정상입니다.' : '이메일 설정을 확인해주세요.',
        error: result.error
      })
    }

    return NextResponse.json({
      success: false,
      error: '올바른 액션을 지정해주세요. (?action=test-connection)'
    }, { status: 400 })

  } catch (error) {
    console.error('Email test error:', error)
    return NextResponse.json({
      success: false,
      error: '이메일 테스트 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 테스트 이메일 발송 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, message } = body

    if (!to || !subject || !message) {
      return NextResponse.json({
        success: false,
        error: '수신자, 제목, 메시지가 필요합니다.'
      }, { status: 400 })
    }

    // 테스트 이메일 HTML 생성
    const testEmailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
                                                     <h1 style="color: #333; margin: 0;">루소 (LUSSO)</h1>
          <p style="color: #666; margin: 5px 0;">이메일 발송 테스트</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #495057; margin-top: 0; font-size: 18px;">📧 테스트 메시지</h2>
          <p style="color: #666; line-height: 1.6;">${message}</p>
        </div>
        
        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2 style="color: #1976d2; margin-top: 0; font-size: 18px;">✅ 이메일 발송 성공</h2>
          <p style="color: #666; margin: 10px 0;">
            이 이메일을 받으셨다면 이메일 설정이 정상적으로 작동하고 있습니다.<br>
            이제 거래명세서 이메일 발송 기능을 사용하실 수 있습니다.
          </p>
        </div>
        
        <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #e0e0e0;">
          <p style="color: #666; font-size: 14px; margin: 5px 0;">
                                                     <strong>(주) 루소 (LUSSO)</strong>
          </p>
          <p style="color: #666; font-size: 14px; margin: 5px 0;">
            고객센터: 010-2131-7540 | 이메일: info@russo.co.kr
          </p>
          <p style="color: #999; font-size: 12px; margin: 15px 0 0 0;">
            발송 시간: ${new Date().toLocaleString('ko-KR')}
          </p>
        </div>
      </div>
    `

    // 테스트 이메일 발송
    const result = await sendEmail({
      to,
      subject: `[루소] ${subject}`,
      html: testEmailHtml
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: '테스트 이메일이 성공적으로 발송되었습니다.',
        messageId: result.messageId
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || '이메일 발송에 실패했습니다.'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Test email sending error:', error)
    return NextResponse.json({
      success: false,
      error: '테스트 이메일 발송 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 