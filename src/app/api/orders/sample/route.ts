import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// POST - 샘플 주문 생성 (기존 samples 테이블 사용)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { 
      user_id,
      product_id,
      quantity = 1,
      sample_type = 'photography', // 'photography' | 'sales'
      delivery_address,
      notes,
      product_options = ''
    } = body

    // 사용자 ID 확인
    if (!user_id) {
      return NextResponse.json({
        success: false,
        error: '사용자 정보가 필요합니다.'
      }, { status: 400 })
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, company_name, representative_name, mileage_balance')
      .eq('id', user_id)
      .single()

    if (userError || !userData) {
      return NextResponse.json({
        success: false,
        error: '사용자 정보를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 상품 정보 확인
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, price, stock_quantity, inventory_options')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 재고 확인 (옵션별 재고 고려)
    if (product.inventory_options && Array.isArray(product.inventory_options)) {
      // 옵션별 재고 관리인 경우 - 첫 번째 옵션 사용
      const firstOption = product.inventory_options[0]
      if (!firstOption || firstOption.stock_quantity < quantity) {
        return NextResponse.json({
          success: false,
          error: `재고가 부족합니다. 현재 재고: ${firstOption?.stock_quantity || 0}개`
        }, { status: 400 })
      }
    } else {
      // 일반 재고 관리인 경우
      if (product.stock_quantity < quantity) {
        return NextResponse.json({
          success: false,
          error: `재고가 부족합니다. 현재 재고: ${product.stock_quantity}개`
        }, { status: 400 })
      }
    }

    // 샘플 번호 생성 (SP-YYYYMMDD-XXXX)
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase()
    const sampleNumber = `SP-${dateStr}-${randomStr}`

    // 샘플 주문 생성 (samples 테이블 사용)
    const { data: sample, error: sampleError } = await supabase
      .from('samples')
      .insert({
        sample_number: sampleNumber,
        customer_id: user_id,
        customer_name: userData.company_name,
        product_id,
        product_name: product.name,
        product_options: product_options || `색상: 기본, 사이즈: 기본`,
        quantity,
        sample_type,
        charge_amount: 0, // 샘플 주문은 항상 0원 고정
        status: 'pending', // 관리자 승인 대기
        outgoing_date: null, // 배송 시에만 설정
        delivery_address: delivery_address, // 배송 주소
        notes: notes || null, // 기타 특이사항
        created_at: new Date().toISOString()
      })
      .select(`
        *,
        users!samples_customer_id_fkey (
          id,
          company_name,
          representative_name,
          email,
          phone
        ),
        products!samples_product_id_fkey (
          id,
          name,
          price,
          stock_quantity
        )
      `)
      .single()

    if (sampleError) {
      console.error('Sample creation error:', sampleError)
      return NextResponse.json({
        success: false,
        error: '샘플 주문 생성에 실패했습니다.'
      }, { status: 500 })
    }

    // 재고 차감
    if (product.inventory_options && Array.isArray(product.inventory_options)) {
      // 옵션별 재고 관리인 경우 - 첫 번째 옵션에서 차감
      const updatedOptions = product.inventory_options.map((option: any, index: number) => {
        if (index === 0) { // 첫 번째 옵션에서 차감
          return {
            ...option,
            stock_quantity: option.stock_quantity - quantity
          }
        }
        return option
      })

      const totalStock = updatedOptions.reduce((sum: number, option: any) => sum + option.stock_quantity, 0)

      const { error: stockError } = await supabase
        .from('products')
        .update({ 
          inventory_options: updatedOptions,
          stock_quantity: totalStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', product_id)

      if (stockError) {
        console.error('Stock update error:', stockError)
        // 샘플 주문 롤백
        await supabase.from('samples').delete().eq('id', sample.id)
        return NextResponse.json({
          success: false,
          error: '재고 업데이트에 실패했습니다.'
        }, { status: 500 })
      }
    } else {
      // 일반 재고 관리인 경우
      const { error: stockError } = await supabase
        .from('products')
        .update({ 
          stock_quantity: product.stock_quantity - quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', product_id)

      if (stockError) {
        console.error('Stock update error:', stockError)
        // 샘플 주문 롤백
        await supabase.from('samples').delete().eq('id', sample.id)
        return NextResponse.json({
          success: false,
          error: '재고 업데이트에 실패했습니다.'
        }, { status: 500 })
      }
    }

    // 재고 변동 이력 기록
    await supabase
      .from('stock_movements')
      .insert({
        product_id,
        movement_type: 'sample_out',
        quantity: -quantity,
        reason: `샘플 출고 (${sampleNumber})`,
        reference_id: sample.id,
        reference_type: 'sample',
        created_at: new Date().toISOString()
      })

    return NextResponse.json({
      success: true,
      data: sample,
      message: `샘플 주문이 접수되었습니다. 관리자 승인 후 발송됩니다.`
    })

  } catch (error) {
    console.error('Sample order API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// GET - 내 샘플 주문 조회 (samples 테이블 사용)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const userId = searchParams.get('userId') // URL 파라미터에서 userId 받기
    const status = searchParams.get('status') // 상태 필터 추가
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    const offset = (page - 1) * limit
    const supabase = await createClient()

    // userId가 제공되지 않은 경우 오류 반환
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '사용자 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, company_name, representative_name')
      .eq('id', userId)
      .single()

    if (userError || !userData) {
      console.error('User data fetch error:', userError)
      return NextResponse.json({
        success: false,
        error: '사용자 정보를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 내 샘플 주문 조회 (회사명 기준으로 필터링)
    let query = supabase
      .from('samples')
      .select(`
        *,
        products!samples_product_id_fkey (
          id,
          name,
          price
        )
      `, { count: 'exact' })
      .eq('customer_name', userData.company_name)

    // 상태 필터
    if (status) {
      query = query.eq('status', status)
    }

    // 날짜 범위 필터
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)
      query = query.lte('created_at', endDateTime.toISOString())
    }

    // 정렬 및 페이지네이션
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: samples, error, count } = await query

    if (error) {
      console.error('Samples fetch error:', error)
      return NextResponse.json({
        success: false,
        error: '샘플 주문 조회에 실패했습니다.'
      }, { status: 500 })
    }

    // 샘플 주문에 상태 정보 추가
    const samplesWithStatus = samples?.map(sample => {
      let statusText = ''
      let statusColor = ''
      
      switch (sample.status) {
        case 'pending':
          statusText = '승인 대기'
          statusColor = 'orange'
          break
        case 'approved':
          statusText = '승인됨'
          statusColor = 'blue'
          break
        case 'shipped':
          statusText = '발송됨'
          statusColor = 'green'
          break
        case 'delivered':
          statusText = '배송완료'
          statusColor = 'green'
          break
        case 'recovered':
          statusText = '반납완료'
          statusColor = 'gray'
          break
        case 'charged':
          statusText = '차감완료'
          statusColor = 'red'
          break
        case 'rejected':
          statusText = '거절됨'
          statusColor = 'red'
          break
        default:
          statusText = sample.status
          statusColor = 'gray'
      }

      // 만료일 계산
      const outgoingDate = sample.outgoing_date ? new Date(sample.outgoing_date) : null
      const dueDate = outgoingDate ? new Date(outgoingDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null

      return {
        ...sample,
        status_text: statusText,
        status_color: statusColor,
        due_date: dueDate?.toISOString()
      }
    })

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: samplesWithStatus || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
      }
    })

  } catch (error) {
    console.error('Samples fetch API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}
