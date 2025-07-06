import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

// GET - 관리자 주문 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'all'
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const is3PMBased = searchParams.get('is_3pm_based') === 'true'
    const allocationStatus = searchParams.get('allocation_status') || 'all'
    const sortBy = searchParams.get('sort_by') || 'company_name'
    const sortOrder = searchParams.get('sort_order') || 'desc'

    const offset = (page - 1) * limit

    // 기본 쿼리 - 재고 정보 포함
    let query = supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          company_name,
          representative_name,
          phone,
          email
        ),
        order_items (
          id,
          product_name,
          color,
          size,
          quantity,
          shipped_quantity,
          unit_price,
          total_price,
          products (
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
      `, { count: 'exact' })

    // 발주 주문만 조회 (order_number가 PO로 시작하는 것들)
    query = query.like('order_number', 'PO%')

    // 검색 조건
    if (search) {
      // 1단계: 사용자 테이블에서 회사명/대표자명으로 검색
      const { data: matchingUsers } = await supabase
        .from('users')
        .select('id')
        .or(`company_name.ilike.%${search}%,representative_name.ilike.%${search}%`)
      
      const matchingUserIds = matchingUsers?.map(u => u.id) || []
      
      // 2단계: 주문 테이블에서 검색 조건 구성
      const searchConditions = []
      
      // 주문번호로 검색
      searchConditions.push(`order_number.ilike.%${search}%`)
      
      // 배송자명으로 검색
      searchConditions.push(`shipping_name.ilike.%${search}%`)
      
      // 사용자 ID가 있으면 추가
      if (matchingUserIds.length > 0) {
        query = query.in('user_id', matchingUserIds)
      } else {
        // 사용자가 없으면 주문번호나 배송자명으로만 검색
        query = query.or(searchConditions.join(','))
      }
    }

    // 상태 필터
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    // 날짜 필터 (오후 3시 기준 처리)
    if (startDate) {
      if (is3PMBased) {
        // 오후 3시 기준: 전날 15:00 ~ 당일 14:59
        const targetDate = new Date(startDate)
        
        const start = new Date(targetDate)
        start.setDate(start.getDate() - 1)
        start.setHours(15, 0, 0, 0)
        
        const end = new Date(targetDate)
        end.setHours(14, 59, 59, 999)
        
        query = query
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
      } else {
        // 일반 날짜 범위
        query = query.gte('created_at', startDate)
        if (endDate) {
          const endDateTime = new Date(endDate)
          endDateTime.setHours(23, 59, 59, 999)
          query = query.lte('created_at', endDateTime.toISOString())
        }
      }
    }

    // 정렬 처리 (조인 테이블 정렬 제거 - 프론트엔드에서 처리)
    if (sortBy === 'created_at') {
      query = query.order('created_at', { ascending: sortOrder === 'asc' })
    } else if (sortBy === 'total_amount') {
      query = query.order('total_amount', { ascending: sortOrder === 'asc' })
    } else {
      // 기본 정렬: 주문 시간 순 (최신순)
      query = query.order('created_at', { ascending: false })
    }

    // 페이지네이션
    query = query.range(offset, offset + limit - 1)

    const { data: orders, error, count } = await query

    if (error) {
      console.error('주문 조회 오류:', error)
      return NextResponse.json({ 
        success: false, 
        error: '주문 목록을 불러오는데 실패했습니다.' 
      }, { status: 500 })
    }

    // 재고 할당 상태 계산
    const ordersWithAllocation = orders?.map((order: any) => {
      const allocationInfo = calculateAllocationStatus(order.order_items)
      return {
        ...order,
        allocation_status: allocationInfo.status,
        allocation_priority: calculatePriority(order.created_at),
        order_items: order.order_items?.map((item: any) => ({
          ...item,
          available_stock: getAvailableStock(item.products, item.color, item.size),
          allocated_quantity: item.shipped_quantity || 0,
          allocation_status: getItemAllocationStatus(item)
        }))
      }
    }) || []

    // 통계 계산
    const stats = {
      pending: orders?.filter((o: any) => o.status === 'pending').length || 0,
      confirmed: orders?.filter((o: any) => o.status === 'confirmed').length || 0,
      shipped: orders?.filter((o: any) => o.status === 'shipped').length || 0,
      delivered: orders?.filter((o: any) => o.status === 'delivered').length || 0,
      cancelled: orders?.filter((o: any) => o.status === 'cancelled').length || 0,
      total: count || 0,
      allocated: ordersWithAllocation.filter((o: any) => o.allocation_status === 'allocated').length,
      insufficient_stock: ordersWithAllocation.filter((o: any) => o.allocation_status === 'insufficient').length
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: {
        orders: ordersWithAllocation,
        stats,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount: count || 0,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      }
    })

  } catch (error) {
    console.error('주문 조회 API 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}

// 재고 할당 상태 계산 함수
function calculateAllocationStatus(orderItems: any[]): { status: string; message: string } {
  if (!orderItems || orderItems.length === 0) {
    return { status: 'pending', message: '상품 정보 없음' }
  }

  let totalAllocated = 0
  let totalRequired = 0
  let hasInsufficientStock = false

  for (const item of orderItems) {
    const availableStock = getAvailableStock(item.products, item.color, item.size)
    const requiredQuantity = item.quantity
    const allocatedQuantity = Math.min(availableStock, requiredQuantity)

    totalAllocated += allocatedQuantity
    totalRequired += requiredQuantity

    if (allocatedQuantity < requiredQuantity) {
      hasInsufficientStock = true
    }
  }

  if (hasInsufficientStock) {
    return { status: 'insufficient', message: '재고 부족' }
  } else if (totalAllocated === totalRequired) {
    return { status: 'allocated', message: '할당 완료' }
  } else {
    return { status: 'partial', message: '부분 할당' }
  }
}

// 사용 가능한 재고 계산 (특정 색상/사이즈)
function getAvailableStock(product: any, color?: string, size?: string): number {
  if (!product) return 0
  
  // 옵션별 재고가 있는 경우
  if (product.inventory_options && Array.isArray(product.inventory_options) && product.inventory_options.length > 0) {
    if (color && size) {
      // 특정 색상/사이즈의 재고 찾기
      const matchingOption = product.inventory_options.find((option: any) => 
        option.color === color && option.size === size
      )
      return matchingOption ? (matchingOption.stock_quantity || 0) : 0
    } else {
      // 전체 재고 합계
      return product.inventory_options.reduce((total: number, option: any) => {
        return total + (option.stock_quantity || 0)
      }, 0)
    }
  }
  
  // 기본 재고
  return product.stock_quantity || 0
}

// 아이템별 할당 상태 계산
function getItemAllocationStatus(item: any): string {
  const availableStock = getAvailableStock(item.products, item.color, item.size)
  const requiredQuantity = item.quantity
  
  if (availableStock >= requiredQuantity) {
    return 'allocated'
  } else if (availableStock > 0) {
    return 'partial'
  } else {
    return 'insufficient'
  }
}

// 우선순위 계산 (시간순차적)
function calculatePriority(createdAt: string): number {
  const orderTime = new Date(createdAt).getTime()
  const now = Date.now()
  return now - orderTime // 오래된 주문일수록 높은 우선순위
}

// PUT - 주문 상태 일괄 업데이트
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { orderIds, status } = await request.json()

    console.log('주문 상태 업데이트 요청:', { orderIds, status })

    // 배송중으로 상태 변경 시 출고 수량 자동 설정
    if (status === 'shipped') {
      for (const orderId of orderIds) {
        // 해당 주문의 아이템들 조회
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('id, quantity, shipped_quantity')
          .eq('order_id', orderId)

        if (itemsError) {
          console.error('주문 아이템 조회 오류:', itemsError)
          continue
        }

        // 출고 수량이 0인 아이템들을 주문 수량으로 업데이트
        const itemsToUpdate = orderItems.filter(item => !item.shipped_quantity || item.shipped_quantity === 0)
        
        if (itemsToUpdate.length > 0) {
          console.log(`주문 ${orderId}: ${itemsToUpdate.length}개 아이템의 출고 수량을 자동 설정`)
          
          const updatePromises = itemsToUpdate.map(item => 
            supabase
              .from('order_items')
              .update({ shipped_quantity: item.quantity })
              .eq('id', item.id)
          )

          await Promise.all(updatePromises)
        }
      }
    }

    // 주문 상태 업데이트
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        status,
        ...(status === 'shipped' && { shipped_at: new Date().toISOString() })
      })
      .in('id', orderIds)
      .select()

    if (error) {
      console.error('주문 상태 업데이트 오류:', error)
      return NextResponse.json({ 
        success: false, 
        error: '주문 상태 업데이트에 실패했습니다.' 
      }, { status: 500 })
    }

    console.log('주문 상태 업데이트 완료:', data)

    return NextResponse.json({ 
      success: true, 
      data: { 
        updatedOrders: data.length,
        orders: data 
      } 
    })

  } catch (error) {
    console.error('주문 상태 업데이트 실패:', error)
    return NextResponse.json({ 
      success: false, 
      error: '주문 상태 업데이트에 실패했습니다.' 
    }, { status: 500 })
  }
} 