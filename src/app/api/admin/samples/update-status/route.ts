import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// PATCH - 샘플 상태 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { sample_id, status } = await request.json()

    if (!sample_id || !status) {
      return NextResponse.json({
        success: false,
        error: '필수 데이터가 누락되었습니다.'
      }, { status: 400 })
    }

    // samples 테이블 업데이트
    const { data: sample, error: sampleError } = await supabase
      .from('samples')
      .update({
        status,
        updated_at: getKoreaTime()
      })
      .eq('id', sample_id)
      .select()
      .single()

    if (sampleError) {
      console.error('샘플 상태 업데이트 오류:', sampleError)
      return NextResponse.json({
        success: false,
        error: '샘플 상태 업데이트에 실패했습니다.'
      }, { status: 500 })
    }

    // 회수완료 시 재고 이력 기록 및 재고 수량 업데이트
    if (status === 'returned') {
      const { data: inventory, error: inventoryError } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('product_id', sample.product_id)
        .eq('color', sample.color)
        .eq('size', sample.size)
        .single()

      if (!inventoryError && inventory) {
        // 재고 수량 업데이트
        await supabase
          .from('inventory')
          .update({
            quantity: inventory.quantity + sample.quantity,
            updated_at: getKoreaTime()
          })
          .eq('product_id', sample.product_id)
          .eq('color', sample.color)
          .eq('size', sample.size)

        // 재고 이력 기록
        await supabase
          .from('inventory_audit')
          .insert({
            product_id: sample.product_id,
            color: sample.color,
            size: sample.size,
            quantity_change: sample.quantity,
            previous_quantity: inventory.quantity,
            new_quantity: inventory.quantity + sample.quantity,
            change_type: 'sample_return',
            reference_id: sample.id,
            created_at: getKoreaTime()
          })
      }
    }

    return NextResponse.json({
      success: true,
      data: sample
    })
  } catch (error) {
    console.error('샘플 상태 업데이트 오류:', error)
    return NextResponse.json({
      success: false,
      error: '샘플 상태 업데이트 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 