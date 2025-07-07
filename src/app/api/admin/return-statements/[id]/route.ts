import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// DELETE - 반품명세서 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 반품명세서 존재 확인
    const { data: statement, error: checkError } = await supabase
      .from('return_statements')
      .select('id, status')
      .eq('id', id)
      .single()

    if (checkError || !statement) {
      return NextResponse.json({
        success: false,
        error: '반품명세서를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 처리된 반품명세서는 삭제 불가
    if (statement.status === 'refunded') {
      return NextResponse.json({
        success: false,
        error: '이미 처리된 반품명세서는 삭제할 수 없습니다.'
      }, { status: 400 })
    }

    // 반품명세서 삭제
    const { error: deleteError } = await supabase
      .from('return_statements')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('반품명세서 삭제 오류:', deleteError)
      return NextResponse.json({
        success: false,
        error: '반품명세서 삭제에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '반품명세서가 삭제되었습니다.'
    })

  } catch (error) {
    console.error('반품명세서 삭제 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 