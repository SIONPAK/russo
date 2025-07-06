import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'

// 재고 할당 시스템
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    const { 
      product_id,
      allocation_type = 'order_based', // 'order_based' | 'priority_based'
      force_allocation = false
    } = body

    // 상품 정보 조회
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, stock_quantity, inventory_options')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 가용 재고 계산 (예약된 수량 계산)
    const { data: reservedItems } = await supabase
      .from('order_items')
      .select(`
        quantity, 
        shipped_quantity,
        orders!order_items_order_id_fkey (
          status
        )
      `)
      .eq('product_id', product_id)

    const reservedQuantity = reservedItems?.reduce((sum: number, item: any) => {
      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders
      const isPendingOrder = order && ['pending', 'confirmed', 'processing'].includes(order.status)
      
      if (isPendingOrder) {
        const pendingQuantity = item.quantity - (item.shipped_quantity || 0)
        return sum + Math.max(0, pendingQuantity)
      }
      return sum
    }, 0) || 0

    const availableStock = Math.max(0, product.stock_quantity - reservedQuantity)

    // 대기 중인 주문들 조회 (재고 할당 대기)
    const { data: pendingOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        user_id,
        total_amount,
        status,
        created_at,
        order_items!inner (
          id,
          product_id,
          quantity,
          allocated_quantity
        ),
        users!orders_user_id_fkey (
          id,
          company_name,
          user_type,
          priority_level
        )
      `)
      .eq('status', 'pending_allocation')
      .eq('order_items.product_id', product_id)
      .order('created_at', { ascending: true })

    if (ordersError) {
      return NextResponse.json({
        success: false,
        error: '주문 조회에 실패했습니다.'
      }, { status: 500 })
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: '할당 대기 중인 주문이 없습니다.',
        data: {
          available_stock: availableStock,
          allocated_orders: []
        }
      })
    }

    // 재고 할당 로직
    let allocatedOrders: any[] = []
    let remainingStock = availableStock

    if (allocation_type === 'priority_based') {
      // 우선순위 기반 할당 (메인 대형 업체 우선)
      const sortedOrders = pendingOrders.sort((a: any, b: any) => {
        // 1. 우선순위 레벨 (낮은 숫자가 높은 우선순위)
        const aUser = Array.isArray(a.users) ? a.users[0] : a.users
        const bUser = Array.isArray(b.users) ? b.users[0] : b.users
        
        const aPriority = aUser?.priority_level || 999
        const bPriority = bUser?.priority_level || 999
        
        if (aPriority !== bPriority) {
          return aPriority - bPriority
        }
        
        // 2. 사용자 타입 (main_distributor > distributor > retailer)
        const typeOrder: { [key: string]: number } = { 'main_distributor': 1, 'distributor': 2, 'retailer': 3 }
        const aTypeOrder = typeOrder[aUser?.user_type || ''] || 4
        const bTypeOrder = typeOrder[bUser?.user_type || ''] || 4
        
        if (aTypeOrder !== bTypeOrder) {
          return aTypeOrder - bTypeOrder
        }
        
        // 3. 주문 금액 (높은 금액 우선)
        return b.total_amount - a.total_amount
      })

      // 우선순위 순으로 재고 할당
      for (const order of sortedOrders) {
        const orderItem = order.order_items[0]
        const neededQuantity = orderItem.quantity - (orderItem.allocated_quantity || 0)
        
        if (neededQuantity <= 0) continue
        
        const allocateQuantity = Math.min(neededQuantity, remainingStock)
        
        if (allocateQuantity > 0) {
          // 재고 할당
          const { error: updateError } = await supabase
            .from('order_items')
            .update({
              allocated_quantity: (orderItem.allocated_quantity || 0) + allocateQuantity
            })
            .eq('id', orderItem.id)

          if (!updateError) {
            const user = Array.isArray(order.users) ? order.users[0] : order.users
            allocatedOrders.push({
              order_id: order.id,
              company_name: user?.company_name || '',
              user_type: user?.user_type || '',
              priority_level: user?.priority_level || 999,
              allocated_quantity: allocateQuantity,
              needed_quantity: neededQuantity,
              is_fully_allocated: allocateQuantity === neededQuantity
            })

            remainingStock -= allocateQuantity

            // 완전 할당된 주문은 상태 변경
            if (allocateQuantity === neededQuantity) {
              await supabase
                .from('orders')
                .update({ status: 'allocated' })
                .eq('id', order.id)
            }
          }
        }

        if (remainingStock <= 0) break
      }

    } else {
      // 주문 순서 기반 할당 (FIFO)
      for (const order of pendingOrders) {
        const orderItem = order.order_items[0]
        const neededQuantity = orderItem.quantity - (orderItem.allocated_quantity || 0)
        
        if (neededQuantity <= 0) continue
        
        const allocateQuantity = Math.min(neededQuantity, remainingStock)
        
        if (allocateQuantity > 0) {
          // 재고 할당
          const { error: updateError } = await supabase
            .from('order_items')
            .update({
              allocated_quantity: (orderItem.allocated_quantity || 0) + allocateQuantity
            })
            .eq('id', orderItem.id)

          if (!updateError) {
            const user = Array.isArray(order.users) ? order.users[0] : order.users
            allocatedOrders.push({
              order_id: order.id,
              company_name: user?.company_name || '',
              user_type: user?.user_type || '',
              priority_level: user?.priority_level || 999,
              allocated_quantity: allocateQuantity,
              needed_quantity: neededQuantity,
              is_fully_allocated: allocateQuantity === neededQuantity
            })

            remainingStock -= allocateQuantity

            // 완전 할당된 주문은 상태 변경
            if (allocateQuantity === neededQuantity) {
              await supabase
                .from('orders')
                .update({ status: 'allocated' })
                .eq('id', order.id)
            }
          }
        }

        if (remainingStock <= 0) break
      }
    }

    // 재고 할당 이력 기록 (현재는 생략 - 추후 로그 테이블 추가 시 구현)
    // if (allocatedOrders.length > 0) {
    //   const allocationRecords = allocatedOrders.map(order => ({
    //     product_id,
    //     order_id: order.order_id,
    //     allocated_quantity: order.allocated_quantity,
    //     allocation_type,
    //     allocated_at: new Date().toISOString(),
    //     notes: `${allocation_type === 'priority_based' ? '우선순위' : '주문순서'} 기반 할당`
    //   }))

    //   await supabase
    //     .from('inventory_allocations')
    //     .insert(allocationRecords)
    // }

    return NextResponse.json({
      success: true,
      message: `${allocatedOrders.length}개 주문에 재고가 할당되었습니다.`,
      data: {
        product_name: product.name,
        total_stock: product.stock_quantity,
        available_stock: availableStock,
        remaining_stock: remainingStock,
        allocation_type,
        allocated_orders: allocatedOrders
      }
    })

  } catch (error) {
    console.error('Inventory allocation error:', error)
    return NextResponse.json({
      success: false,
      error: '재고 할당 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 재고 할당 현황 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const product_id = searchParams.get('product_id')
    
    const supabase = createClient()

    // 현재는 주문 아이템 기반으로 할당 현황 조회
    let query = supabase
      .from('order_items')
      .select(`
        id,
        product_id,
        quantity,
        shipped_quantity,
        allocated_quantity,
        created_at,
        products!inner (
          id,
          name,
          stock_quantity
        ),
        orders!order_items_order_id_fkey (
          id,
          status,
          users!orders_user_id_fkey (
            company_name,
            user_type
          )
        )
      `)
      .gt('allocated_quantity', 0)
      .order('created_at', { ascending: false })

    if (product_id) {
      query = query.eq('product_id', product_id)
    }

    const { data: allocations, error } = await query

    if (error) {
      return NextResponse.json({
        success: false,
        error: '재고 할당 현황 조회에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: allocations || []
    })

  } catch (error) {
    console.error('Inventory allocation fetch error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 