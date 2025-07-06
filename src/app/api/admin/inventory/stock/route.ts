import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const color = searchParams.get('color')
    const size = searchParams.get('size')

    if (!productId || !color || !size) {
      return NextResponse.json({ 
        success: false, 
        error: '필수 파라미터가 누락되었습니다.' 
      }, { status: 400 })
    }

    // 권한 확인 제거 - 일반 클라이언트 사용

    // 상품 정보 조회
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, stock_quantity, inventory_options')
      .eq('id', productId)
      .single()

    if (productError || !product) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    let stockQuantity = 0
    let reservedQuantity = 0

    if (product.inventory_options && Array.isArray(product.inventory_options)) {
      // 옵션별 재고 조회
      const option = product.inventory_options.find(
        (opt: any) => opt.color === color && opt.size === size
      )
      
      if (option) {
        stockQuantity = option.stock_quantity || 0
      }
    } else {
      // 단일 재고
      stockQuantity = product.stock_quantity || 0
    }

    // 예약 재고 계산 (주문되었지만 아직 출고되지 않은 수량)
    const { data: reservedItems } = await supabase
      .from('order_items')
      .select(`
        quantity, 
        shipped_quantity,
        orders!order_items_order_id_fkey (
          status
        )
      `)
      .eq('product_id', productId)
      .eq('color', color)
      .eq('size', size)

    if (reservedItems && reservedItems.length > 0) {
      reservedQuantity = reservedItems.reduce((sum: number, item: any) => {
        const order = Array.isArray(item.orders) ? item.orders[0] : item.orders
        const isPendingOrder = order && ['pending', 'confirmed', 'processing'].includes(order.status)
        
        if (isPendingOrder) {
          const pendingQuantity = item.quantity - (item.shipped_quantity || 0)
          return sum + Math.max(0, pendingQuantity)
        }
        return sum
      }, 0)
    }

    const availableStock = Math.max(0, stockQuantity - reservedQuantity)

    return NextResponse.json({
      success: true,
      data: {
        stock: stockQuantity,
        reserved: reservedQuantity,
        available: availableStock
      }
    })

  } catch (error) {
    console.error('Stock check error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '재고 조회 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 