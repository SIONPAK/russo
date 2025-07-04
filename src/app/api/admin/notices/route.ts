import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('공지사항 조회 실패:', error)
    return NextResponse.json(
      { error: '공지사항을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { title, content, is_pinned } = await request.json()

    console.log('공지사항 생성 요청:', { title, content, is_pinned })

    const { data, error } = await supabase
      .from('notices')
      .insert({
        title,
        content,
        is_pinned: is_pinned || false
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json(
        { error: `데이터베이스 오류: ${error.message}` },
        { status: 500 }
      )
    }

    console.log('공지사항 생성 성공:', data)
    return NextResponse.json(data)
  } catch (error) {
    console.error('공지사항 생성 실패:', error)
    return NextResponse.json(
      { error: '공지사항 생성에 실패했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 