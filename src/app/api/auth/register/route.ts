import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabase } from '@/shared/lib/supabase'
import { validateBusinessNumber } from '@/shared/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      username,
      email,
      password,
      companyName,
      businessNumber,
      representativeName,
      businessType,
      businessCategory,
      phone,
      address,
      postalCode,
      recipientName,
      recipientPhone,
      recipientAddress,
      recipientPostalCode,
      businessLicense
    } = body

    // 필수 필드 검증
    if (!username || !email || !password || !companyName || !businessNumber || !representativeName || !businessType || !businessCategory || !phone || !address || !postalCode || !recipientName || !recipientPhone || !recipientAddress || !recipientPostalCode) {
      return NextResponse.json(
        { success: false, message: '모든 필수 필드를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 아이디 형식 검증
    const usernamePattern = /^[a-zA-Z0-9]+$/
    if (username.length < 4 || !usernamePattern.test(username)) {
      return NextResponse.json(
        { success: false, message: '아이디는 4자 이상의 영문과 숫자만 사용 가능합니다.' },
        { status: 400 }
      )
    }

    // 이메일 형식 검증
    const emailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
    if (!emailPattern.test(email)) {
      return NextResponse.json(
        { success: false, message: '올바른 이메일 형식을 입력해주세요.' },
        { status: 400 }
      )
    }

    // 비밀번호 강도 검증
    const passwordPattern = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
    if (password.length < 8 || !passwordPattern.test(password)) {
      return NextResponse.json(
        { success: false, message: '비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 포함해야 합니다.' },
        { status: 400 }
      )
    }

    // 사업자등록번호 검증
    const businessNumberValidation = validateBusinessNumber(businessNumber)
    if (businessNumberValidation !== true) {
      return NextResponse.json(
        { success: false, message: businessNumberValidation },
        { status: 400 }
      )
    }

    // 전화번호 형식 검증
    const phonePattern = /^(01[0-9]-\d{3,4}-\d{4}|02-\d{3,4}-\d{4}|0[3-9][0-9]-\d{3}-\d{4})$/
    if (!phonePattern.test(phone) || !phonePattern.test(recipientPhone)) {
      return NextResponse.json(
        { success: false, message: '올바른 전화번호 형식을 입력해주세요. (예: 010-1234-5678, 02-123-4567, 031-123-4567)' },
        { status: 400 }
      )
    }

    // 아이디 중복 확인
    const { data: existingUserByUsername } = await supabase
      .from('users')
      .select('id')
      .eq('user_id', username)
      .single()

    if (existingUserByUsername) {
      return NextResponse.json(
        { success: false, message: '이미 사용 중인 아이디입니다.' },
        { status: 400 }
      )
    }

    // 이메일 중복 확인
    const { data: existingUserByEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUserByEmail) {
      return NextResponse.json(
        { success: false, message: '이미 사용 중인 이메일입니다.' },
        { status: 400 }
      )
    }

    // 사업자번호 중복 확인
    const { data: existingUserByBusiness } = await supabase
      .from('users')
      .select('id')
      .eq('business_number', businessNumber)
      .single()

    if (existingUserByBusiness) {
      return NextResponse.json(
        { success: false, message: '이미 등록된 사업자번호입니다.' },
        { status: 400 }
      )
    }

    // 비밀번호 해싱
    const saltRounds = 12
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // 사용자 생성
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        user_id: username,
        email,
        password_hash: hashedPassword,
        company_name: companyName,
        business_number: businessNumber,
        representative_name: representativeName,
        business_type: businessType,
        business_category: businessCategory,
        phone,
        address,
        postal_code: postalCode,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        business_license: businessLicense || null,
        approval_status: 'pending',
        is_active: true
      })
      .select()
      .single()

    if (error) {
      console.error('회원가입 오류:', error)
      return NextResponse.json(
        { success: false, message: '회원가입 처리 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 배송지 정보 저장
    const { error: shippingError } = await supabase
      .from('shipping_addresses')
      .insert({
        user_id: newUser.id,
        recipient_name: recipientName,
        phone: recipientPhone,
        address: recipientAddress,
        postal_code: recipientPostalCode,
        is_default: true
      })

    if (shippingError) {
      console.error('배송지 저장 오류:', shippingError)
      // 배송지 저장 실패해도 회원가입은 성공으로 처리
    }

    // 성공 응답 (민감한 정보 제외)
    const userResponse = {
      id: newUser.id,
      userId: newUser.user_id,
      email: newUser.email,
      companyName: newUser.company_name,
      businessNumber: newUser.business_number,
      representativeName: newUser.representative_name,
      approvalStatus: newUser.approval_status,
      createdAt: newUser.created_at
    }

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.',
      data: userResponse
    }, { status: 201 })

  } catch (error) {
    console.error('회원가입 API 오류:', error)
    return NextResponse.json(
      { success: false, message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 