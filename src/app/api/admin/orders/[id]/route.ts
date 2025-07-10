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
    console.log(`🔍 [개별 주문] 기본 재고: ${product?.stock_quantity || 0}`)
    return product?.stock_quantity || 0
  }

  try {
    const inventoryOptions = typeof product.inventory_options === 'string' 
      ? JSON.parse(product.inventory_options) 
      : product.inventory_options

    if (!Array.isArray(inventoryOptions)) {
      console.log(`🔍 [개별 주문] 옵션 배열 아님, 기본 재고: ${product.stock_quantity || 0}`)
      return product.stock_quantity || 0
    }

    console.log(`🔍 [개별 주문] 재고 계산 시작 - 상품 ID: ${product.id}, 색상: ${color || 'N/A'}, 사이즈: ${size || 'N/A'}`)
    console.log(`🔍 [개별 주문] inventory_options:`, JSON.stringify(inventoryOptions, null, 2))

    const matchingOption = inventoryOptions.find((option: any) => 
      option.color === color && option.size === size
    )

    console.log(`🔍 [개별 주문] 매칭 옵션:`, matchingOption)

    if (matchingOption) {
      // 🔧 새로운 구조 우선 확인
      if (matchingOption.physical_stock !== undefined && matchingOption.allocated_stock !== undefined) {
        const physicalStock = matchingOption.physical_stock || 0
        const allocatedStock = matchingOption.allocated_stock || 0
        const availableStock = Math.max(0, physicalStock - allocatedStock)
        console.log(`🔍 [개별 주문] 새로운 구조 - 물리적재고: ${physicalStock}, 할당재고: ${allocatedStock}, 가용재고: ${availableStock}`)
        return availableStock
      } else if (matchingOption.stock_quantity !== undefined) {
        // 기존 구조: stock_quantity 사용
        const availableStock = matchingOption.stock_quantity || 0
        console.log(`🔍 [개별 주문] 기존 구조 - stock_quantity: ${availableStock}`)
        return availableStock
      } else {
        console.log(`🔍 [개별 주문] 오류 - 재고 필드를 찾을 수 없음`)
        return 0
      }
    } else {
      console.log(`🔍 [개별 주문] 오류 - 매칭되는 옵션을 찾을 수 없음`)
      return 0
    }
    
  } catch (error) {
    console.error('🔍 [개별 주문] 재고 정보 파싱 오류:', error)
    return product.stock_quantity || 0
  }
}

// 아이템 할당 상태 계산
function getItemAllocationStatus(item: any): string {
  const availableStock = getAvailableStock(item.products, item.color, item.size)
  const alreadyShipped = item.shipped_quantity || 0
  const remainingQuantity = item.quantity - alreadyShipped

  // 이미 전량 할당된 경우
  if (alreadyShipped >= item.quantity) {
    return 'allocated'
  }

  // 남은 수량을 모두 할당할 수 있는 경우
  if (availableStock >= remainingQuantity) {
    return 'allocated'
  } else if (availableStock > 0) {
    return 'partial'
  } else {
    return 'insufficient'
  }
} 