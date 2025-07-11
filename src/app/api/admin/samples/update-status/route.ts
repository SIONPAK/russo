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

    // 회수완료 시 새로운 재고 관리 시스템으로 재고 복원
    if (status === 'returned') {
      const { data: restoreResult, error: restoreError } = await supabase
        .rpc('adjust_physical_stock', {
          p_product_id: sample.product_id,
          p_color: sample.color || null,
          p_size: sample.size || null,
          p_quantity_change: sample.quantity, // 양수로 복원
          p_reason: `샘플 회수완료 - 샘플ID: ${sample.id}`
        })

      if (restoreError || !restoreResult) {
        console.error('❌ 샘플 재고 복원 실패:', restoreError)
      } else {
        console.log('✅ 샘플 재고 복원 완료:', sample.id)
        
        // 재고 변동 이력 기록
        await supabase
          .from('stock_movements')
          .insert({
            product_id: sample.product_id,
            movement_type: 'sample_return',
            quantity: sample.quantity,
            color: sample.color || null,
            size: sample.size || null,
            notes: `샘플 회수완료 - 샘플ID: ${sample.id}`,
            reference_id: sample.id,
            reference_type: 'sample',
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