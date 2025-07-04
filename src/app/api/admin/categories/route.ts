import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'

// GET - 모든 카테고리 메뉴 조회 (관리자용)
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: categories, error } = await supabase
      .from('category_menus')
      .select('*')
      .order('order_index', { ascending: true })

    if (error) {
      console.error('Admin categories fetch error:', error)
      return NextResponse.json(
        { success: false, error: '카테고리 메뉴를 불러오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: categories || []
    })

  } catch (error) {
    console.error('Admin categories API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// POST - 새 카테고리 메뉴 추가
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()

    const {
      name,
      key,
      path,
      order_index,
      is_active = true,
      is_special = false,
      badge,
      text_color
    } = body

    // 필수 필드 검증
    if (!name || !key || !path) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 키 중복 확인
    const { data: existingCategory } = await supabase
      .from('category_menus')
      .select('id')
      .eq('key', key)
      .single()

    if (existingCategory) {
      return NextResponse.json(
        { success: false, error: '이미 사용 중인 메뉴 키입니다.' },
        { status: 400 }
      )
    }

    const { data: category, error } = await supabase
      .from('category_menus')
      .insert([{
        name,
        key,
        path,
        order_index: order_index || 1,
        is_active,
        is_special,
        badge: badge || null,
        text_color: text_color || null
      }])
      .select()
      .single()

    if (error) {
      console.error('Category creation error:', error)
      return NextResponse.json(
        { success: false, error: '카테고리 메뉴 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: category,
      message: '카테고리 메뉴가 성공적으로 생성되었습니다.'
    })

  } catch (error) {
    console.error('Category creation API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 