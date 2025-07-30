import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getCurrentKoreanDateTime } from '@/shared/lib/utils'

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
        allocated_quantity: item.shipped_quantity || 0, // 화면 표시용: 출고된 수량
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

// DELETE - 주문 삭제 (15:00 이전에만 가능)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 주문 정보 조회
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        status,
        user_id,
        order_items (
          id,
          product_id,
          product_name,
          color,
          size,
          quantity,
          shipped_quantity,
          allocated_quantity
        )
      `)
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({
        success: false,
        error: '주문을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 시간 제한 확인 (15:00 이전에만 삭제 가능)
    const koreanTimeString = getCurrentKoreanDateTime()
    const koreanTime = new Date(koreanTimeString)
    const currentHour = koreanTime.getHours()
    
    console.log('🕐 주문 삭제 시간 확인:', {
      koreanTimeString,
      currentHour,
      is3PMPassed: currentHour >= 15
    })
    
    if (currentHour >= 15) {
      return NextResponse.json({
        success: false,
        error: '오후 3시 이후에는 주문을 삭제할 수 없습니다.'
      }, { status: 400 })
    }

    // 이미 출고된 주문은 삭제 불가
    if (order.status === 'shipped' || order.status === 'delivered') {
      return NextResponse.json({
        success: false,
        error: '이미 출고된 주문은 삭제할 수 없습니다.'
      }, { status: 400 })
    }

    // 출고 수량이 있는 아이템들의 재고 복원
    for (const item of order.order_items) {
      if (item.shipped_quantity > 0) {
        const { error: restoreError } = await supabase
          .rpc('adjust_physical_stock', {
            p_product_id: item.product_id,
            p_color: item.color,
            p_size: item.size,
            p_quantity_change: item.shipped_quantity,
            p_reason: `주문 삭제로 인한 재고 복원 - ${order.order_number}`
          })

        if (restoreError) {
          console.error('재고 복원 실패:', restoreError)
        } else {
          console.log(`✅ 재고 복원: ${item.product_name} (${item.color}/${item.size}) ${item.shipped_quantity}개`)
        }
      }
    }

    // 주문 아이템 삭제
    const { error: deleteItemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', id)

    if (deleteItemsError) {
      console.error('주문 아이템 삭제 오류:', deleteItemsError)
      return NextResponse.json({
        success: false,
        error: '주문 아이템 삭제에 실패했습니다.'
      }, { status: 500 })
    }

    // 주문 삭제
    const { error: deleteOrderError } = await supabase
      .from('orders')
      .delete()
      .eq('id', id)

    if (deleteOrderError) {
      console.error('주문 삭제 오류:', deleteOrderError)
      return NextResponse.json({
        success: false,
        error: '주문 삭제에 실패했습니다.'
      }, { status: 500 })
    }

    console.log(`✅ 주문 삭제 완료: ${order.order_number}`)

    return NextResponse.json({
      success: true,
      message: '주문이 성공적으로 삭제되었습니다.',
      data: {
        deletedOrderNumber: order.order_number,
        deletedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('주문 삭제 오류:', error)
    return NextResponse.json({
      success: false,
      error: '주문 삭제 중 오류가 발생했습니다.'
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