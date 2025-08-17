import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/shared/lib/supabase'
import { getCurrentKoreanDateTime } from '@/shared/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, password } = body



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



    if (!adminError && adminUser) {
      user = adminUser
      userType = 'admin'

    } else {
      // 관리자가 아니면 일반 사용자 테이블에서 확인
      const { data: customerUser, error: customerError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single()



      if (!customerError && customerUser) {
        user = customerUser
        userType = 'customer'

      }
    }

    if (!user) {

      return NextResponse.json(
        { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password_hash)
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 일반 사용자의 경우 승인 상태 확인 및 로그인 시간 업데이트
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

      if (!user.is_active && !user.is_dormant) {
        return NextResponse.json(
          { success: false, message: '비활성화된 계정입니다. 관리자에게 문의해주세요.' },
          { status: 403 }
        )
      }

      // 휴면 계정 확인 및 해제
      if (user.is_dormant) {
        // 휴면 계정 자동 해제 (로그인 시)
        const currentKoreanTime = getCurrentKoreanDateTime()
        const { error: reactivateError } = await supabase
          .from('users')
          .update({
            is_dormant: false,
            dormant_at: null,
            is_active: true,
            last_login_at: currentKoreanTime,
            updated_at: currentKoreanTime
          })
          .eq('id', user.id)

        if (reactivateError) {
          console.error('휴면 계정 해제 오류:', reactivateError)
        } else {
          console.log('휴면 계정 자동 해제됨:', user.user_id)
          // 상태 변경 이력 로깅
          await supabase
            .from('user_status_logs')
            .insert({
              user_id: user.id,
              previous_status: 'dormant',
              new_status: 'active',
              action_type: 'activate',
              reason: '로그인에 의한 자동 휴면 해제',
              changed_by: null
            })
          
          // user 객체도 업데이트
          user.is_dormant = false
          user.dormant_at = null
          user.is_active = true
          user.last_login_at = currentKoreanTime
        }
      } else {
        // 일반 사용자의 경우 마지막 로그인 시간 업데이트
        const currentKoreanTime = getCurrentKoreanDateTime()
        const { error: updateError } = await supabase
          .from('users')
          .update({
            last_login_at: currentKoreanTime,
            updated_at: currentKoreanTime
          })
          .eq('id', user.id)

        if (updateError) {
          console.error('마지막 로그인 시간 업데이트 오류:', updateError)
        } else {
          user.last_login_at = currentKoreanTime
        }
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
        is_dormant: user.is_dormant,
        customer_grade: user.customer_grade,
        last_login_at: user.last_login_at,
        userType: 'customer'
      }
    }

    // 로그인 성공 시 쿠키 설정
    const response = NextResponse.json({
      success: true,
      message: user.is_dormant ? '휴면 계정이 해제되어 로그인되었습니다.' : '로그인에 성공했습니다.',
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
