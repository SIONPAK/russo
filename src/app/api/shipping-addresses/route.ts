import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// GET /api/shipping-addresses - 사용자 배송지 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('user_id') || searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '사용자 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 사용자의 배송지 목록 조회
    const { data: addresses, error } = await supabase
      .from('shipping_addresses')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false }) // 기본 배송지를 먼저 정렬

    if (error) {
      console.error('Shipping addresses fetch error:', error)
      return NextResponse.json({
        success: false,
        error: '배송지 정보를 불러오는데 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: addresses || []
    })

  } catch (error) {
    console.error('Shipping addresses API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// POST /api/shipping-addresses - 새 배송지 추가
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { userId, recipient_name, phone, address, postal_code, is_default } = body

    if (!userId || !recipient_name || !phone || !address || !postal_code) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 })
    }

    // 기본 배송지로 설정하는 경우 기존 기본 배송지 해제
    if (is_default) {
      await supabase
        .from('shipping_addresses')
        .update({ is_default: false })
        .eq('user_id', userId)
    }

    // 새 배송지 추가
    const { data: newAddress, error } = await supabase
      .from('shipping_addresses')
      .insert({
        user_id: userId,
        recipient_name,
        phone,
        address,
        postal_code,
        is_default: is_default || false
      })
      .select()
      .single()

    if (error) {
      console.error('Shipping address creation error:', error)
      return NextResponse.json({
        success: false,
        error: '배송지 추가에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: newAddress
    })

  } catch (error) {
    console.error('Shipping address creation API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 