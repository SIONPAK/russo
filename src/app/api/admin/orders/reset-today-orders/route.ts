import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// POST - 오늘 날짜 주문들만 초기화 및 재할당 (15:00~14:59 기준)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    console.log('🔄 [오늘 주문 초기화] 시작 - 15:00~14:59 기준 주문 초기화 및 재할당')

    // 오늘 날짜 범위 계산 (15:00~14:59)
    const today = new Date()
    const startTimeUTC = new Date(Date.UTC(
      today.getFullYear(), 
      today.getMonth(), 
      today.getDate() - 1, 
      6, 0, 0  // 전날 15:00 한국 = 전날 06:00 UTC
    ))
    const endTimeUTC = new Date(Date.UTC(
      today.getFullYear(), 
      today.getMonth(), 
      today.getDate(), 
      5, 59, 59  // 당일 14:59 한국 = 당일 05:59 UTC
    ))

    console.log(`📅 [날짜 범위] ${startTimeUTC.toISOString()} ~ ${endTimeUTC.toISOString()}`)

    // 1단계: 오늘 날짜 범위의 발주 주문들 조회 (배송 완료된 주문 제외)
    const { data: todayOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        status,
        users (
          company_name
        ),
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
      .like('order_number', 'PO%')
      .gte('created_at', startTimeUTC.toISOString())
      .lte('created_at', endTimeUTC.toISOString())
      .neq('status', 'shipped')
      .neq('status', 'delivered')
      .neq('status', 'completed')
      .order('created_at', { ascending: true })

    if (ordersError) {
      console.error('❌ [1단계] 오늘 주문 조회 실패:', ordersError)
      return NextResponse.json({
        success: false,
        error: '오늘 주문 조회에 실패했습니다.'
      }, { status: 500 })
    }

    if (!todayOrders || todayOrders.length === 0) {
      return NextResponse.json({
        success: false,
        message: '오늘 날짜에 해당하는 미완료 주문이 없습니다.'
      })
    }

    console.log(`📋 [1단계] 오늘 미완료 주문 ${todayOrders.length}개 발견:`)
    todayOrders.forEach(order => {
      console.log(`  - ${order.order_number} (${(order.users as any)?.company_name}) - ${order.status}`)
    })

    // 2단계: 해당 주문들의 할당 상태 초기화
    console.log('📝 [2단계] 주문 아이템 할당 상태 초기화')
    
    const orderIds = todayOrders.map(order => order.id)
    let resetItemsCount = 0

    for (const order of todayOrders) {
      for (const item of order.order_items || []) {
        // 기존 할당량만큼 재고 복원 (shipped_quantity > 0인 경우만)
        if (item.shipped_quantity > 0) {
          const { error: restoreError } = await supabase
            .rpc('adjust_physical_stock', {
              p_product_id: item.product_id,
              p_color: item.color,
              p_size: item.size,
              p_quantity_change: item.shipped_quantity,
              p_reason: `오늘 주문 초기화로 인한 재고 복원 - ${order.order_number}`
            })

          if (restoreError) {
            console.error(`❌ 재고 복원 실패 - ${item.product_name}:`, restoreError)
          } else {
            console.log(`✅ 재고 복원 - ${item.product_name} (${item.color}/${item.size}): ${item.shipped_quantity}개`)
          }
        }

        // 주문 아이템 초기화
        const { error: resetError } = await supabase
          .from('order_items')
          .update({
            shipped_quantity: 0,
            allocated_quantity: 0,
            updated_at: getKoreaTime()
          })
          .eq('id', item.id)

        if (!resetError) {
          resetItemsCount++
        }
      }
    }

    console.log(`✅ [2단계] 완료 - ${resetItemsCount}개 아이템 초기화`)

    // 3단계: 주문 상태를 pending으로 초기화
    console.log('📝 [3단계] 주문 상태 초기화')
    
    const { data: resetOrders, error: resetOrdersError } = await supabase
      .from('orders')
      .update({
        status: 'pending',
        updated_at: getKoreaTime()
      })
      .in('id', orderIds)
      .select('id, order_number')

    if (resetOrdersError) {
      console.error('❌ [3단계] 주문 상태 초기화 실패:', resetOrdersError)
      return NextResponse.json({
        success: false,
        error: '주문 상태 초기화에 실패했습니다.'
      }, { status: 500 })
    }

    console.log(`✅ [3단계] 완료 - ${resetOrders?.length || 0}개 주문 상태 초기화`)

    // 4단계: 시간순 재할당 수행
    console.log('📝 [4단계] 시간순 재할당 시작')
    
    let allocatedOrders = 0
    let partialOrders = 0
    let failedOrders = 0

    // 각 주문을 시간순으로 처리 (이미 시간순으로 정렬됨)
    for (const order of todayOrders) {
      try {
        console.log(`🔄 [재할당] 처리 중: ${order.order_number} (${(order.users as any)?.company_name})`)
        
        let orderFullyAllocated = true
        let orderHasPartialAllocation = false

        // 각 주문 아이템에 대해 재고 할당
        for (const item of order.order_items || []) {
          const { data: availableStock, error: stockError } = await supabase
            .rpc('calculate_available_stock', {
              p_product_id: item.product_id,
              p_color: item.color,
              p_size: item.size
            })

          if (stockError) {
            console.error(`❌ 가용재고 조회 실패 - ${item.product_name}:`, stockError)
            orderFullyAllocated = false
            continue
          }

          // 🔧 수정: 실제 필요한 수량 계산 (전체 주문 수량 - 이미 출고된 수량)
          const remainingQuantity = item.quantity - (item.shipped_quantity || 0)
          const allocatableQuantity = Math.min(remainingQuantity, availableStock || 0)

          console.log(`🔍 재고 확인 - ${item.product_name} (${item.color}/${item.size}): 전체 ${item.quantity}개, 기출고 ${item.shipped_quantity || 0}개, 잔여 ${remainingQuantity}개, 가용재고 ${availableStock || 0}개 → 할당 ${allocatableQuantity}개`)

          if (allocatableQuantity > 0) {
            // 재고 할당
            const { data: allocationResult, error: allocationError } = await supabase
              .rpc('allocate_stock', {
                p_product_id: item.product_id,
                p_quantity: allocatableQuantity,
                p_color: item.color,
                p_size: item.size
              })

            if (!allocationError && allocationResult) {
              // 주문 아이템 업데이트
              const { error: updateError } = await supabase
                .from('order_items')
                .update({
                  shipped_quantity: allocatableQuantity,
                  allocated_quantity: allocatableQuantity
                })
                .eq('id', item.id)

              if (!updateError) {
                console.log(`✅ 할당 완료 - ${item.product_name} (${item.color}/${item.size}): ${allocatableQuantity}개 할당 (총 ${allocatableQuantity}/${item.quantity})`)
                
                if (allocatableQuantity < item.quantity) {
                  orderHasPartialAllocation = true
                  orderFullyAllocated = false
                }
              } else {
                console.error(`❌ 주문 아이템 업데이트 실패:`, updateError)
                orderFullyAllocated = false
              }
            } else {
              console.error(`❌ 재고 할당 실패:`, allocationError)
              orderFullyAllocated = false
            }
          } else {
            console.log(`⚠️ 재고 부족 - ${item.product_name} (${item.color}/${item.size}): 필요 ${remainingQuantity}개, 가용 ${availableStock || 0}개`)
            orderFullyAllocated = false
          }
        }

        // 주문 상태 업데이트
        let newStatus = 'pending'
        if (orderFullyAllocated) {
          newStatus = 'processing'
          allocatedOrders++
        } else if (orderHasPartialAllocation) {
          newStatus = 'processing'
          partialOrders++
        } else {
          failedOrders++
        }

        await supabase
          .from('orders')
          .update({
            status: newStatus,
            updated_at: getKoreaTime()
          })
          .eq('id', order.id)

        console.log(`✅ [재할당] 완료: ${order.order_number} → ${newStatus}`)

      } catch (error) {
        console.error(`❌ [재할당] 실패: ${order.order_number}`, error)
        failedOrders++
      }
    }

    console.log(`🎯 [4단계] 완료 - 전체할당: ${allocatedOrders}, 부분할당: ${partialOrders}, 실패: ${failedOrders}`)

    // 최종 결과 반환
    return NextResponse.json({
      success: true,
      message: `오늘 날짜 ${todayOrders.length}개 미완료 주문의 초기화 및 재할당이 완료되었습니다.`,
      data: {
        dateRange: {
          start: startTimeUTC.toISOString(),
          end: endTimeUTC.toISOString()
        },
        orders: todayOrders.map(order => ({
          orderNumber: order.order_number,
          companyName: (order.users as any)?.company_name,
          createdAt: order.created_at
        })),
        resetItems: resetItemsCount,
        resetOrders: resetOrders?.length || 0,
        reallocation: {
          total: todayOrders.length,
          fullyAllocated: allocatedOrders,
          partiallyAllocated: partialOrders,
          failed: failedOrders
        }
      }
    })

  } catch (error) {
    console.error('❌ [오늘 주문 초기화] 오류:', error)
    return NextResponse.json({
      success: false,
      error: '오늘 주문 초기화 및 재할당 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 