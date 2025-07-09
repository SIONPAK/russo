import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    
    if (!date) {
      return NextResponse.json({ error: '날짜가 필요합니다.' }, { status: 400 })
    }

    const supabase = await createClient()

    // 선택된 날짜의 출고 완료된 주문들 조회
    const startDate = `${date}T00:00:00.000Z`
    const endDate = `${date}T23:59:59.999Z`

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        shipped_at,
        total_amount,
        shipping_fee,
        status,
        tracking_number,
        users!orders_user_id_fkey(
          id,
          company_name,
          representative_name,
          phone,
          email
        ),
        order_items!inner(
          id,
          product_name,
          color,
          size,
          quantity,
          shipped_quantity,
          unit_price,
          products!inner(
            id,
            name,
            code
          )
        )
      `)
      .eq('status', 'shipped')
      .gte('shipped_at', startDate)
      .lte('shipped_at', endDate)
      .order('shipped_at', { ascending: false })

    if (error) {
      console.error('출고 내역 조회 오류:', error)
      return NextResponse.json({ error: '출고 내역 조회 중 오류가 발생했습니다.' }, { status: 500 })
    }

    // 출고 수량이 있는 아이템만 필터링
    const processedOrders = orders?.map(order => ({
      ...order,
      order_items: order.order_items?.filter((item: any) => item.shipped_quantity > 0)
    })).filter(order => order.order_items?.length > 0) || []

    return NextResponse.json({
      success: true,
      data: {
        orders: processedOrders,
        total: processedOrders.length,
        date: date
      }
    })

  } catch (error) {
    console.error('출고 내역 조회 오류:', error)
    return NextResponse.json({ error: '출고 내역 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
} 