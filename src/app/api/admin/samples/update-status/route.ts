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

    // 샘플과 반품은 수동 재고 처리 (자동 출고/입고 처리 안함)
    console.log(`📝 샘플 상태 변경: ${sample.sample_number} (${currentSample.status} → ${status})`)

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