import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username } = body

    // 필수 필드 검증
    if (!username) {
      return NextResponse.json(
        { success: false, message: '아이디를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 아이디 길이 검증
    if (username.length < 4) {
      return NextResponse.json(
        { success: false, message: '아이디는 4자 이상 입력해주세요.' },
        { status: 400 }
      )
    }

    // 아이디 형식 검증 (영문, 숫자만 허용)
    const usernamePattern = /^[a-zA-Z0-9]+$/
    if (!usernamePattern.test(username)) {
      return NextResponse.json(
        { success: false, message: '아이디는 영문과 숫자만 사용 가능합니다.' },
        { status: 400 }
      )
    }

    // 데이터베이스에서 아이디 중복 확인
    const { data: existingUser, error } = await supabase
      .from('users')
      .select('id')
      .eq('user_id', username)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116은 데이터가 없을 때 발생하는 에러
      console.error('아이디 중복확인 오류:', error)
      return NextResponse.json(
        { success: false, message: '중복확인 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: '이미 사용 중인 아이디입니다.' },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { success: true, message: '사용 가능한 아이디입니다.' },
      { status: 200 }
    )

  } catch (error) {
    console.error('아이디 중복확인 API 오류:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 