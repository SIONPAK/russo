import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// GET - 이메일 발송 로그 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')

    let query = supabase
      .from('email_logs')
      .select('*')
      .order('sent_at', { ascending: false })

    // 특정 주문의 로그만 조회
    if (orderId) {
      query = query.eq('order_id', orderId)
    }

    const { data: emailLogs, error } = await query

    if (error) {
      console.error('이메일 로그 조회 오류:', error)
      return NextResponse.json({
        success: false,
        error: '이메일 로그 조회에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: emailLogs || []
    })

  } catch (error) {
    console.error('이메일 로그 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '이메일 로그 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 