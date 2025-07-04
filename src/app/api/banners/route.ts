import { NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: banners, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
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
