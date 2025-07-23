import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { getKoreaTime } from '@/shared/lib/utils'

// GET - 사용자 프로필 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 민감한 정보 제외
    const { password_hash, ...userResponse } = user

    return NextResponse.json({
      success: true,
      data: userResponse
    })

  } catch (error) {
    console.error('Profile fetch API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// PUT - 사용자 프로필 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, phone, email, address, postal_code } = body

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      )
    }

    // 이메일 중복 검사 (자신 제외)
    if (email) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('user_id', userId)
        .single()

      if (existingUser) {
        return NextResponse.json(
          { success: false, error: '이미 사용 중인 이메일입니다.' },
          { status: 400 }
        )
      }
    }

    // 사용자 정보 업데이트
    const { data: user, error } = await supabase
      .from('users')
      .update({
        phone,
        email,
        address,
        postal_code,
        updated_at: getKoreaTime()
      })
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('User profile update error:', error)
      return NextResponse.json(
        { success: false, error: '프로필 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 민감한 정보 제외
    const { password_hash, ...userResponse } = user

    return NextResponse.json({
      success: true,
      data: userResponse,
      message: '프로필이 성공적으로 수정되었습니다.'
    })

  } catch (error) {
    console.error('Profile update API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 