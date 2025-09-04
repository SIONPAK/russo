import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// PATCH - 개별 샘플 명세서 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const updates = await request.json()

    console.log(`🔄 샘플 명세서 수정 시작: ${id}`)

    // 🎯 sample_number로 조회 (그룹 번호 또는 개별 번호 처리)
    let samples: any[] = []
    
    if (id.endsWith('-01') || id.endsWith('-02') || id.match(/-\d{2}$/)) {
      // 개별 번호인 경우 (SP-20250714-906413ZTHM-01)
      const { data: individualSamples, error: individualError } = await supabase
        .from('samples')
        .select('*')
        .eq('sample_number', id)
      
      if (individualError) {
        console.error('개별 샘플 조회 오류:', individualError)
        return NextResponse.json({
          success: false,
          error: '샘플을 찾을 수 없습니다.'
        }, { status: 404 })
      }
      
      if (individualSamples) {
        samples = individualSamples
      }
    } else {
      // 그룹 번호인 경우 (SP-20250714-906413ZTHM) - 해당 그룹의 모든 샘플 찾기
      const { data: groupSamples, error: groupError } = await supabase
        .from('samples')
        .select('*')
        .like('sample_number', `${id}%`)
      
      if (groupError) {
        console.error('그룹 샘플 조회 오류:', groupError)
        return NextResponse.json({
          success: false,
          error: '샘플을 찾을 수 없습니다.'
        }, { status: 404 })
      }
      
      if (groupSamples) {
        samples = groupSamples
      }
    }
    
    if (samples.length === 0) {
      return NextResponse.json({
        success: false,
        error: '해당 샘플을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 실제 sample_number 목록 추출
    const actualSampleNumbers = samples.map(sample => sample.sample_number)
    console.log('🎯 실제 업데이트할 sample_numbers:', actualSampleNumbers)

    // 업데이트 데이터 준비 (color, size는 제외하고 product_options만 사용)
    const { color, size, ...safeUpdates } = updates
    
    // product_options가 있는 경우에만 포함
    const updateData: any = {
      ...safeUpdates,
      updated_at: getKoreaTime()
    }
    
    // color와 size가 제공된 경우 product_options로 변환
    if (color && size) {
      updateData.product_options = `색상: ${color}, 사이즈: ${size}`
    }

    // 상태별 특별 처리
    if (updates.status) {
      switch (updates.status) {
        case 'shipped':
          updateData.shipped_at = updateData.shipped_at || getKoreaTime()
          updateData.outgoing_date = updateData.outgoing_date || getKoreaTime()
          // D-21 디데이 설정 (21일 후)
          updateData.due_date = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString()
          break

        case 'returned':
          updateData.return_date = updateData.return_date || getKoreaTime()
          updateData.delivered_at = updateData.delivered_at || getKoreaTime()
          break

        case 'charged':
          updateData.charge_date = updateData.charge_date || getKoreaTime()
          updateData.delivered_at = updateData.delivered_at || getKoreaTime()
          if (!updateData.charge_amount) {
            updateData.charge_amount = 30000 // 기본 샘플 결제 금액
          }
          break
      }
    }

    // 샘플 업데이트 실행
    const { data: updatedSamples, error: updateError } = await supabase
      .from('samples')
      .update(updateData)
      .in('sample_number', actualSampleNumbers)
      .select()

    if (updateError) {
      console.error('Sample update error:', updateError)
      return NextResponse.json({
        success: false,
        error: '샘플 수정에 실패했습니다.'
      }, { status: 500 })
    }

    console.log(`✅ 샘플 수정 완료: ${updatedSamples.length}개`)

    return NextResponse.json({
      success: true,
      message: `${updatedSamples.length}개의 샘플이 수정되었습니다.`,
      data: updatedSamples
    })

  } catch (error) {
    console.error('Sample update API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// GET - 개별 샘플 명세서 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 🎯 sample_number로 조회
    const { data: samples, error } = await supabase
      .from('samples')
      .select(`
        *,
        users!samples_customer_id_fkey (
          id,
          company_name,
          representative_name,
          phone,
          email
        ),
        products!samples_product_id_fkey (
          id,
          name,
          code,
          price
        )
      `)
      .like('sample_number', `${id}%`)

    if (error) {
      console.error('Sample fetch error:', error)
      return NextResponse.json({
        success: false,
        error: '샘플 조회에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: samples
    })

  } catch (error) {
    console.error('Sample fetch API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 