import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // 쿠키에서 사용자 정보 확인
    const userId = request.cookies.get('user_id')?.value
    const userType = request.cookies.get('user_type')?.value

    console.log('Auth me API - cookies:', { userId, userType })

    if (!userId || !userType) {
      return NextResponse.json(
        { success: false, message: '인증 정보가 없습니다.' },
        { status: 401 }
      )
    }

    let user = null

    if (userType === 'admin') {
      // 관리자 정보 조회
      const { data: adminUser, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('username', userId)
        .single()

      if (adminError || !adminUser) {
        console.log('Admin user not found:', adminError)
        return NextResponse.json(
          { success: false, message: '관리자 정보를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      user = {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role,
        userType: 'admin'
      }
    } else {
      // 일반 사용자 정보 조회
      const { data: customerUser, error: customerError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (customerError || !customerUser) {
        console.log('Customer user not found:', customerError)
        return NextResponse.json(
          { success: false, message: '사용자 정보를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      // 승인 상태 확인
      if (customerUser.approval_status !== 'approved') {
        return NextResponse.json(
          { success: false, message: '승인되지 않은 계정입니다.' },
          { status: 403 }
        )
      }

      // 활성 상태 확인
      if (!customerUser.is_active && !customerUser.is_dormant) {
        return NextResponse.json(
          { success: false, message: '비활성화된 계정입니다.' },
          { status: 403 }
        )
      }

      user = {
        id: customerUser.id,
        user_id: customerUser.user_id,
        email: customerUser.email,
        company_name: customerUser.company_name,
        business_number: customerUser.business_number,
        representative_name: customerUser.representative_name,
        phone: customerUser.phone,
        address: customerUser.address,
        postal_code: customerUser.postal_code,
        recipient_name: customerUser.recipient_name,
        recipient_phone: customerUser.recipient_phone,
        approval_status: customerUser.approval_status,
        is_active: customerUser.is_active,
        is_dormant: customerUser.is_dormant,
        customer_grade: customerUser.customer_grade,
        last_login_at: customerUser.last_login_at,
        userType: 'customer'
      }
    }

    return NextResponse.json({
      success: true,
      data: user
    }, { status: 200 })

  } catch (error) {
    console.error('Auth me API error:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 