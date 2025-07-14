import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// PATCH - 샘플 상태 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { sample_id, status, tracking_number } = await request.json()

    if (!sample_id || !status) {
      return NextResponse.json({
        success: false,
        error: '필수 데이터가 누락되었습니다.'
      }, { status: 400 })
    }

    console.log(`🔄 개별 샘플 상태 업데이트: ${sample_id} -> ${status}`)

    // 🎯 sample_number로 조회 (개별 번호만 처리)
    let currentSample: any = null
    
    if (sample_id.endsWith('-01') || sample_id.endsWith('-02') || sample_id.match(/-\d{2}$/)) {
      // 개별 번호인 경우 (SP-20250714-906413ZTHM-01)
      const { data: individualSample, error: individualError } = await supabase
        .from('samples')
        .select('*')
        .eq('sample_number', sample_id)
        .single()
      
      if (individualError || !individualSample) {
        return NextResponse.json({
          success: false,
          error: '샘플을 찾을 수 없습니다.'
        }, { status: 404 })
      }
      
      currentSample = individualSample
    } else {
      // 그룹 번호인 경우 - 개별 API에서는 지원하지 않음
      return NextResponse.json({
        success: false,
        error: '그룹 번호는 일괄 업데이트 API를 사용해주세요.'
      }, { status: 400 })
    }
    
    const fetchError = null // 이미 조회 완료

    if (fetchError || !currentSample) {
      return NextResponse.json({
        success: false,
        error: '샘플을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 상태별 업데이트 데이터 설정
    const updateData: any = {
      status,
      updated_at: getKoreaTime()
    }

    if (tracking_number) {
      updateData.tracking_number = tracking_number
    }

    // 상태별 추가 필드 설정
    switch (status) {
      case 'shipped':
        updateData.shipped_at = getKoreaTime()
        updateData.outgoing_date = getKoreaTime()
        // 🎯 D-21 디데이 설정
        updateData.due_date = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString()
        break
      case 'returned':
        updateData.return_date = getKoreaTime()
        updateData.delivered_at = getKoreaTime()
        break
      case 'charged':
        updateData.charge_date = getKoreaTime()
        updateData.delivered_at = getKoreaTime()
        break
    }

    // samples 테이블 업데이트 (sample_number로 직접 업데이트)
    const { data: sample, error: sampleError } = await supabase
      .from('samples')
      .update(updateData)
      .eq('sample_number', sample_id)
      .select()
      .single()

    if (sampleError) {
      console.error('샘플 상태 업데이트 오류:', sampleError)
      return NextResponse.json({
        success: false,
        error: '샘플 상태 업데이트에 실패했습니다.'
      }, { status: 500 })
    }

    // 🎯 재고 처리
    if (status === 'shipped' && currentSample.status !== 'shipped') {
      // 출고 시 재고 차감
      try {
        const parseOptions = (options: string) => {
          const colorMatch = options.match(/색상:\s*([^,]+)/);
          const sizeMatch = options.match(/사이즈:\s*([^,]+)/);
          return {
            color: colorMatch ? colorMatch[1].trim() : null,
            size: sizeMatch ? sizeMatch[1].trim() : null
          };
        };

        const { color, size } = parseOptions(currentSample.product_options || '');

        const { data: stockResult, error: stockError } = await supabase
          .rpc('adjust_physical_stock', {
            p_product_id: currentSample.product_id,
            p_color: color,
            p_size: size,
            p_quantity_change: -currentSample.quantity,
            p_reason: `샘플 출고 - ${currentSample.sample_number}`
          })

        if (stockError || !stockResult) {
          console.error('❌ 샘플 출고 재고 차감 실패:', stockError)
        } else {
          console.log(`✅ 샘플 출고 재고 차감 완료: ${currentSample.sample_number}`)
        }
      } catch (stockError) {
        console.error('재고 차감 실패:', stockError)
      }
    }

    if (status === 'returned' && currentSample.status !== 'returned') {
      // 회수 시 재고 복원
      try {
        const parseOptions = (options: string) => {
          const colorMatch = options.match(/색상:\s*([^,]+)/);
          const sizeMatch = options.match(/사이즈:\s*([^,]+)/);
          return {
            color: colorMatch ? colorMatch[1].trim() : null,
            size: sizeMatch ? sizeMatch[1].trim() : null
          };
        };

        const { color, size } = parseOptions(currentSample.product_options || '');

        const { data: stockResult, error: stockError } = await supabase
          .rpc('adjust_physical_stock', {
            p_product_id: currentSample.product_id,
            p_color: color,
            p_size: size,
            p_quantity_change: currentSample.quantity,
            p_reason: `샘플 회수 - ${currentSample.sample_number}`
          })

        if (stockError || !stockResult) {
          console.error('❌ 샘플 회수 재고 복원 실패:', stockError)
        } else {
          console.log(`✅ 샘플 회수 재고 복원 완료: ${currentSample.sample_number}`)
        }
      } catch (stockError) {
        console.error('재고 복원 실패:', stockError)
      }
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