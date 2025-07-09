import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// shipped_quantity 디버깅 API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // 최근 10개 주문의 order_items 데이터 조회
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        shipped_at,
        order_items (
          id,
          product_name,
          color,
          size,
          quantity,
          shipped_quantity,
          allocated_quantity,
          unit_price
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Debug query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 데이터 분석
    const analysis = orders?.map(order => ({
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      shippedAt: order.shipped_at,
      items: order.order_items?.map(item => ({
        productName: item.product_name,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        shippedQuantity: item.shipped_quantity,
        allocatedQuantity: item.allocated_quantity,
        unitPrice: item.unit_price,
        // 실제 사용될 수량
        actualQuantity: item.shipped_quantity || item.quantity || 0,
        hasShippedQuantity: item.shipped_quantity !== null && item.shipped_quantity !== undefined,
        shippedQuantityValue: item.shipped_quantity
      }))
    }))

    // 통계
    const stats = {
      totalOrders: orders?.length || 0,
      totalItems: orders?.reduce((sum, order) => sum + (order.order_items?.length || 0), 0) || 0,
      itemsWithShippedQuantity: 0,
      itemsWithoutShippedQuantity: 0,
      itemsWithZeroShippedQuantity: 0
    }

    orders?.forEach(order => {
      order.order_items?.forEach(item => {
        if (item.shipped_quantity !== null && item.shipped_quantity !== undefined) {
          stats.itemsWithShippedQuantity++
          if (item.shipped_quantity === 0) {
            stats.itemsWithZeroShippedQuantity++
          }
        } else {
          stats.itemsWithoutShippedQuantity++
        }
      })
    })

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        stats,
        message: 'shipped_quantity 필드 분석 완료'
      }
    })

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '디버깅 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 