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

    // 샘플 데이터 조회 (전체 조회 후 그룹화)
    let query = supabase
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
      query = query.eq('status', status)
    }

    // 검색 필터링
    if (search) {
      query = query.or(`sample_number.ilike.%${search}%,customer_name.ilike.%${search}%,product_name.ilike.%${search}%`)
    }

    // 배치 처리로 전체 데이터 조회
    console.log('📦 샘플 명세서 배치 조회 시작')
    const allSamplesData: any[] = []
    let batchOffset = 0
    const batchSize = 1000
    let hasMore = true
    let batchCount = 0

    while (hasMore && batchCount < 100) { // 최대 100 배치 (10만건 제한)
      const { data: batchData, error: batchError } = await query
        .range(batchOffset, batchOffset + batchSize - 1)

      if (batchError) {
        console.error(`배치 ${batchCount + 1} 조회 오류:`, batchError)
        return NextResponse.json({
          success: false,
          error: '샘플 명세서 조회에 실패했습니다.'
        }, { status: 500 })
      }

      if (!batchData || batchData.length === 0) {
        hasMore = false
        break
      }

      allSamplesData.push(...batchData)
      batchOffset += batchSize
      batchCount++

      console.log(`📦 배치 ${batchCount}: ${batchData.length}건 조회 (누적: ${allSamplesData.length}건)`)

      // 배치 크기보다 적게 나오면 마지막 배치
      if (batchData.length < batchSize) {
        hasMore = false
      }
    }

    console.log(`✅ 샘플 명세서 배치 조회 완료: 총 ${allSamplesData.length}건 (${batchCount}개 배치)`)
    const samples = allSamplesData

    // 샘플 번호별로 그룹화 (업체별 명세서)
    const groupedSamples = samples.reduce((acc: any, sample: any) => {
      // 개별 번호에서 그룹 번호 추출 (SP-20250706-XQ3H-01 -> SP-20250706-XQ3H)
      const groupNumber = sample.sample_number.replace(/-\d{2}$/, '')
      const key = groupNumber
      
      if (!acc[key]) {
        acc[key] = {
          id: sample.id, // 대표 ID
          sample_number: groupNumber, // 그룹 번호
          customer_id: sample.customer_id,
          customer_name: sample.customer_name,
          status: sample.status,
          outgoing_date: sample.outgoing_date,
          due_date: sample.due_date,
          delivery_address: sample.delivery_address,
          tracking_number: sample.tracking_number,
          admin_notes: sample.admin_notes,
          created_at: sample.created_at,
          updated_at: sample.updated_at,
          sample_type: sample.sample_type,
          items: [],
          total_quantity: 0,
          total_amount: 0
        }
      }

      // 아이템 추가
      acc[key].items.push({
        id: sample.id,
        product_id: sample.product_id,
        product_name: sample.product_name,
        product_options: sample.product_options,
        color: sample.product_options?.split(',')[0]?.replace('색상:', '').trim() || '-',
        size: sample.product_options?.split(',')[1]?.replace('사이즈:', '').trim() || '-',
        quantity: sample.quantity,
        unit_price: sample.charge_amount || 0,
        total_price: (sample.charge_amount || 0) * sample.quantity
      })

      // 총 수량 및 금액 계산
      acc[key].total_quantity += sample.quantity
      acc[key].total_amount += (sample.charge_amount || 0) * sample.quantity

      return acc
    }, {})

    // 그룹화된 샘플을 배열로 변환
    const groupedStatements = Object.values(groupedSamples).map((group: any) => ({
      ...group,
      days_remaining: group.due_date ? Math.ceil((new Date(group.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null,
      is_overdue: group.due_date ? new Date() > new Date(group.due_date) : false,
      // 샘플명 자동 생성 (1차샘플, 2차샘플 등)
      sample_name: `${group.items.length}개 상품 샘플`
    }))

    // 페이지네이션 적용
    const paginatedStatements = groupedStatements.slice(offset, offset + limit)

    // 통계 데이터 계산
    const { data: allSamples, error: statsError } = await supabase
      .from('samples')
      .select('sample_number, status, charge_amount, outgoing_date, due_date')

    if (statsError) {
      console.error('Sample statistics error:', statsError)
      return NextResponse.json({
        success: false,
        error: '샘플 통계 조회에 실패했습니다.'
      }, { status: 500 })
    }

    // 통계 계산 (명세서 기준) - 그룹 번호로 계산
    const uniqueSampleNumbers = [...new Set(allSamples.map(s => s.sample_number.replace(/-\d{2}$/, '')))]
    const stats = {
      shipped: uniqueSampleNumbers.filter(sn => {
        const samplesWithSN = allSamples.filter(s => s.sample_number.replace(/-\d{2}$/, '') === sn)
        return samplesWithSN.every(s => s.status === 'shipped')
      }).length,
      returned: uniqueSampleNumbers.filter(sn => {
        const samplesWithSN = allSamples.filter(s => s.sample_number.replace(/-\d{2}$/, '') === sn)
        return samplesWithSN.every(s => s.status === 'returned')
      }).length,
      charged: uniqueSampleNumbers.filter(sn => {
        const samplesWithSN = allSamples.filter(s => s.sample_number.replace(/-\d{2}$/, '') === sn)
        return samplesWithSN.every(s => s.status === 'charged')
      }).length,
      overdue: uniqueSampleNumbers.filter(sn => {
        const samplesWithSN = allSamples.filter(s => s.sample_number.replace(/-\d{2}$/, '') === sn)
        return samplesWithSN.some(s => {
          if (!s.outgoing_date || !s.due_date) return false
          const now = new Date()
          const dueDate = new Date(s.due_date)
          return now > dueDate && s.status === 'shipped'
        })
      }).length
    }

    return NextResponse.json({
      success: true,
      data: {
        statements: paginatedStatements,
        pagination: {
          page,
          limit,
          total: groupedStatements.length,
          totalPages: Math.ceil(groupedStatements.length / limit)
        },
        stats
      }
    })

  } catch (error) {
    console.error('Sample statements API error:', error)
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

    let updateData: any = {
      updated_at: getKoreaTime()
    }

    // 액션에 따른 업데이트 데이터 설정
    switch (action) {
      case 'mark_shipped':
        updateData.status = 'shipped'
        updateData.shipped_at = getKoreaTime()
        updateData.outgoing_date = getKoreaTime()
        updateData.due_date = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString() // 21일 후
        if (data?.tracking_number) {
          updateData.tracking_number = data.tracking_number
        }
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

    // 일괄 업데이트 실행
    const { data: updatedSamples, error: updateError } = await supabase
      .from('samples')
      .update(updateData)
      .in('id', sample_ids)
      .select()

    if (updateError) {
      console.error('Sample bulk update error:', updateError)
      return NextResponse.json({
        success: false,
        error: '샘플 일괄 업데이트에 실패했습니다.'
      }, { status: 500 })
    }

    // 재고 변동 이력 기록 (회수완료 시)
    if (action === 'mark_returned' && updatedSamples.length > 0) {
      try {
        const stockMovements = updatedSamples.map(sample => ({
          product_id: sample.product_id,
          movement_type: 'sample_in',
          quantity: sample.quantity, // 양수 (입고)
          reference_id: sample.id,
          reference_type: 'sample',
          notes: `샘플 회수: ${sample.sample_number} (촬영용 샘플 반납)`,
          created_at: getKoreaTime()
        }))

        const { error: stockError } = await supabase
          .from('stock_movements')
          .insert(stockMovements)

        if (stockError) {
          console.error('Stock movements insert error:', stockError)
          // 재고 이력 실패는 경고만 하고 계속 진행
        }

        // 상품 재고 수량도 업데이트
        for (const sample of updatedSamples) {
          // 현재 재고 조회
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', sample.product_id)
            .single()

          if (productError) {
            console.error(`Product fetch error for ${sample.product_id}:`, productError)
            continue
          }

          // 재고 증가
          const newStockQuantity = (product.stock_quantity || 0) + sample.quantity
          const { error: stockUpdateError } = await supabase
            .from('products')
            .update({ stock_quantity: newStockQuantity })
            .eq('id', sample.product_id)

          if (stockUpdateError) {
            console.error(`Product stock update error for ${sample.product_id}:`, stockUpdateError)
          }
        }
      } catch (error) {
        console.error('Stock movement recording error:', error)
        // 재고 이력 실패는 경고만 하고 계속 진행
      }
    }

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