import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// PUT - 출고 수량 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { items } = await request.json()

    // 각 주문 아이템의 출고 수량 업데이트
    const updatePromises = items.map(async (item: { id: string; shipped_quantity: number }) => {
      const { error } = await supabase
        .from('order_items')
        .update({ shipped_quantity: item.shipped_quantity })
        .eq('id', item.id)

      if (error) {
        console.error('Order item update error:', error)
        throw error
      }
    })

    await Promise.all(updatePromises)

    // 주문 상태를 shipped로 업데이트 (아직 shipped가 아닌 경우)
    const { data: order } = await supabase
      .from('orders')
      .select('status')
      .eq('id', id)
      .single()

    if (order && order.status !== 'shipped') {
      await supabase
        .from('orders')
        .update({ 
          status: 'shipped',
          shipped_at: new Date().toISOString()
        })
        .eq('id', id)
    }

    return NextResponse.json({
      success: true,
      message: '출고 수량이 성공적으로 업데이트되었습니다.'
    })

  } catch (error) {
    console.error('Shipping quantity update error:', error)
    return NextResponse.json({
      success: false,
      error: '출고 수량 업데이트에 실패했습니다.'
    }, { status: 500 })
  }
}
