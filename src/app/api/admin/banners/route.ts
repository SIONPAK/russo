import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: banners, error } = await supabase
      .from('banners')
      .select('*')
      .order('order_index', { ascending: true })

    if (error) {
      console.error('배너 조회 오류:', error)
      return NextResponse.json({ 
        success: false, 
        error: '배너 조회에 실패했습니다.' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data: banners 
    })
  } catch (error) {
    console.error('배너 조회 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '배너 조회에 실패했습니다.' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { title, desktop_image, mobile_image, link_url, order_index, is_active } = body

    const { data, error } = await supabase
      .from('banners')
      .insert({
        title,
        desktop_image,
        mobile_image,
        link_url,
        order_index,
        is_active: is_active ?? true
      })
      .select()
      .single()

    if (error) {
      console.error('배너 생성 오류:', error)
      return NextResponse.json({ 
        success: false, 
        error: '배너 생성에 실패했습니다.' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data,
      message: '배너가 생성되었습니다.' 
    })
  } catch (error) {
    console.error('배너 생성 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '배너 생성에 실패했습니다.' 
    }, { status: 500 })
  }
}
