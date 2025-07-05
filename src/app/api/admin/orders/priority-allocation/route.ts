import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getCurrentKoreanDateTime } from '@/shared/lib/utils'

// 메인 업체 우선 할당 API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { orderIds } = body

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '주문 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 선택된 주문들 조회
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          id,
          company_name,
          customer_grade,
          representative_name
        ),
        order_items!order_items_order_id_fkey (
          id,
          product_id,
          product_name,
          quantity,
          unit_price,
          color,
          size,
          products!order_items_product_id_fkey (
            id,
            name,
            stock_quantity
          )
        )
      `)
      .in('id', orderIds)
      .eq('status', 'confirmed')

    if (orderError || !orders || orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: '처리 가능한 주문이 없습니다.'
      }, { status: 404 })
    }

    // 우수업체와 일반업체 분리
    const premiumOrders = orders.filter(order => order.users?.customer_grade === 'premium')
    const generalOrders = orders.filter(order => order.users?.customer_grade === 'general')

    const allocationResults = []
    const failedOrders = []

    // 우수업체 주문 먼저 처리
    const sortedOrders = [...premiumOrders, ...generalOrders]

    for (const order of sortedOrders) {
      try {
        const orderAllocation = await processOrderAllocation(supabase, order)
        
        if (orderAllocation.success) {
          allocationResults.push({
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: order.users?.company_name,
            customerGrade: order.users?.customer_grade,
            status: 'allocated',
            allocatedItems: orderAllocation.allocatedItems,
            priorityLevel: order.users?.customer_grade === 'premium' ? 'high' : 'normal'
          })

          // 주문 상태를 preparing으로 변경
          await supabase
            .from('orders')
            .update({
              status: 'preparing',
              notes: `우선 할당 처리 완료 - ${getCurrentKoreanDateTime()}`,
              updated_at: getCurrentKoreanDateTime()
            })
            .eq('id', order.id)

        } else {
          failedOrders.push({
            orderId: order.id,
            orderNumber: order.order_number,
            customerName: order.users?.company_name,
            error: orderAllocation.error
          })
        }
      } catch (error) {
        console.error(`Order allocation error for ${order.order_number}:`, error)
        failedOrders.push({
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.users?.company_name,
          error: error instanceof Error ? error.message : '할당 처리 중 오류 발생'
        })
      }
    }

    // 우선 할당 로그 기록
    await supabase
      .from('inventory_logs')
      .insert(
        allocationResults.map(result => ({
          product_id: null,
          action: 'priority_allocation',
          quantity: 0,
          reason: '우선 할당 처리',
          admin_id: 1,
          order_id: result.orderId,
          created_at: getCurrentKoreanDateTime(),
          notes: `${result.customerName} (${result.customerGrade === 'premium' ? '우수업체' : '일반업체'})`
        }))
      )

    return NextResponse.json({
      success: true,
      data: {
        allocated: allocationResults,
        failed: failedOrders,
        summary: {
          totalOrders: orders.length,
          premiumOrders: premiumOrders.length,
          generalOrders: generalOrders.length,
          successfulAllocations: allocationResults.length,
          failedAllocations: failedOrders.length
        }
      },
      message: `우선 할당 완료: ${allocationResults.length}건 성공, ${failedOrders.length}건 실패`
    })

  } catch (error) {
    console.error('Priority allocation API error:', error)
    return NextResponse.json({
      success: false,
      error: '우선 할당 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 주문 재고 할당 처리
async function processOrderAllocation(supabase: any, order: any) {
  try {
    const allocatedItems = []
    
    for (const item of order.order_items) {
      // 현재 재고 확인
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, stock_quantity')
        .eq('id', item.product_id)
        .single()

      if (productError || !product) {
        throw new Error(`상품 정보를 찾을 수 없습니다: ${item.product_name}`)
      }

      // 재고 충분 여부 확인
      if (product.stock_quantity < item.quantity) {
        throw new Error(`재고 부족: ${item.product_name} (필요: ${item.quantity}, 현재: ${product.stock_quantity})`)
      }

      // 재고 차감
      const { error: stockError } = await supabase
        .from('products')
        .update({
          stock_quantity: product.stock_quantity - item.quantity,
          updated_at: getCurrentKoreanDateTime()
        })
        .eq('id', item.product_id)

      if (stockError) {
        throw new Error(`재고 업데이트 실패: ${item.product_name}`)
      }

      allocatedItems.push({
        productId: item.product_id,
        productName: item.product_name,
        requestedQuantity: item.quantity,
        allocatedQuantity: item.quantity,
        remainingStock: product.stock_quantity - item.quantity,
        color: item.color,
        size: item.size
      })
    }

    return {
      success: true,
      allocatedItems
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '할당 처리 중 오류 발생'
    }
  }
}

// GET - 우선 할당 이력 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabase
      .from('inventory_logs')
      .select(`
        *,
        orders!inventory_logs_order_id_fkey (
          order_number,
          users!orders_user_id_fkey (
            company_name,
            customer_grade
          )
        )
      `)
      .eq('action', 'priority_allocation')

    // 날짜 필터
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      query = query.lte('created_at', endDate + 'T23:59:59')
    }

    // 페이지네이션
    const offset = (page - 1) * limit
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: logs, error, count } = await query

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: {
        logs: logs || [],
        pagination: {
          currentPage: page,
          totalPages: Math.ceil((count || 0) / limit),
          totalItems: count || 0,
          itemsPerPage: limit
        }
      }
    })

  } catch (error) {
    console.error('Priority allocation history error:', error)
    return NextResponse.json({
      success: false,
      error: '우선 할당 이력 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 