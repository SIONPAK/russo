import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('popups')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('팝업 조회 실패:', error)
    return NextResponse.json(
      { error: '팝업을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      title, 
      image_url, 
      mobile_image_url, 
      width, 
      height, 
      mobile_width, 
      mobile_height, 
      start_date, 
      end_date, 
      is_active 
    } = await request.json()

    const { data, error } = await supabase
      .from('popups')
      .insert({
        title,
        image_url,
        mobile_image_url,
        width,
        height,
        mobile_width,
        mobile_height,
        start_date,
        end_date,
        is_active: is_active || true
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('팝업 생성 실패:', error)
    return NextResponse.json(
      { error: '팝업 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
} 