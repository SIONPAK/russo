import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/shared/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, password } = body

    console.log('Login attempt for userId:', userId)

    // 필수 필드 검증
    if (!userId || !password) {
      return NextResponse.json(
        { success: false, message: '아이디와 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    let user = null
    let userType = null

    // 먼저 관리자 테이블에서 확인
    const { data: adminUser, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('username', userId)
      .single()

    console.log('Admin user check:', { adminUser, adminError })

    if (!adminError && adminUser) {
      user = adminUser
      userType = 'admin'
      console.log('Found admin user:', user.username)
    } else {
      // 관리자가 아니면 일반 사용자 테이블에서 확인
      const { data: customerUser, error: customerError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single()

      console.log('Customer user check:', { customerUser, customerError })

      if (!customerError && customerUser) {
        user = customerUser
        userType = 'customer'
        console.log('Found customer user:', user.user_id)
      }
    }

    if (!user) {
      console.log('No user found for userId:', userId)
      return NextResponse.json(
        { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)
    console.log('Password validation result:', isPasswordValid)
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 일반 사용자의 경우 승인 상태 확인
    if (userType === 'customer') {
      if (user.approval_status !== 'approved') {
        const statusMessage = {
          pending: '계정 승인 대기 중입니다. 관리자 승인 후 이용 가능합니다.',
          rejected: '계정이 반려되었습니다. 관리자에게 문의해주세요.'
        }
        return NextResponse.json(
          { 
            success: false, 
            message: statusMessage[user.approval_status as 'pending' | 'rejected'] || '계정 상태를 확인할 수 없습니다.' 
          },
          { status: 403 }
        )
      }

      if (!user.is_active) {
        return NextResponse.json(
          { success: false, message: '비활성화된 계정입니다. 관리자에게 문의해주세요.' },
          { status: 403 }
        )
      }
    }

    // 성공 응답 (민감한 정보 제외)
    let userResponse
    if (userType === 'admin') {
      userResponse = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        userType: 'admin'
      }
    } else {
      userResponse = {
        id: user.id,
        user_id: user.user_id,
        email: user.email,
        company_name: user.company_name,
        business_number: user.business_number,
        representative_name: user.representative_name,
        phone: user.phone,
        address: user.address,
        postal_code: user.postal_code,
        recipient_name: user.recipient_name,
        recipient_phone: user.recipient_phone,
        approval_status: user.approval_status,
        is_active: user.is_active,
        userType: 'customer'
      }
    }

    // 로그인 성공 시 쿠키 설정
    const response = NextResponse.json({
      success: true,
      message: '로그인에 성공했습니다.',
      data: userResponse
    }, { status: 200 })

    // 사용자 정보를 쿠키에 저장 (보안을 위해 최소한의 정보만)
    const cookieUserId = userType === 'admin' ? user.username : user.user_id
    const cookieUserType = userType || 'customer'
    
    console.log('Setting cookies:', { cookieUserId, cookieUserType })

    response.cookies.set('user_id', cookieUserId, {
      httpOnly: false, // 클라이언트에서 읽을 수 있도록 임시 변경
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/'
    })
    
    response.cookies.set('user_type', cookieUserType, {
      httpOnly: false, // 클라이언트에서 읽을 수 있도록 임시 변경
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7일
      path: '/'
    })

    console.log('Login successful for:', cookieUserId, 'type:', cookieUserType)
    return response

  } catch (error) {
    console.error('로그인 API 오류:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
