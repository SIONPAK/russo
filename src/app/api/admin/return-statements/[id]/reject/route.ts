import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// PATCH - 반품명세서 거절
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
    const { reason } = body

    if (!reason || !reason.trim()) {
      return NextResponse.json({
        success: false,
        error: '거절 사유를 입력해주세요.'
      }, { status: 400 })
    }

    // 반품명세서 존재 확인
    const { data: statement, error: checkError } = await supabase
      .from('return_statements')
      .select('id, status, company_name, order_id')
      .eq('id', id)
      .single()

    if (checkError || !statement) {
      return NextResponse.json({
        success: false,
        error: '반품명세서를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 이미 처리된 반품명세서는 거절 불가
    if (statement.status !== 'pending') {
      return NextResponse.json({
        success: false,
        error: '대기중인 반품명세서만 거절할 수 있습니다.'
      }, { status: 400 })
    }

    // 반품명세서 상태를 거절로 변경
    const { error: updateError } = await supabase
      .from('return_statements')
      .update({
        status: 'rejected',
        rejection_reason: reason.trim(),
        processed_at: getKoreaTime(),
        updated_at: getKoreaTime()
      })
      .eq('id', id)

    if (updateError) {
      console.error('반품명세서 거절 처리 오류:', updateError)
      return NextResponse.json({
        success: false,
        error: '반품 거절 처리에 실패했습니다.'
      }, { status: 500 })
    }

    // 관련 주문 상태 업데이트 (선택사항)
    await supabase
      .from('orders')
      .update({
        updated_at: getKoreaTime()
      })
      .eq('id', statement.order_id)

    return NextResponse.json({
      success: true,
      message: `${statement.company_name}의 반품이 거절되었습니다.`,
      data: {
        statement_id: id,
        status: 'rejected',
        rejection_reason: reason.trim(),
        processed_at: getKoreaTime()
      }
    })

  } catch (error) {
    console.error('반품명세서 거절 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 