import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const now = new Date().toISOString()

    const { data, error } = await supabase
      .from('popups')
      .select('*')
      .eq('is_active', true)
      .lte('start_date', now)
      .gte('end_date', now)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('활성 팝업 조회 실패:', error)
    return NextResponse.json(
      { error: '팝업을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
} 