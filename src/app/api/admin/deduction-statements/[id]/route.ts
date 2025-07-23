import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { getKoreaTime } from '@/shared/lib/utils'

// PUT - 차감명세서 수정 (대기중 상태만 수정 가능)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { deductionType, deductionReason, items } = body

    // 필수 필드 검증
    if (!deductionType || !deductionReason || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 기존 차감명세서 확인
    const { data: existingStatement, error: fetchError } = await supabase
      .from('deduction_statements')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingStatement) {
      return NextResponse.json(
        { success: false, error: '차감명세서를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 대기중 상태만 수정 가능
    if (existingStatement.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: '대기중 상태의 차감명세서만 수정할 수 있습니다.' },
        { status: 400 }
      )
    }

    // 총 차감 금액 계산
    const totalAmount = items.reduce((sum: number, item: any) => {
      const supplyAmount = item.deduction_quantity * item.unit_price
      const vat = Math.floor(supplyAmount * 0.1)
      return sum + supplyAmount + vat
    }, 0)

    // 마일리지 차감 금액 계산 (총 차감 금액과 동일)
    const mileageAmount = totalAmount

    // 차감명세서 업데이트
    const { data: updatedStatement, error: updateError } = await supabase
      .from('deduction_statements')
      .update({
        deduction_type: deductionType,
        deduction_reason: deductionReason,
        items: items,
        total_amount: totalAmount,
        mileage_amount: mileageAmount,
        updated_at: getKoreaTime()
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Deduction statement update error:', updateError)
      return NextResponse.json(
        { success: false, error: '차감명세서 수정에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: updatedStatement,
      message: '차감명세서가 성공적으로 수정되었습니다.'
    })

  } catch (error) {
    console.error('Deduction statement update API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 