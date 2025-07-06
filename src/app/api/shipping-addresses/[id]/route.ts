import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// PUT /api/shipping-addresses/[id] - 배송지 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    const { userId, recipient_name, phone, address, postal_code, is_default } = body

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '사용자 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 기본 배송지로 설정하는 경우 기존 기본 배송지 해제
    if (is_default) {
      await supabase
        .from('shipping_addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
        .neq('id', id)
    }

    // 업데이트할 데이터 준비
    const updateData: any = {}
    if (recipient_name !== undefined) updateData.recipient_name = recipient_name
    if (phone !== undefined) updateData.phone = phone
    if (address !== undefined) updateData.address = address
    if (postal_code !== undefined) updateData.postal_code = postal_code
    if (is_default !== undefined) updateData.is_default = is_default

    // 배송지 수정
    const { data: updatedAddress, error } = await supabase
      .from('shipping_addresses')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Shipping address update error:', error)
      return NextResponse.json({
        success: false,
        error: '배송지 수정에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: updatedAddress
    })

  } catch (error) {
    console.error('Shipping address update API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// DELETE /api/shipping-addresses/[id] - 배송지 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '사용자 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 배송지 삭제
    const { error } = await supabase
      .from('shipping_addresses')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('Shipping address delete error:', error)
      return NextResponse.json({
        success: false,
        error: '배송지 삭제에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '배송지가 삭제되었습니다.'
    })

  } catch (error) {
    console.error('Shipping address delete API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 