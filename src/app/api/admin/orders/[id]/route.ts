import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// GET - 개별 주문 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 주문 상세 정보 조회
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          id,
          company_name,
          representative_name,
          phone,
          email,
          business_number,
          address,
          customer_grade
        ),
        order_items (
          id,
          product_id,
          product_name,
          color,
          size,
          quantity,
          shipped_quantity,
          unit_price,
          total_price,
          products (
            id,
            name,
            code,
            stock_quantity,
            inventory_options,
            images:product_images!product_images_product_id_fkey (
              image_url,
              is_main
            )
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error || !order) {
      return NextResponse.json({
        success: false,
        error: '주문을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 재고 정보 추가
    const orderWithStock = {
      ...order,
      order_items: order.order_items?.map((item: any) => ({
        ...item,
        available_stock: getAvailableStock(item.products, item.color, item.size),
        allocated_quantity: item.shipped_quantity || 0,
        allocation_status: getItemAllocationStatus(item)
      })) || []
    }

    return NextResponse.json({
      success: true,
      data: orderWithStock
    })

  } catch (error) {
    console.error('주문 상세 조회 오류:', error)
    return NextResponse.json({
      success: false,
      error: '주문 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 재고 계산 함수
function getAvailableStock(product: any, color?: string, size?: string): number {
  if (!product || !product.inventory_options) {
    return product?.stock_quantity || 0
  }

  try {
    const inventoryOptions = typeof product.inventory_options === 'string' 
      ? JSON.parse(product.inventory_options) 
      : product.inventory_options

    if (!Array.isArray(inventoryOptions)) {
      return product.stock_quantity || 0
    }

    const matchingOption = inventoryOptions.find((option: any) => 
      option.color === color && option.size === size
    )

    return matchingOption?.stock || 0
  } catch (error) {
    console.error('재고 정보 파싱 오류:', error)
    return product.stock_quantity || 0
  }
}

// 아이템 할당 상태 계산
function getItemAllocationStatus(item: any): string {
  const availableStock = getAvailableStock(item.products, item.color, item.size)
  const requiredQuantity = item.quantity
  const allocatedQuantity = item.shipped_quantity || 0

  if (allocatedQuantity >= requiredQuantity) {
    return 'allocated'
  } else if (availableStock >= requiredQuantity) {
    return 'available'
  } else {
    return 'insufficient'
  }
} 