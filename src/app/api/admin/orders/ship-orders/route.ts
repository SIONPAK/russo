import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// POST - 운송장 번호 등록 및 출고처리
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { orderIds } = await request.json()

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '주문 ID가 필요합니다.'
      }, { status: 400 })
    }

    console.log('출고처리 시작:', { orderIds })

    // 주문 정보 조회
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          id,
          company_name,
          representative_name
        )
      `)
      .in('id', orderIds)

    if (orderError) {
      console.error('주문 조회 오류:', orderError)
      return NextResponse.json({
        success: false,
        error: `주문 조회 오류: ${orderError.message}`
      }, { status: 500 })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: '주문을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 운송장 번호 유효성 검사
    const ordersWithoutTracking = orders.filter(order => 
      !order.tracking_number || order.tracking_number.trim() === ''
    )

    if (ordersWithoutTracking.length > 0) {
      const orderNumbers = ordersWithoutTracking.map(order => order.order_number).join(', ')
      return NextResponse.json({
        success: false,
        error: `운송장 번호가 입력되지 않은 주문이 있습니다: ${orderNumbers}`
      }, { status: 400 })
    }

    // 명세서 확정 상태 확인
    const unconfirmedOrders = orders.filter(order => order.status !== 'confirmed')
    
    if (unconfirmedOrders.length > 0) {
      const orderNumbers = unconfirmedOrders.map(order => order.order_number).join(', ')
      return NextResponse.json({
        success: false,
        error: `명세서가 확정되지 않은 주문이 있습니다: ${orderNumbers}`
      }, { status: 400 })
    }

    const results = []
    const currentTime = getKoreaTime()
    
    for (const order of orders) {
      try {
        // 주문 상태를 shipped로 업데이트 (출고완료)
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ 
            status: 'shipped',
            shipped_at: currentTime,
            updated_at: currentTime
          })
          .eq('id', order.id)

        if (orderUpdateError) {
          console.error('주문 상태 업데이트 오류:', orderUpdateError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '주문 상태 업데이트 실패'
          })
          continue
        }

        results.push({
          orderId: order.id,
          orderNumber: order.order_number,
          success: true,
          trackingNumber: order.tracking_number,
          orderStatus: 'shipped',
          shippedAt: currentTime
        })

        console.log('출고처리 완료:', {
          orderNumber: order.order_number,
          trackingNumber: order.tracking_number,
          orderStatus: 'shipped'
        })

      } catch (error) {
        console.error('주문 출고처리 오류:', error)
        results.push({
          orderId: order.id,
          orderNumber: order.order_number,
          success: false,
          error: '출고처리 중 오류 발생'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      data: {
        total: results.length,
        success: successCount,
        failed: failCount,
        results: results
      },
      message: `${successCount}개 주문이 출고처리되었습니다.`
    })

  } catch (error) {
    console.error('출고처리 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '출고처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 