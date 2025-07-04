import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { title, image_url, width, height, start_date, end_date, is_active } = await request.json()

    const { data, error } = await supabase
      .from('popups')
      .update({
        title,
        image_url,
        width,
        height,
        start_date,
        end_date,
        is_active
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('팝업 수정 실패:', error)
    return NextResponse.json(
      { error: '팝업 수정에 실패했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabase
      .from('popups')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('팝업 삭제 실패:', error)
    return NextResponse.json(
      { error: '팝업 삭제에 실패했습니다.' },
      { status: 500 }
    )
  }
} 