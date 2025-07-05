import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('Logout API called')

    // 쿠키 삭제하여 로그아웃 처리
    const response = NextResponse.json({
      success: true,
      message: '로그아웃되었습니다.'
    }, { status: 200 })

    // 모든 인증 관련 쿠키 삭제
    response.cookies.set('user_id', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // 즉시 만료
      path: '/'
    })

    response.cookies.set('user_type', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // 즉시 만료
      path: '/'
    })

    console.log('Logout cookies cleared')

    return response

  } catch (error) {
    console.error('Logout API error:', error)
    return NextResponse.json(
      { success: false, message: '로그아웃 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 