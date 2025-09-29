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

    // 날짜 필터 (working_date 기준으로 필터링)
    if (startDate) {
      // working_date는 DATE 타입이므로 YYYY-MM-DD 형식으로 직접 비교
      query = query.gte('working_date', startDate)
      if (endDate) {
        query = query.lte('working_date', endDate)
      }
    }

    // 정렬 처리 - 조인된 테이블 컬럼은 프론트엔드에서 처리
    if (sortBy === 'created_at') {
      query = query.order('created_at', { ascending: sortOrder === 'asc' })
    } else if (sortBy === 'total_amount') {
      query = query.order('total_amount', { ascending: sortOrder === 'asc' })
    } else if (sortBy === 'company_name') {
      // 회사명 정렬은 조인된 테이블이므로 기본 정렬로 대체
      console.log('🔍 회사명 정렬 요청됨 - 기본 정렬로 대체 (프론트엔드에서 처리)')
      query = query.order('created_at', { ascending: true })
    } else {
      // 기본 정렬: 주문 시간 순 (오래된 순서대로 - 주문 들어온 순서)
      query = query.order('created_at', { ascending: true })
    }

    // 벌크로 1000건씩 모든 데이터 가져오기
    console.log('🔍 주문 데이터 벌크 조회 시작...');
    
    let allOrders: any[] = []
    let fetchPage = 0
    const fetchLimit = 1000
    let hasMore = true

    while (hasMore) {
      const { data: pageData, error } = await query
        .range(fetchPage * fetchLimit, (fetchPage + 1) * fetchLimit - 1)

      if (error) {
        console.error(`주문 데이터 페이지 ${fetchPage} 조회 오류:`, error)
        return NextResponse.json({ 
          success: false, 
          error: '주문 목록을 불러오는데 실패했습니다.' 
        }, { status: 500 })
      }

      if (pageData && pageData.length > 0) {
        allOrders = allOrders.concat(pageData)
        console.log(`🔍 주문 데이터 페이지 ${fetchPage + 1}: ${pageData.length}건 조회 (총 ${allOrders.length}건)`)
        fetchPage++
        
        if (pageData.length < fetchLimit) {
          hasMore = false
        }
      } else {
        hasMore = false
      }
    }

    console.log(`🔍 주문 데이터 벌크 조회 완료: ${allOrders.length}건`)
    const orders = allOrders

    console.log(`🔍 주문 데이터 조회 완료: ${orders?.length || 0}건`);

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

    // 통계 계산 - 이미 가져온 모든 데이터 사용
    const stats = {
      pending: orders?.filter((o: any) => o.status === 'pending').length || 0,
      processing: orders?.filter((o: any) => o.status === 'processing').length || 0,
      confirmed: orders?.filter((o: any) => o.status === 'confirmed' || o.status === 'shipped').length || 0,
      total: orders?.length || 0,
      allocated: ordersWithAllocation.filter((o: any) => o.allocation_status === 'allocated').length,
      partial: ordersWithAllocation.filter((o: any) => o.allocation_status === 'partial').length,
      insufficient_stock: ordersWithAllocation.filter((o: any) => o.allocation_status === 'insufficient').length
    }

    console.log(`🔍 주문 데이터 조회 완료: ${orders?.length || 0}건`);

    // 모든 데이터를 가져오므로 페이지네이션 정보 단순화
    return NextResponse.json({
      success: true,
      data: {
        orders: ordersWithAllocation,
        stats,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: stats.total || 0,
          hasNextPage: false,
          hasPrevPage: false
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