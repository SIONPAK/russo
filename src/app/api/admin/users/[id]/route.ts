import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

// GET - 특정 사용자 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('User fetch error:', error)
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
    console.error('User fetch API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// PUT - 사용자 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const {
      email,
      company_name,
      business_number,
      representative_name,
      phone,
      address,
      postal_code,
      recipient_name,
      recipient_phone,
      approval_status,
      is_active,
      customer_grade
    } = body

    // 이메일 중복 검사 (자신 제외)
    if (email) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', id)
        .single()

      if (existingUser) {
        return NextResponse.json(
          { success: false, error: '이미 사용 중인 이메일입니다.' },
          { status: 400 }
        )
      }
    }

    // 사업자번호 중복 검사 (자신 제외)
    if (business_number) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('business_number', business_number)
        .neq('id', id)
        .single()

      if (existingUser) {
        return NextResponse.json(
          { success: false, error: '이미 등록된 사업자번호입니다.' },
          { status: 400 }
        )
      }
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({
        email,
        company_name,
        business_number,
        representative_name,
        phone,
        address,
        postal_code,
        recipient_name,
        recipient_phone,
        approval_status,
        is_active,
        customer_grade,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('User update error:', error)
      return NextResponse.json(
        { success: false, error: '사용자 정보 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 민감한 정보 제외
    const { password_hash, ...userResponse } = user

    return NextResponse.json({
      success: true,
      data: userResponse,
      message: '사용자 정보가 성공적으로 수정되었습니다.'
    })

  } catch (error) {
    console.error('User update API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// DELETE - 사용자 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 주문이 있는 사용자인지 확인 (있다면 삭제 대신 비활성화)
    const { data: orders } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', id)
      .limit(1)

    if (orders && orders.length > 0) {
      // 주문이 있으면 비활성화만 수행
      const { error } = await supabase
        .from('users')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) {
        console.error('User deactivation error:', error)
        return NextResponse.json(
          { success: false, error: '사용자 비활성화에 실패했습니다.' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: '주문 이력이 있어 사용자가 비활성화되었습니다.'
      })
    }

    // 주문이 없으면 완전 삭제
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('User delete error:', error)
      return NextResponse.json(
        { success: false, error: '사용자 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '사용자가 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('User delete API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 