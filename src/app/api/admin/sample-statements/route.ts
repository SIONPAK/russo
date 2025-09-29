import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// GET - 샘플 명세서 목록 조회 (업체별 그룹화)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    
    const offset = (page - 1) * limit

    // 그룹 기준으로 먼저 전체 샘플 데이터 조회 (필터링 적용)
    let allSamplesQuery = supabase
      .from('samples')
      .select(`
        id,
        sample_number,
        customer_id,
        customer_name,
        product_id,
        product_name,
        product_options,
        quantity,
        outgoing_date,
        status,
        charge_amount,
        charge_method,
        notes,
        created_at,
        updated_at,
        sample_type,
        due_date,
        return_date,
        charge_date,
        delivery_address,
        tracking_number,
        admin_notes,
        approved_at,
        shipped_at,
        delivered_at,
        rejected_at
      `)
      .order('created_at', { ascending: false })

    // 상태 필터링
    if (status && status !== 'all') {
      allSamplesQuery = allSamplesQuery.eq('status', status)
    }

    // 검색 필터링
    if (search) {
      allSamplesQuery = allSamplesQuery.or(`sample_number.ilike.%${search}%,customer_name.ilike.%${search}%,product_name.ilike.%${search}%`)
    }

    // 페이지네이션으로 모든 데이터 가져오기
    console.log('🔍 샘플 명세서 데이터 페이지네이션으로 조회 시작...')
    
    let allSamples: any[] = []
    let fetchPage = 0
    const fetchLimit = 1000
    let hasMore = true

    while (hasMore) {
      const { data: pageData, error } = await allSamplesQuery
        .range(fetchPage * fetchLimit, (fetchPage + 1) * fetchLimit - 1)

      if (error) {
        console.error(`샘플 명세서 페이지 ${fetchPage} 조회 오류:`, error)
        return NextResponse.json({
          success: false,
          error: '샘플 명세서 조회에 실패했습니다.'
        }, { status: 500 })
      }

      if (pageData && pageData.length > 0) {
        allSamples = allSamples.concat(pageData)
        console.log(`🔍 샘플 명세서 페이지 ${fetchPage + 1}: ${pageData.length}건 조회 (총 ${allSamples.length}건)`)
        fetchPage++
        
        if (pageData.length < fetchLimit) {
          hasMore = false
        }
      } else {
        hasMore = false
      }
    }

    console.log(`🔍 샘플 명세서 전체 데이터 조회 완료: ${allSamples.length}건`)

    console.log(`✅ 샘플 명세서 조회 완료: ${allSamples?.length || 0}건`)

    const samplesData = allSamples || []

    // 샘플 데이터 처리
    const processedSamples = samplesData.map(sample => {
      // 만료일 계산 (회수완료 상태에서는 D-day 계산하지 않음)
      const outgoingDate = sample.outgoing_date ? new Date(sample.outgoing_date) : null
      const dueDate = outgoingDate ? new Date(outgoingDate.getTime() + 21 * 24 * 60 * 60 * 1000) : null
      const now = new Date()
      
      let daysRemaining = null
      let isOverdue = false
      
      // 회수완료 상태가 아닐 때만 D-day 계산
      if (dueDate && sample.status !== 'returned' && sample.status !== 'charged') {
        const diffTime = dueDate.getTime() - now.getTime()
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        isOverdue = daysRemaining < 0 && sample.status === 'shipped'
      }

      return {
        id: sample.id,
        sample_number: sample.sample_number,
        customer_id: sample.customer_id,
        customer_name: sample.customer_name,
        product_id: sample.product_id,
        product_name: sample.product_name,
        product_options: sample.product_options,
        quantity: sample.quantity,
        outgoing_date: sample.outgoing_date,
        status: sample.status,
        charge_amount: sample.charge_amount,
        charge_method: sample.charge_method,
        notes: sample.notes,
        created_at: sample.created_at,
        updated_at: sample.updated_at,
        sample_type: sample.sample_type,
        due_date: dueDate?.toISOString() || null,
        return_date: sample.return_date,
        charge_date: sample.charge_date,
        delivery_address: sample.delivery_address,
        tracking_number: sample.tracking_number,
        admin_notes: sample.admin_notes,
        approved_at: sample.approved_at,
        shipped_at: sample.shipped_at,
        delivered_at: sample.delivered_at,
        rejected_at: sample.rejected_at,
        days_remaining: daysRemaining,
        is_overdue: isOverdue
      }
    })

    // 그룹화된 샘플 (업체별 명세서용)
    const groupedSamples = processedSamples.reduce((acc: any, sample: any) => {
      const groupNumber = sample.sample_number.replace(/-\d{2}$/, '')
      
      if (!acc[groupNumber]) {
        acc[groupNumber] = {
          id: groupNumber,
          sample_number: groupNumber,
          customer_id: sample.customer_id,
          customer_name: sample.customer_name,
          status: sample.status,
          outgoing_date: sample.outgoing_date,
          due_date: sample.due_date,
          days_remaining: sample.days_remaining,
          is_overdue: sample.is_overdue,
          tracking_number: sample.tracking_number,
          admin_notes: sample.admin_notes,
          created_at: sample.created_at,
          updated_at: sample.updated_at,
          items: [],
          total_quantity: 0,
          total_amount: 0
        }
      }
      
      // product_options에서 색상과 사이즈 파싱
      const parseOptions = (options: string) => {
        if (!options) return { color: '', size: '' }
        const colorMatch = options.match(/색상:\s*([^,]+)/);
        const sizeMatch = options.match(/사이즈:\s*([^,]+)/);
        return {
          color: colorMatch ? colorMatch[1].trim() : '',
          size: sizeMatch ? sizeMatch[1].trim() : ''
        };
      };

      const parsedOptions = parseOptions(sample.product_options || '')

      acc[groupNumber].items.push({
        product_id: sample.product_id,
        product_name: sample.product_name,
        product_options: sample.product_options,
        color: parsedOptions.color,
        size: parsedOptions.size,
        quantity: sample.quantity,
        unit_price: sample.charge_amount || 0,
        total_price: (sample.charge_amount || 0) * sample.quantity
      })
      
      acc[groupNumber].total_quantity += sample.quantity
      acc[groupNumber].total_amount += (sample.charge_amount || 0) * sample.quantity
      
      return acc
    }, {})

    const groupedStatements = Object.values(groupedSamples)

    // 통계 계산
    const stats = {
      shipped: processedSamples.filter(s => s.status === 'shipped').length,
      returned: processedSamples.filter(s => s.status === 'returned').length,
      charged: processedSamples.filter(s => s.status === 'charged').length
    }

    const totalPages = Math.ceil(groupedStatements.length / limit)

    return NextResponse.json({
      success: true,
      data: {
        statements: groupedStatements,
        pagination: {
          page,
          limit,
          total: groupedStatements.length,
          totalPages
        },
        stats
      }
    })

  } catch (error) {
    console.error('샘플 명세서 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// POST - 샘플 명세서 상태 일괄 업데이트
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { action, sampleIds } = await request.json()

    if (!action || !sampleIds || !Array.isArray(sampleIds)) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 })
    }

    let updateData: any = {}
    let successMessage = ''

    switch (action) {
      case 'mark_shipped':
        updateData = {
          status: 'shipped',
          outgoing_date: getKoreaTime()
        }
        successMessage = '출고완료 처리되었습니다.'
        break
      
      case 'mark_returned':
        updateData = {
          status: 'returned'
        }
        successMessage = '회수완료 처리되었습니다.'
        break
      
      case 'mark_charged':
        updateData = {
          status: 'charged',
          charge_amount: 30000 // 기본 샘플 결제 금액
        }
        successMessage = '샘플결제 처리되었습니다.'
        break
      
      default:
        return NextResponse.json({
          success: false,
          error: '유효하지 않은 액션입니다.'
        }, { status: 400 })
    }

    // 선택된 샘플들 상태 업데이트
    const { error: updateError } = await supabase
      .from('samples')
      .update({
        ...updateData,
        updated_at: getKoreaTime()
      })
      .in('id', sampleIds)

    if (updateError) {
      console.error('Sample status update error:', updateError)
      return NextResponse.json({
        success: false,
        error: '샘플 상태 업데이트에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `${sampleIds.length}개 샘플이 ${successMessage}`,
      data: {
        action,
        updatedCount: sampleIds.length
      }
    })

  } catch (error) {
    console.error('Sample statements bulk update error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 샘플 명세서 일괄 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { action, sample_ids, data } = body

    if (!action || !sample_ids || !Array.isArray(sample_ids) || sample_ids.length === 0) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 })
    }

    console.log(`🔄 샘플 일괄 업데이트 시작: ${action}, 대상 ${sample_ids.length}개`)
    console.log('📥 받은 sample_ids:', sample_ids)

    // 🎯 sample_number로 조회 (그룹 번호 또는 개별 번호 처리)
    let samples: any[] = []
    
    // 각 sample_id에 대해 그룹 번호인지 개별 번호인지 확인
    for (const sampleId of sample_ids) {
      if (sampleId.endsWith('-01') || sampleId.endsWith('-02') || sampleId.match(/-\d{2}$/)) {
        // 개별 번호인 경우 (SP-20250714-906413ZTHM-01)
        const { data: individualSamples, error: individualError } = await supabase
          .from('samples')
          .select('*')
          .eq('sample_number', sampleId)
        
        if (individualError) {
          console.error('개별 샘플 조회 오류:', individualError)
          continue
        }
        
        if (individualSamples) {
          samples.push(...individualSamples)
        }
      } else {
        // 그룹 번호인 경우 (SP-20250714-906413ZTHM) - 해당 그룹의 모든 샘플 찾기
        const { data: groupSamples, error: groupError } = await supabase
          .from('samples')
          .select('*')
          .like('sample_number', `${sampleId}%`)
        
        if (groupError) {
          console.error('그룹 샘플 조회 오류:', groupError)
          continue
        }
        
        if (groupSamples) {
          samples.push(...groupSamples)
        }
      }
    }
    
    console.log(`🔍 조회된 샘플 수: ${samples.length}개`)
    
    if (samples.length === 0) {
      return NextResponse.json({
        success: false,
        error: '해당 샘플을 찾을 수 없습니다.'
      }, { status: 404 })
    }
    
    // 실제 sample_number 목록 추출
    const actualSampleNumbers = samples.map(sample => sample.sample_number)
    console.log('🎯 실제 업데이트할 sample_numbers:', actualSampleNumbers)
    
    // 이미 조회 완료했으므로 바로 진행

    let updateData: any = {
      updated_at: getKoreaTime()
    }

    // 액션에 따른 업데이트 데이터 설정
    switch (action) {
      case 'mark_shipped':
        updateData.status = 'shipped'
        updateData.shipped_at = getKoreaTime()
        updateData.outgoing_date = getKoreaTime()
        // 🎯 D-21 디데이 설정 (21일 후)
        updateData.due_date = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString()
        if (data?.tracking_number) {
          updateData.tracking_number = data.tracking_number
        }
        
        console.log(`📦 출고 처리: D-21 디데이 = ${updateData.due_date}`)
        break

      case 'mark_returned':
        updateData.status = 'returned'
        updateData.return_date = getKoreaTime()
        updateData.delivered_at = getKoreaTime()
        break

      case 'mark_charged':
        updateData.status = 'charged'
        updateData.charge_date = getKoreaTime()
        updateData.delivered_at = getKoreaTime()
        if (data?.charge_amount) {
          updateData.charge_amount = data.charge_amount
        }
        if (data?.charge_method) {
          updateData.charge_method = data.charge_method
        }
        break

      default:
        return NextResponse.json({
          success: false,
          error: '지원하지 않는 액션입니다.'
        }, { status: 400 })
    }

    // 일괄 업데이트 실행 (실제 sample_number 목록 사용)
    const { data: updatedSamples, error: updateError } = await supabase
      .from('samples')
      .update(updateData)
      .in('sample_number', actualSampleNumbers)
      .select()

    if (updateError) {
      console.error('Sample bulk update error:', updateError)
      return NextResponse.json({
        success: false,
        error: '샘플 일괄 업데이트에 실패했습니다.'
      }, { status: 500 })
    }

    console.log(`✅ 샘플 상태 업데이트 완료: ${updatedSamples.length}개`)

    // 💡 샘플은 재고 연동하지 않음 (재고 차감 및 이력 기록 제거)
    // 샘플 출고/회수는 팀장님이 별도 수동 관리
    console.log('📝 샘플 상태 변경 완료 - 재고 차감 없음')

    console.log(`🎉 샘플 일괄 업데이트 완료: ${updatedSamples.length}개`)

    return NextResponse.json({
      success: true,
      message: `${updatedSamples.length}개의 샘플이 업데이트되었습니다.`,
      data: updatedSamples
    })

  } catch (error) {
    console.error('Sample bulk update API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 