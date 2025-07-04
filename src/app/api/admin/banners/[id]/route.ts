import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    
    const { title, desktop_image, mobile_image, link_url, order_index, is_active } = body

    const { data, error } = await supabase
      .from('banners')
      .update({
        title,
        desktop_image,
        mobile_image,
        link_url,
        order_index,
        is_active
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('배너 수정 오류:', error)
      return NextResponse.json({ 
        success: false, 
        error: '배너 수정에 실패했습니다.' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      data,
      message: '배너가 수정되었습니다.' 
    })
  } catch (error) {
    console.error('배너 수정 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '배너 수정에 실패했습니다.' 
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('banners')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('배너 삭제 오류:', error)
      return NextResponse.json({ 
        success: false, 
        error: '배너 삭제에 실패했습니다.' 
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: '배너가 삭제되었습니다.' 
    })
  } catch (error) {
    console.error('배너 삭제 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '배너 삭제에 실패했습니다.' 
    }, { status: 500 })
  }
}
