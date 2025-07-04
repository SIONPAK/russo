import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 임시로 미들웨어 비활성화 - 디버깅용
  console.log('Middleware bypassed for debugging')
  return NextResponse.next()
  
  // /admin 경로에 대한 접근 제어
  if (request.nextUrl.pathname.startsWith('/admin')) {
    try {
      // 쿠키에서 사용자 정보 확인
      const userId = request.cookies.get('user_id')?.value
      const userType = request.cookies.get('user_type')?.value

      console.log('Middleware - userId:', userId, 'userType:', userType)

      if (!userId || !userType) {
        // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
        console.log('No auth cookies found, redirecting to login')
        return NextResponse.redirect(new URL('/auth/login', request.url))
      }

      if (userType !== 'admin') {
        // 관리자가 아닌 경우 메인 페이지로 리다이렉트
        console.log('Admin access denied for user_id:', userId, 'userType:', userType)
        return NextResponse.redirect(new URL('/', request.url))
      }

      console.log('Admin access granted for:', userId)
      
      // 관리자인 경우 접근 허용
      return NextResponse.next()

    } catch (error) {
      console.error('Admin middleware error:', error)
      // 오류 발생 시 메인 페이지로 리다이렉트
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*'
  ]
} 