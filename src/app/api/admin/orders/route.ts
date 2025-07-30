import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'
import { executeBatchQuery } from '@/shared/lib/batch-utils'

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
    const sortBy = searchParams.get('sort_by') || 'created_at'
    const sortOrder = searchParams.get('sort_order') || 'asc'

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
      `)

    // 발주 주문만 조회 (order_number가 PO로 시작하는 것들)
    query = query.like('order_number', 'PO%')
    
    // 반품 전용 주문 제외
    query = query.neq('order_type', 'return_only')

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
      if (status === 'not_shipped') {
        // 출고완료가 아닌 주문들만 조회
        query = query.neq('status', 'shipped')
      } else {
        query = query.eq('status', status)
      }
    }

    // 날짜 필터 (UTC 저장된 시간을 한국 시간 기준으로 필터링)
    if (startDate) {
      if (is3PMBased) {
        // 오후 3시 기준 조회: 프론트엔드에서 이미 UTC로 변환된 시간 사용
        query = query.gte('created_at', startDate)
        if (endDate) {
          query = query.lte('created_at', endDate)
        }
        
        
      } else {
        // 일반 날짜 필터 (00:00 ~ 23:59 한국 시간)
        const selectedDate = new Date(startDate)
        
        // 한국 00:00 = UTC 15:00 (전날)
        const startTimeUTC = new Date(Date.UTC(
          selectedDate.getFullYear(), 
          selectedDate.getMonth(), 
          selectedDate.getDate() - 1, 
          15, 0, 0
        ))
        
        // 한국 23:59 = UTC 14:59 (당일)
        const endTimeUTC = new Date(Date.UTC(
          selectedDate.getFullYear(), 
          selectedDate.getMonth(), 
          selectedDate.getDate(), 
          14, 59, 59
        ))
        
        query = query.gte('created_at', startTimeUTC.toISOString())
        query = query.lte('created_at', endTimeUTC.toISOString())
        
      }
    }

    // 정렬 처리 (조인 테이블 정렬 제거 - 프론트엔드에서 처리)
    if (sortBy === 'created_at') {
      query = query.order('created_at', { ascending: sortOrder === 'asc' })
    } else if (sortBy === 'total_amount') {
      query = query.order('total_amount', { ascending: sortOrder === 'asc' })
    } else {
      // 기본 정렬: 주문 시간 순 (오래된 순서대로 - 주문 들어온 순서)
      query = query.order('created_at', { ascending: true })
    }

    // 페이지네이션
    query = query.range(offset, offset + limit - 1)

    const { data: orders, error } = await query

    if (error) {
      console.error('주문 조회 오류:', error)
      return NextResponse.json({ 
        success: false, 
        error: '주문 목록을 불러오는데 실패했습니다.' 
      }, { status: 500 })
    }

    // 재고 할당 상태 계산
    const ordersWithAllocation = await Promise.all(
      orders?.map(async (order: any) => {
        const allocationInfo = await calculateAllocationStatus(supabase, order.order_items)
        
        const orderItemsWithAllocation = await Promise.all(
          order.order_items?.map(async (item: any) => ({
            ...item,
            available_stock: await getAvailableStock(supabase, item.products, item.color, item.size),
            allocated_quantity: item.shipped_quantity || 0, // 화면 표시용: 출고된 수량
            allocation_status: await getItemAllocationStatus(supabase, item)
          })) || []
        )
        
        return {
          ...order,
          allocation_status: allocationInfo.status,
          allocation_priority: calculatePriority(order.created_at),
          order_items: orderItemsWithAllocation
        }
      }) || []
    )

    // 통계 계산을 위한 전체 데이터 조회 (배치 처리)
    let statsQuery = supabase
      .from('orders')
      .select('id, status, created_at')
      .like('order_number', 'PO%')
      .neq('order_type', 'return_only')

    // 검색 조건 적용 (통계에도 동일하게)
    if (search) {
      const { data: matchingUsers } = await supabase
        .from('users')
        .select('id')
        .or(`company_name.ilike.%${search}%,representative_name.ilike.%${search}%`)
      
      const matchingUserIds = matchingUsers?.map(u => u.id) || []
      
      if (matchingUserIds.length > 0) {
        statsQuery = statsQuery.in('user_id', matchingUserIds)
      } else {
        statsQuery = statsQuery.or(`order_number.ilike.%${search}%,shipping_name.ilike.%${search}%`)
      }
    }

    // 상태 필터 적용 (통계에도 동일하게)
    if (status !== 'all') {
      if (status === 'not_shipped') {
        statsQuery = statsQuery.neq('status', 'shipped')
      } else {
        statsQuery = statsQuery.eq('status', status)
      }
    }

    // 날짜 필터 적용 (통계에도 동일하게)
    if (startDate) {
      if (is3PMBased) {
        statsQuery = statsQuery.gte('created_at', startDate)
        if (endDate) {
          statsQuery = statsQuery.lte('created_at', endDate)
        }
      } else {
        const selectedDate = new Date(startDate)
        const startTimeUTC = new Date(Date.UTC(
          selectedDate.getFullYear(), 
          selectedDate.getMonth(), 
          selectedDate.getDate() - 1, 
          15, 0, 0
        ))
        const endTimeUTC = new Date(Date.UTC(
          selectedDate.getFullYear(), 
          selectedDate.getMonth(), 
          selectedDate.getDate(), 
          14, 59, 59
        ))
        
        statsQuery = statsQuery.gte('created_at', startTimeUTC.toISOString())
        statsQuery = statsQuery.lte('created_at', endTimeUTC.toISOString())
      }
    }

    // 배치 처리로 통계 데이터 조회
    const statsResult = await executeBatchQuery(
      statsQuery.order('created_at', { ascending: false }),
      '주문 통계'
    )

    let stats
    if (statsResult.error) {
      console.error('통계 조회 오류:', statsResult.error)
      // 에러 시 기존 방식으로 폴백
      stats = {
        pending: orders?.filter((o: any) => o.status === 'pending').length || 0,
        processing: orders?.filter((o: any) => o.status === 'processing').length || 0,
        confirmed: orders?.filter((o: any) => o.status === 'confirmed' || o.status === 'shipped').length || 0,
        total: 0, // 배치로 계산된 stats.total에서 설정됨
        allocated: ordersWithAllocation.filter((o: any) => o.allocation_status === 'allocated').length,
        partial: ordersWithAllocation.filter((o: any) => o.allocation_status === 'partial').length,
        insufficient_stock: ordersWithAllocation.filter((o: any) => o.allocation_status === 'insufficient').length
      }
    } else {
      const allOrdersForStats = statsResult.data
      stats = {
        pending: allOrdersForStats.filter((o: any) => o.status === 'pending').length,
        processing: allOrdersForStats.filter((o: any) => o.status === 'processing').length,
        confirmed: allOrdersForStats.filter((o: any) => o.status === 'confirmed' || o.status === 'shipped').length,
        total: allOrdersForStats.length,
        allocated: ordersWithAllocation.filter((o: any) => o.allocation_status === 'allocated').length,
        partial: ordersWithAllocation.filter((o: any) => o.allocation_status === 'partial').length,
        insufficient_stock: ordersWithAllocation.filter((o: any) => o.allocation_status === 'insufficient').length
      }
    }

    const totalPages = Math.ceil((stats.total || 0) / limit)

    return NextResponse.json({
      success: true,
      data: {
        orders: ordersWithAllocation,
        stats,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount: stats.total || 0,
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
async function calculateAllocationStatus(supabase: any, orderItems: any[]): Promise<{ status: string; message: string }> {
  if (!orderItems || orderItems.length === 0) {
    return { status: 'insufficient', message: '상품 정보 없음' }
  }

  let canShipAny = false  // 최소 1장이상 출고 가능한지
  let canShipAll = true   // 전 옵션 출고 가능한지
  let hasUnshippedItems = false // 미출고 상품이 있는지
  let hasAlreadyShipped = false // 이미 출고된 상품이 있는지

  for (const item of orderItems) {
    const alreadyShipped = item.shipped_quantity || 0
    const remainingQuantity = item.quantity - alreadyShipped
    
    // 이미 출고된 수량이 있는지 확인
    if (alreadyShipped > 0) {
      hasAlreadyShipped = true
    }
    
    // 이미 전량 출고된 상품은 스킵
    if (remainingQuantity <= 0) {
      continue
    }

    hasUnshippedItems = true

    // 현재 재고 확인
    const availableStock = await getAvailableStock(supabase, item.products, item.color, item.size)
    
    // 최소 1장이라도 출고 가능한지 확인
    if (availableStock > 0) {
      canShipAny = true
    }
    
    // 남은 수량을 모두 출고할 수 있는지 확인
    if (availableStock < remainingQuantity) {
      canShipAll = false
    }
  }

  // 모든 상품이 이미 출고된 경우
  if (!hasUnshippedItems) {
    return { status: 'allocated', message: '완전출고' }
  }

  // 할당 상태 결정 (3가지만)
  // 이미 출고된 상품이 있으면 최소한 부분출고 상태
  if (hasAlreadyShipped) {
    if (canShipAll) {
      return { status: 'allocated', message: '완전출고' }
    } else {
      return { status: 'partial', message: '부분출고' }
    }
  } else {
    // 아직 출고된 상품이 없는 경우
    if (!canShipAny) {
      return { status: 'insufficient', message: '출고불가' }
    } else if (canShipAll) {
      return { status: 'allocated', message: '완전출고' }
    } else {
      return { status: 'partial', message: '부분출고' }
    }
  }
}

// 사용 가능한 재고 계산 (특정 색상/사이즈) - 예약된 재고 고려
async function getAvailableStock(supabase: any, product: any, color?: string, size?: string): Promise<number> {
  if (!product) return 0
  
  let availableStock = 0
  
  
  // 옵션별 재고가 있는 경우
  if (product.inventory_options && Array.isArray(product.inventory_options) && product.inventory_options.length > 0) {
    if (color && size) {
      // 특정 색상/사이즈의 재고 찾기
      const matchingOption = product.inventory_options.find((option: any) => 
        option.color === color && option.size === size
      )
      
      
      if (matchingOption) {
        // 🔧 새로운 구조 우선 확인
        if (matchingOption.physical_stock !== undefined && matchingOption.allocated_stock !== undefined) {
          const physicalStock = matchingOption.physical_stock || 0
          const allocatedStock = matchingOption.allocated_stock || 0
          availableStock = Math.max(0, physicalStock - allocatedStock)
        
        } else if (matchingOption.stock_quantity !== undefined) {
          // 기존 구조: stock_quantity 사용
          availableStock = matchingOption.stock_quantity || 0
         
        } else {
         
          availableStock = 0
        }
      } else {
        
        availableStock = 0
      }
    } else {
      // 전체 재고 합계
      availableStock = product.inventory_options.reduce((total: number, option: any) => {
        if (option.physical_stock !== undefined && option.allocated_stock !== undefined) {
          const physicalStock = option.physical_stock || 0
          const allocatedStock = option.allocated_stock || 0
          return total + Math.max(0, physicalStock - allocatedStock)
        } else {
          return total + (option.stock_quantity || 0)
        }
      }, 0)
     
    }
  } else {
    // 기본 재고
    availableStock = product.stock_quantity || 0
    
  }
  
  
  
  return availableStock
}

// 아이템별 할당 상태 계산
async function getItemAllocationStatus(supabase: any, item: any): Promise<string> {
  const availableStock = await getAvailableStock(supabase, item.products, item.color, item.size)
  const alreadyShipped = item.shipped_quantity || 0
  const remainingQuantity = item.quantity - alreadyShipped // 아직 할당되지 않은 수량
  
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
        ...(status === 'shipped' && { shipped_at: getKoreaTime() })
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