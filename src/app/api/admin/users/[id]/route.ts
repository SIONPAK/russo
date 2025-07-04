import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

// GET - 특정 사용자 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

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

    return NextResponse.json({
      success: true,
      data: user
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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
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
      is_active
    } = body

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
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('User update error:', error)
      
      // 중복 에러 처리
      if (error.code === '23505') {
        if (error.message.includes('email')) {
          return NextResponse.json(
            { success: false, error: '이미 등록된 이메일입니다.' },
            { status: 400 }
          )
        }
        if (error.message.includes('business_number')) {
          return NextResponse.json(
            { success: false, error: '이미 등록된 사업자번호입니다.' },
            { status: 400 }
          )
        }
      }

      return NextResponse.json(
        { success: false, error: '사용자 정보 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: user,
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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // 사용자의 주문이 있는지 확인
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', id)
      .limit(1)

    if (ordersError) {
      console.error('Orders check error:', ordersError)
      return NextResponse.json(
        { success: false, error: '사용자 삭제 검증에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 주문이 있는 경우 삭제 불가
    if (orders && orders.length > 0) {
      return NextResponse.json(
        { success: false, error: '주문 내역이 있는 사용자는 삭제할 수 없습니다. 비활성화를 사용해주세요.' },
        { status: 400 }
      )
    }

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