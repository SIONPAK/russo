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

    // 간단한 샘플 데이터 조회
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
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 상태 필터링
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // 검색 필터링
    if (search) {
      query = query.or(`sample_number.ilike.%${search}%,customer_name.ilike.%${search}%,product_name.ilike.%${search}%`)
    }

    const { data: samples, error, count } = await query

    if (error) {
      console.error('샘플 명세서 조회 오류:', error)
      return NextResponse.json({
        success: false,
        error: '샘플 명세서 조회에 실패했습니다.'
      }, { status: 500 })
    }

    console.log(`✅ 샘플 명세서 조회 완료: ${samples?.length || 0}건`)

    const samplesData = samples || []

    // 샘플 데이터 처리
    const processedSamples = samplesData.map(sample => {
      // 만료일 계산
      const outgoingDate = sample.outgoing_date ? new Date(sample.outgoing_date) : null
      const dueDate = outgoingDate ? new Date(outgoingDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null
      const now = new Date()
      
      let daysRemaining = null
      let isOverdue = false
      
      if (dueDate) {
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
      
      acc[groupNumber].items.push({
        product_id: sample.product_id,
        product_name: sample.product_name,
        product_options: sample.product_options,
        color: sample.product_options?.color || '',
        size: sample.product_options?.size || '',
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

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: {
        statements: groupedStatements,
        pagination: {
          page,
          limit,
          total: count || 0,
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