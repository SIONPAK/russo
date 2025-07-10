import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// POST - 전체 주문 초기화 및 재할당
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    console.log('🔄 [전체 초기화] 시작 - 모든 발주 주문 초기화 및 재할당')

    // 1단계: 모든 발주 주문 아이템의 할당 상태 초기화
    console.log('📝 [1단계] 주문 아이템 할당 상태 초기화')
    
    // 먼저 발주 주문 ID들을 조회
    const { data: targetOrders, error: targetOrdersError } = await supabase
      .from('orders')
      .select('id')
      .like('order_number', 'PO%')
      .in('status', ['pending', 'processing', 'confirmed', 'partial'])

    if (targetOrdersError) {
      console.error('❌ [1단계] 대상 주문 조회 실패:', targetOrdersError)
      return NextResponse.json({
        success: false,
        error: '대상 주문 조회에 실패했습니다.'
      }, { status: 500 })
    }

    const orderIds = targetOrders?.map(order => order.id) || []
    console.log(`🔍 [1단계] 대상 주문 ${orderIds.length}개 발견`)

    let orderItems = null
    let resetItemsError = null

    if (orderIds.length > 0) {
      const result = await supabase
        .from('order_items')
        .update({
          shipped_quantity: 0,
          allocated_quantity: 0,
          updated_at: getKoreaTime()
        })
        .in('order_id', orderIds)
        .select('id')

      orderItems = result.data
      resetItemsError = result.error
    }

    if (resetItemsError) {
      console.error('❌ [1단계] 주문 아이템 초기화 실패:', resetItemsError)
      return NextResponse.json({
        success: false,
        error: '주문 아이템 초기화에 실패했습니다.'
      }, { status: 500 })
    }

    console.log(`✅ [1단계] 완료 - ${orderItems?.length || 0}개 아이템 초기화`)

    // 2단계: 모든 발주 주문의 상태를 pending으로 초기화
    console.log('📝 [2단계] 주문 상태 초기화')
    
    const { data: orders, error: resetOrdersError } = await supabase
      .from('orders')
      .update({
        status: 'pending',
        updated_at: getKoreaTime()
      })
      .like('order_number', 'PO%')
      .in('status', ['processing', 'confirmed', 'partial'])
      .select('id, order_number')

    if (resetOrdersError) {
      console.error('❌ [2단계] 주문 상태 초기화 실패:', resetOrdersError)
      return NextResponse.json({
        success: false,
        error: '주문 상태 초기화에 실패했습니다.'
      }, { status: 500 })
    }

    console.log(`✅ [2단계] 완료 - ${orders?.length || 0}개 주문 상태 초기화`)

    // 3단계: 물리적 재고와 할당 재고 동기화
    console.log('📝 [3단계] 재고 동기화 시작')
    
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, inventory_options')
      .not('inventory_options', 'is', null)

    if (productsError) {
      console.error('❌ [3단계] 상품 조회 실패:', productsError)
      return NextResponse.json({
        success: false,
        error: '상품 조회에 실패했습니다.'
      }, { status: 500 })
    }

    let syncedProducts = 0
    for (const product of products || []) {
      if (product.inventory_options && Array.isArray(product.inventory_options)) {
        const syncedOptions = product.inventory_options.map((option: any) => ({
          ...option,
          allocated_stock: 0,
          stock_quantity: option.physical_stock || 0
        }))

        const { error: updateError } = await supabase
          .from('products')
          .update({
            inventory_options: syncedOptions,
            updated_at: getKoreaTime()
          })
          .eq('id', product.id)

        if (!updateError) {
          syncedProducts++
        } else {
          console.error(`❌ 상품 ${product.id} 재고 동기화 실패:`, updateError)
        }
      }
    }

    console.log(`✅ [3단계] 완료 - ${syncedProducts}개 상품 재고 동기화`)

    // 4단계: 시간순 재할당 수행
    console.log('📝 [4단계] 시간순 재할당 시작')
    
    // 모든 발주 주문을 시간순으로 조회
    const { data: allOrders, error: ordersQueryError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        users!orders_user_id_fkey (
          company_name
        ),
        order_items (
          id,
          product_id,
          product_name,
          color,
          size,
          quantity,
          shipped_quantity
        )
      `)
      .like('order_number', 'PO%')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (ordersQueryError) {
      console.error('❌ [4단계] 주문 조회 실패:', ordersQueryError)
      return NextResponse.json({
        success: false,
        error: '주문 조회에 실패했습니다.'
      }, { status: 500 })
    }

    console.log(`🔍 [4단계] ${allOrders?.length || 0}개 주문 발견`)

    let allocatedOrders = 0
    let partialOrders = 0
    let failedOrders = 0

    // 각 주문을 시간순으로 처리
    for (const order of allOrders || []) {
      try {
        const companyName = (order.users as any)?.company_name || '알 수 없음'
        console.log(`🔄 [재할당] 처리 중: ${order.order_number} (${companyName})`)
        
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

          console.log(`🔍 [할당 계산] ${item.product_name} (${item.color}/${item.size}): 전체 ${item.quantity}개, 기출고 ${item.shipped_quantity || 0}개, 잔여 ${remainingQuantity}개, 가용재고 ${availableStock || 0}개 → 할당 ${allocatableQuantity}개`)

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
              // 주문 아이템 업데이트 (기존 출고 수량에 추가)
              const newShippedQuantity = (item.shipped_quantity || 0) + allocatableQuantity
              const { error: updateError } = await supabase
                .from('order_items')
                .update({
                  shipped_quantity: newShippedQuantity,
                  allocated_quantity: newShippedQuantity
                })
                .eq('id', item.id)

              if (!updateError) {
                console.log(`✅ 할당 완료 - ${item.product_name} (${item.color}/${item.size}): ${allocatableQuantity}개 추가 할당 (총 ${newShippedQuantity}/${item.quantity})`)
                
                if (newShippedQuantity < item.quantity) {
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
      message: '전체 초기화 및 재할당이 완료되었습니다.',
      data: {
        resetItems: orderItems?.length || 0,
        resetOrders: orders?.length || 0,
        syncedProducts: syncedProducts,
        reallocation: {
          total: allOrders?.length || 0,
          fullyAllocated: allocatedOrders,
          partiallyAllocated: partialOrders,
          failed: failedOrders
        }
      }
    })

  } catch (error) {
    console.error('❌ [전체 초기화] 오류:', error)
    return NextResponse.json({
      success: false,
      error: '전체 초기화 및 재할당 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 