import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// GET - 샘플 명세서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    
    const offset = (page - 1) * limit

    // 샘플 명세서 데이터 조회 (명세서별로 그룹화)
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

    // 페이지네이션
    query = query.range(offset, offset + limit - 1)

    const { data: samples, error } = await query

    if (error) {
      console.error('Sample statements query error:', error)
      return NextResponse.json({
        success: false,
        error: '샘플 명세서 조회에 실패했습니다.'
      }, { status: 500 })
    }

    // 전체 개수 조회
    let countQuery = supabase
      .from('samples')
      .select('*', { count: 'exact', head: true })

    if (status && status !== 'all') {
      countQuery = countQuery.eq('status', status)
    }

    if (search) {
      countQuery = countQuery.or(`sample_number.ilike.%${search}%,customer_name.ilike.%${search}%,product_name.ilike.%${search}%`)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('Sample statements count error:', countError)
      return NextResponse.json({
        success: false,
        error: '샘플 명세서 개수 조회에 실패했습니다.'
      }, { status: 500 })
    }

    // 통계 데이터 계산
    const { data: allSamples, error: statsError } = await supabase
      .from('samples')
      .select('status, charge_amount, outgoing_date, due_date')

    if (statsError) {
      console.error('Sample statistics error:', statsError)
      return NextResponse.json({
        success: false,
        error: '샘플 통계 조회에 실패했습니다.'
      }, { status: 500 })
    }

    // 통계 계산
    const stats = {
      shipped: allSamples.filter(s => s.status === 'shipped').length,
      returned: allSamples.filter(s => s.status === 'returned').length,
      charged: allSamples.filter(s => s.status === 'charged').length,
      overdue: allSamples.filter(s => {
        if (!s.outgoing_date || !s.due_date) return false
        const now = new Date()
        const dueDate = new Date(s.due_date)
        return now > dueDate && s.status === 'shipped'
      }).length
    }

    // 개별 샘플 데이터를 그대로 반환 (그룹화하지 않음)
    const statements = samples.map((sample: any) => ({
      id: sample.id,
      sample_number: sample.sample_number,
      customer_id: sample.customer_id,
      customer_name: sample.customer_name,
      product_id: sample.product_id,
      product_name: sample.product_name,
      product_options: sample.product_options,
      color: sample.product_options?.split(',')[0]?.replace('색상:', '').trim() || '-',
      size: sample.product_options?.split(',')[1]?.replace('사이즈:', '').trim() || '-',
      quantity: sample.quantity,
      unit_price: sample.charge_amount || 0,
      total_price: (sample.charge_amount || 0) * sample.quantity,
      status: sample.status,
      outgoing_date: sample.outgoing_date,
      due_date: sample.due_date,
      days_remaining: sample.due_date ? Math.ceil((new Date(sample.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null,
      is_overdue: sample.due_date ? new Date() > new Date(sample.due_date) : false,
      tracking_number: sample.tracking_number,
      admin_notes: sample.admin_notes,
      created_at: sample.created_at,
      updated_at: sample.updated_at
    }))

    return NextResponse.json({
      success: true,
      data: {
        statements,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
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
          outgoing_date: new Date().toISOString()
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
        updated_at: new Date().toISOString()
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
      updated_at: new Date().toISOString()
    }

    // 액션에 따른 업데이트 데이터 설정
    switch (action) {
      case 'mark_shipped':
        updateData.status = 'shipped'
        updateData.shipped_at = new Date().toISOString()
        updateData.outgoing_date = new Date().toISOString()
        updateData.due_date = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString() // 21일 후
        if (data?.tracking_number) {
          updateData.tracking_number = data.tracking_number
        }
        break

      case 'mark_returned':
        updateData.status = 'returned'
        updateData.return_date = new Date().toISOString()
        updateData.delivered_at = new Date().toISOString()
        break

      case 'mark_charged':
        updateData.status = 'charged'
        updateData.charge_date = new Date().toISOString()
        updateData.delivered_at = new Date().toISOString()
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