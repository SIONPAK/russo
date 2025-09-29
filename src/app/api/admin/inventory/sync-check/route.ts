import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// GET - 재고 동기화 상태 확인
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const productId = searchParams.get('productId')
    const color = searchParams.get('color')
    const size = searchParams.get('size')

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'productId가 필요합니다.'
      }, { status: 400 })
    }

    console.log(`🔍 재고 동기화 상태 확인: ${productId} (${color}/${size})`)

    // 1. 상품의 현재 재고 상태 조회
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, code, stock_quantity, inventory_options')
      .eq('id', productId)
      .single()

    if (productError) {
      console.error('상품 조회 오류:', productError)
      return NextResponse.json({
        success: false,
        error: '상품 정보를 조회할 수 없습니다.'
      }, { status: 500 })
    }

    // 2. 해당 옵션의 할당된 재고 조회
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('id, product_id, color, size, quantity, shipped_quantity, allocated_quantity, orders!inner(order_number, status)')
      .eq('product_id', productId)
      .eq('color', color || '')
      .eq('size', size || '')
      .neq('orders.status', 'cancelled')

    if (orderItemsError) {
      console.error('주문 아이템 조회 오류:', orderItemsError)
      return NextResponse.json({
        success: false,
        error: '주문 아이템 정보를 조회할 수 없습니다.'
      }, { status: 500 })
    }

    // 3. 재고 계산
    let totalAllocated = 0
    let totalShipped = 0
    let totalOrdered = 0

    orderItems?.forEach(item => {
      totalAllocated += item.allocated_quantity || 0
      totalShipped += item.shipped_quantity || 0
      totalOrdered += item.quantity || 0
    })

    // 4. 물리적 재고 확인
    let physicalStock = 0
    let allocatedStock = 0

    if (product.inventory_options && Array.isArray(product.inventory_options)) {
      const matchingOption = product.inventory_options.find((option: any) => 
        option.color === color && option.size === size
      )
      
      if (matchingOption) {
        physicalStock = matchingOption.physical_stock || 0
        allocatedStock = matchingOption.allocated_stock || 0
      }
    }

    // 5. 동기화 상태 확인
    const isSynced = totalAllocated === allocatedStock
    const availableStock = physicalStock - allocatedStock
    const physicalAvailable = physicalStock - totalAllocated // 실제 가용 재고

    const syncStatus = {
      product: {
        id: product.id,
        name: product.name,
        code: product.code
      },
      option: {
        color: color || '기본',
        size: size || '기본'
      },
      stock: {
        physical: physicalStock,
        allocated_in_db: allocatedStock,
        allocated_from_orders: totalAllocated,
        available_calculated: availableStock,
        available_real: physicalAvailable
      },
      orders: {
        total_ordered: totalOrdered,
        total_allocated: totalAllocated,
        total_shipped: totalShipped,
        pending_allocation: totalOrdered - totalAllocated
      },
      sync: {
        is_synced: isSynced,
        allocated_mismatch: totalAllocated !== allocatedStock,
        difference: totalAllocated - allocatedStock,
        needs_fix: totalAllocated !== allocatedStock
      }
    }

    console.log(`🔍 재고 동기화 상태:`, syncStatus)

    return NextResponse.json({
      success: true,
      data: syncStatus
    })

  } catch (error) {
    console.error('재고 동기화 확인 오류:', error)
    return NextResponse.json({
      success: false,
      error: '재고 동기화 상태를 확인할 수 없습니다.'
    }, { status: 500 })
  }
}

// POST - 재고 동기화 수정
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { productId, color, size, action } = await request.json()

    if (!productId) {
      return NextResponse.json({
        success: false,
        error: 'productId가 필요합니다.'
      }, { status: 400 })
    }

    console.log(`🔧 재고 동기화 수정: ${productId} (${color}/${size}) - ${action}`)

    if (action === 'reset_allocated') {
      // allocated_stock을 0으로 초기화
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('inventory_options')
        .eq('id', productId)
        .single()

      if (productError) {
        return NextResponse.json({
          success: false,
          error: '상품 정보를 조회할 수 없습니다.'
        }, { status: 500 })
      }

      const updatedOptions = product.inventory_options?.map((option: any) => {
        if (option.color === color && option.size === size) {
          return { ...option, allocated_stock: 0 }
        }
        return option
      })

      const { error: updateError } = await supabase
        .from('products')
        .update({ inventory_options: updatedOptions })
        .eq('id', productId)

      if (updateError) {
        console.error('재고 동기화 수정 오류:', updateError)
        return NextResponse.json({
          success: false,
          error: '재고 동기화 수정에 실패했습니다.'
        }, { status: 500 })
      }

      console.log(`✅ allocated_stock 초기화 완료: ${productId} (${color}/${size})`)
    }

    return NextResponse.json({
      success: true,
      message: '재고 동기화 수정이 완료되었습니다.'
    })

  } catch (error) {
    console.error('재고 동기화 수정 오류:', error)
    return NextResponse.json({
      success: false,
      error: '재고 동기화 수정에 실패했습니다.'
    }, { status: 500 })
  }
}
