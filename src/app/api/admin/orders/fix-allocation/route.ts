import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// POST - 기존 주문들의 시간순 재고 할당 수정
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    console.log('🔄 올바른 시간순 재고 할당 시작...')

    // 1. 기존 할당 초기화
    console.log('\n📋 1단계: 기존 할당 초기화')
    
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        order_type,
        status,
        created_at,
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
      .eq('order_type', 'purchase')
      .order('created_at', { ascending: true })

    if (ordersError) {
      console.error('주문 조회 오류:', ordersError)
      return NextResponse.json({
        success: false,
        error: '주문 조회에 실패했습니다.'
      }, { status: 500 })
    }

    console.log(`📋 처리할 주문 수: ${orders.length}개`)

    // 2. 모든 주문 아이템의 shipped_quantity를 0으로 초기화
    console.log('\n📋 2단계: shipped_quantity 초기화')
    for (const order of orders) {
      for (const item of order.order_items) {
        await supabase
          .from('order_items')
          .update({ shipped_quantity: 0 })
          .eq('id', item.id)
      }
      
      // 주문 상태도 pending으로 초기화
      await supabase
        .from('orders')
        .update({ status: 'pending' })
        .eq('id', order.id)
    }

    // 3. 재고를 원래 상태로 복원
    console.log('\n📋 3단계: 재고 복원')
    
    // 마일드 합포 원턱 카고 버뮤다 상품 조회
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, inventory_options')
      .ilike('name', '%마일드 합포 원턱 카고 버뮤다%')
      .single()

    if (productError || !product) {
      console.error('상품 조회 실패:', productError)
      return NextResponse.json({
        success: false,
        error: '상품 조회에 실패했습니다.'
      }, { status: 500 })
    }

    console.log(`📦 상품 조회: ${product.name}`)

    // 초기 재고로 복원
    const restoredOptions = [
      { size: 'FREE', color: '블랙', stock_quantity: 60, additional_price: 0 },
      { size: 'FREE', color: '그레이', stock_quantity: 60, additional_price: 0 },
      { size: 'FREE', color: '백메란지', stock_quantity: 42, additional_price: 0 }
    ]

    const totalRestoredStock = restoredOptions.reduce((sum, opt) => sum + opt.stock_quantity, 0)

    await supabase
      .from('products')
      .update({
        inventory_options: restoredOptions,
        stock_quantity: totalRestoredStock
      })
      .eq('id', product.id)

    console.log('✅ 재고 복원 완료:', restoredOptions)

    // 4. 시간순으로 재고 할당 (오래된 주문부터)
    console.log('\n📋 4단계: 시간순 재고 할당')

    const allocationResults = []

    for (const order of orders) {
      console.log(`\n🔍 주문 처리: ${order.order_number} (${order.created_at})`)
      
      let orderFullyAllocated = true
      let orderHasPartialAllocation = false
      const orderResult = {
        orderNumber: order.order_number,
        createdAt: order.created_at,
        items: []
      }

      for (const item of order.order_items) {
        console.log(`  📦 아이템: ${item.product_name} (${item.color}/${item.size}) - 요청: ${item.quantity}개`)

        // 현재 재고 상태 조회
        const { data: currentProduct, error: fetchError } = await supabase
          .from('products')
          .select('inventory_options')
          .eq('id', product.id)
          .single()

        if (fetchError || !currentProduct) {
          console.error('    ❌ 상품 조회 실패')
          orderFullyAllocated = false
          continue
        }

        const currentOptions = currentProduct.inventory_options || []
        const matchingOption = currentOptions.find(opt => 
          opt.color === item.color && opt.size === item.size
        )

        if (!matchingOption) {
          console.error(`    ❌ 옵션 찾기 실패: ${item.color}/${item.size}`)
          orderFullyAllocated = false
          continue
        }

        const availableStock = matchingOption.stock_quantity || 0
        const allocatedQuantity = Math.min(item.quantity, availableStock)

        console.log(`    📊 현재 재고: ${availableStock}개, 할당: ${allocatedQuantity}개`)

        if (allocatedQuantity > 0) {
          // 재고 차감
          const updatedOptions = currentOptions.map(opt => {
            if (opt.color === item.color && opt.size === item.size) {
              return { ...opt, stock_quantity: opt.stock_quantity - allocatedQuantity }
            }
            return opt
          })

          const newTotalStock = updatedOptions.reduce((sum, opt) => sum + (opt.stock_quantity || 0), 0)

          // 상품 재고 업데이트
          await supabase
            .from('products')
            .update({
              inventory_options: updatedOptions,
              stock_quantity: newTotalStock
            })
            .eq('id', product.id)

          // 주문 아이템 shipped_quantity 업데이트
          await supabase
            .from('order_items')
            .update({ shipped_quantity: allocatedQuantity })
            .eq('id', item.id)

          // 재고 변동 이력 기록
          await supabase
            .from('stock_movements')
            .insert({
              product_id: product.id,
              movement_type: 'order_allocation',
              quantity: -allocatedQuantity,
              color: item.color,
              size: item.size,
              notes: `시간순 재고 할당 수정 (${order.order_number}) - ${item.color}/${item.size}`,
              reference_id: order.id,
              reference_type: 'order',
              created_at: getKoreaTime()
            })

          console.log(`    ✅ 할당 완료: ${allocatedQuantity}개, 남은 재고: ${availableStock - allocatedQuantity}개`)
        }

        // 할당 상태 확인
        if (allocatedQuantity < item.quantity) {
          orderFullyAllocated = false
          if (allocatedQuantity > 0) {
            orderHasPartialAllocation = true
          }
          console.log(`    🟡 부분 할당: ${allocatedQuantity}/${item.quantity}개`)
        } else {
          console.log(`    ✅ 전량 할당: ${allocatedQuantity}/${item.quantity}개`)
        }

        orderResult.items.push({
          productName: item.product_name,
          color: item.color,
          size: item.size,
          requested: item.quantity,
          allocated: allocatedQuantity,
          status: allocatedQuantity === item.quantity ? 'fully_allocated' : 
                  allocatedQuantity > 0 ? 'partial_allocated' : 'not_allocated'
        })
      }

      // 주문 상태 업데이트
      let newStatus = 'pending'
      if (orderFullyAllocated) {
        newStatus = 'confirmed'
        console.log(`  ✅ 주문 상태: pending → confirmed (전량 할당)`)
      } else if (orderHasPartialAllocation) {
        newStatus = 'partial'
        console.log(`  🟡 주문 상태: pending → partial (부분 할당)`)
      } else {
        console.log(`  ❌ 주문 상태: pending 유지 (할당 불가)`)
      }

      await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id)

      orderResult.finalStatus = newStatus
      allocationResults.push(orderResult)
    }

    // 5. 최종 재고 상태 확인
    console.log('\n📋 5단계: 최종 재고 상태 확인')
    const { data: finalProduct } = await supabase
      .from('products')
      .select('inventory_options, stock_quantity')
      .eq('id', product.id)
      .single()

    const finalStockStatus = {
      totalStock: finalProduct.stock_quantity,
      options: finalProduct.inventory_options.map(opt => ({
        color: opt.color,
        size: opt.size,
        stock: opt.stock_quantity
      }))
    }

    console.log('🎉 최종 재고 상태:')
    console.log(`  총 재고: ${finalProduct.stock_quantity}개`)
    finalProduct.inventory_options.forEach(opt => {
      console.log(`  ${opt.color}/${opt.size}: ${opt.stock_quantity}개`)
    })

    console.log('\n🎉 시간순 재고 할당 완료!')

    return NextResponse.json({
      success: true,
      data: {
        processedOrders: orders.length,
        allocationResults,
        finalStockStatus
      },
      message: '시간순 재고 할당이 올바르게 수정되었습니다.'
    })

  } catch (error) {
    console.error('재고 할당 수정 오류:', error)
    return NextResponse.json({
      success: false,
      error: '재고 할당 수정 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 