import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    
    const { items } = body

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({
        success: false,
        error: '아이템 정보가 필요합니다.'
      }, { status: 400 })
    }

    // 반품명세서 존재 확인
    const { data: statement, error: statementError } = await supabase
      .from('return_statements')
      .select('id, status')
      .eq('id', id)
      .single()

    if (statementError || !statement) {
      return NextResponse.json({
        success: false,
        error: '반품명세서를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 반품명세서 아이템 업데이트
    const { error: updateError } = await supabase
      .from('return_statements')
      .update({
        items: items,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) {
      console.error('Update items error:', updateError)
      return NextResponse.json({
        success: false,
        error: '아이템 업데이트에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '반품 아이템이 성공적으로 업데이트되었습니다.'
    })

  } catch (error) {
    console.error('Update return statement items API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 