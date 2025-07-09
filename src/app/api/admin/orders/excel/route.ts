import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'
import { getKoreaTime, getKoreaDate } from '@/shared/lib/utils'

// GET - 주문 목록 엑셀 다운로드
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    
    const supabase = createClient()

    let query = supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          id,
          company_name,
          representative_name,
          email,
          phone
        ),
        order_items!order_items_order_id_fkey (
          id,
          product_name,
          color,
          size,
          quantity,
          unit_price,
          total_price
        )
      `)

    // 검색 조건 적용
    if (search) {
      query = query.or(`order_number.ilike.%${search}%`)
    }

    // 상태 필터
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // 정렬
    query = query.order('created_at', { ascending: false })

    // 배치 처리로 전체 데이터 조회
    console.log('📦 주문 엑셀 배치 조회 시작')
    const allOrders: any[] = []
    let offset = 0
    const batchSize = 1000
    let hasMore = true
    let batchCount = 0

    while (hasMore && batchCount < 100) { // 최대 100 배치 (10만건 제한)
      const { data: batchData, error: batchError } = await query
        .range(offset, offset + batchSize - 1)

      if (batchError) {
        console.error(`배치 ${batchCount + 1} 조회 오류:`, batchError)
        return NextResponse.json({
          success: false,
          error: '주문 목록을 불러오는데 실패했습니다.'
        }, { status: 500 })
      }

      if (!batchData || batchData.length === 0) {
        hasMore = false
        break
      }

      allOrders.push(...batchData)
      offset += batchSize
      batchCount++

      console.log(`📦 배치 ${batchCount}: ${batchData.length}건 조회 (누적: ${allOrders.length}건)`)

      // 배치 크기보다 적게 나오면 마지막 배치
      if (batchData.length < batchSize) {
        hasMore = false
      }
    }

    console.log(`✅ 주문 엑셀 배치 조회 완료: 총 ${allOrders.length}건 (${batchCount}개 배치)`)
    const orders = allOrders

    // 엑셀 다운로드용 데이터 변환
    const excelData = orders?.map(order => ({
      '주문번호': order.order_number,
      '고객명': order.users?.company_name || '',
      '대표자명': order.users?.representative_name || '',
      '이메일': order.users?.email || '',
      '전화번호': order.users?.phone || '',
      '총금액': order.total_amount?.toLocaleString() + '원',
      '배송비': order.shipping_fee?.toLocaleString() + '원',
      '주문상태': getOrderStatusText(order.status),
      '배송지명': order.shipping_name,
      '배송지주소': order.shipping_address,
      '배송지전화': order.shipping_phone,
      '운송장번호': order.tracking_number || '',
      '택배사': order.courier || '',
      '주문일': new Date(order.created_at).toLocaleDateString('ko-KR'),
      '배송일': order.shipped_at ? new Date(order.shipped_at).toLocaleDateString('ko-KR') : '',
      '상품목록': order.order_items?.map((item: any) => 
        `${item.product_name}(${item.color}/${item.size}) x${item.quantity}`
      ).join(', ') || ''
    })) || []

    return NextResponse.json({
      success: true,
      data: excelData,
      filename: `주문목록_${getKoreaDate()}`
    })

  } catch (error) {
    console.error('Orders excel API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// POST - 운송장 번호 일괄 업로드
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    const { trackingData } = body

    if (!trackingData || !Array.isArray(trackingData)) {
      return NextResponse.json({
        success: false,
        error: '운송장 데이터가 필요합니다.'
      }, { status: 400 })
    }

    const results = []
    const errors = []

    for (const item of trackingData) {
      try {
        const { orderNumber, companyName, trackingNumber } = item
        
        console.log(`운송장 업로드 처리 중: ${JSON.stringify(item)}`)
        
        if (!orderNumber || !trackingNumber) {
          errors.push(`발주번호 또는 운송장번호가 누락됨: ${JSON.stringify(item)}`)
          continue
        }

        // 주문 존재 확인 (상호명도 함께 확인)
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select(`
            id, 
            order_number, 
            status,
            users!orders_user_id_fkey (
              company_name
            )
          `)
          .eq('order_number', orderNumber)
          .single()

        if (orderError || !order) {
          errors.push(`주문을 찾을 수 없음: ${orderNumber}`)
          continue
        }

        // 상호명 검증 (있을 경우만)
        const dbCompanyName = (order.users as any)?.company_name
        if (companyName && dbCompanyName !== companyName) {
          errors.push(`상호명이 일치하지 않음: ${orderNumber} (등록된 상호명: ${dbCompanyName}, 업로드된 상호명: ${companyName})`)
          continue
        }

        // 운송장 번호 업데이트
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            tracking_number: trackingNumber,
            status: order.status === 'confirmed' ? 'shipped' : order.status,
            shipped_at: order.status === 'confirmed' ? getKoreaTime() : null,
            updated_at: getKoreaTime()
          })
          .eq('id', order.id)

        if (updateError) {
          errors.push(`업데이트 실패: ${orderNumber} - ${updateError.message}`)
          continue
        }

        results.push({
          order_number: orderNumber,
          company_name: dbCompanyName,
          tracking_number: trackingNumber,
          success: true
        })

        console.log(`운송장 번호 업데이트 완료: ${orderNumber} (${dbCompanyName}) -> ${trackingNumber}`)

      } catch (error) {
        errors.push(`처리 중 오류: ${JSON.stringify(item)} - ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        total: trackingData.length,
        success: results.length,
        failed: errors.length,
        results,
        errors
      },
      message: `${results.length}건 성공, ${errors.length}건 실패`
    })

  } catch (error) {
    console.error('Tracking upload error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 주문 상태 텍스트 변환 함수
function getOrderStatusText(status: string): string {
  const statusMap: { [key: string]: string } = {
    'pending': '주문접수',
    'confirmed': '주문확인',
    'processing': '처리중',
    'shipped': '배송중',
    'delivered': '배송완료',
    'cancelled': '주문취소',
    'returned': '반품',
    'refunded': '환불완료'
  }
  
  return statusMap[status] || status
}