import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const { data: popup, error } = await supabase
      .from('popups')
      .update(body)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Popup update error:', error)
      return NextResponse.json(
        { success: false, error: '팝업 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: popup,
      message: '팝업이 성공적으로 수정되었습니다.'
    })

  } catch (error) {
    console.error('Popup update API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { error } = await supabase
      .from('popups')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Popup delete error:', error)
      return NextResponse.json(
        { success: false, error: '팝업 삭제에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: '팝업이 성공적으로 삭제되었습니다.'
    })

  } catch (error) {
    console.error('Popup delete API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 