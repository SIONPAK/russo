import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'

// GET - 활성화된 카테고리 메뉴 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    const { data: categories, error } = await supabase
      .from('category_menus')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true })

    if (error) {
      console.error('Categories fetch error:', error)
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
    console.error('Categories API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 