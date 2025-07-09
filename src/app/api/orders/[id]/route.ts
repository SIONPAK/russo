import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

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
      .select('*')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({
        success: false,
        error: '주문을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 업무일 기준 당일 생성된 발주서만 수정/삭제 가능 (전일 15:00 ~ 당일 14:59)
    const now = new Date()
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const orderTime = new Date(order.created_at)
    const orderKoreaTime = new Date(orderTime.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    
    // 현재 업무일의 시작 시간 계산 (전일 15:00)
    let workdayStart = new Date(koreaTime)
    if (koreaTime.getHours() < 15) {
      // 현재 시각이 15시 이전이면 전전일 15:00부터 시작
      workdayStart.setDate(workdayStart.getDate() - 2)
    } else {
      // 현재 시각이 15시 이후면 전일 15:00부터 시작
      workdayStart.setDate(workdayStart.getDate() - 1)
    }
    workdayStart.setHours(15, 0, 0, 0)
    
    // 현재 업무일의 종료 시간 계산 (당일 14:59)
    const workdayEnd = new Date(workdayStart)
    workdayEnd.setDate(workdayEnd.getDate() + 1)
    workdayEnd.setHours(14, 59, 59, 999)
    
    // 주문이 현재 업무일 범위에 있는지 확인
    const isCurrentWorkday = orderKoreaTime >= workdayStart && orderKoreaTime <= workdayEnd
    
    if (!isCurrentWorkday) {
      return NextResponse.json({
        success: false,
        error: `당일 생성된 발주서만 삭제할 수 있습니다. (업무일 기준: ${workdayStart.toLocaleDateString('ko-KR')} 15:00 ~ ${workdayEnd.toLocaleDateString('ko-KR')} 14:59)`
      }, { status: 400 })
    }
    
    // 현재 업무일의 삭제 마감시간 (당일 14:59)
    const deleteCutoffTime = new Date(workdayEnd)
    
    console.log('🕐 업무일 기준 시간 확인:', {
      currentTime: koreaTime.toLocaleString('ko-KR'),
      orderTime: orderKoreaTime.toLocaleString('ko-KR'),
      workdayStart: workdayStart.toLocaleString('ko-KR'),
      workdayEnd: workdayEnd.toLocaleString('ko-KR'),
      isCurrentWorkday,
      canDelete: koreaTime <= deleteCutoffTime
    })
    
    if (koreaTime > deleteCutoffTime) {
      return NextResponse.json({
        success: false,
        error: `업무일 기준 오후 3시 이후에는 발주서를 삭제할 수 없습니다. (현재 시각: ${koreaTime.toLocaleString('ko-KR')})`
      }, { status: 400 })
    }

    // 주문 아이템 조회 (재고 복원용)
    const { data: orderItems, error: itemsQueryError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', id)

    if (itemsQueryError) {
      return NextResponse.json({
        success: false,
        error: '주문 아이템 조회에 실패했습니다.'
      }, { status: 500 })
    }

    // 할당된 재고 복원
    for (const item of orderItems || []) {
      if (item.product_id && item.shipped_quantity && item.shipped_quantity > 0) {
        try {
          // 상품 정보 조회
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('id, name, inventory_options, stock_quantity')
            .eq('id', item.product_id)
            .single()

          if (productError || !product) {
            continue
          }

          const restoreQuantity = item.shipped_quantity

          // 옵션별 재고 관리인 경우
          if (product.inventory_options && Array.isArray(product.inventory_options)) {
            const inventoryOption = product.inventory_options.find(
              (option: any) => option.color === item.color && option.size === item.size
            )

            if (inventoryOption) {
              // 옵션별 재고 복원
              const updatedOptions = product.inventory_options.map((option: any) => {
                if (option.color === item.color && option.size === item.size) {
                  return {
                    ...option,
                    stock_quantity: (option.stock_quantity || 0) + restoreQuantity
                  }
                }
                return option
              })

              // 전체 재고량 재계산
              const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)

              await supabase
                .from('products')
                .update({
                  inventory_options: updatedOptions,
                  stock_quantity: totalStock,
                  updated_at: getKoreaTime()
                })
                .eq('id', item.product_id)
            }
          } else {
            // 일반 재고 관리인 경우
            await supabase
              .from('products')
              .update({
                stock_quantity: (product.stock_quantity || 0) + restoreQuantity,
                updated_at: getKoreaTime()
              })
              .eq('id', item.product_id)
          }

          // 재고 변동 이력 기록
          await supabase
            .from('stock_movements')
            .insert({
              product_id: item.product_id,
              movement_type: 'order_cancellation',
              quantity: restoreQuantity,
              color: item.color || null,
              size: item.size || null,
              notes: `주문 삭제로 인한 재고 복원 (${order.order_number}) - ${item.color}/${item.size}`,
              reference_id: order.id,
              reference_type: 'order_delete',
              created_at: getKoreaTime()
            })

        } catch (restoreError) {
          // 재고 복원 실패해도 주문 삭제는 진행
        }
      }
    }

    // 관련 반품명세서 삭제
    const { error: returnStatementError } = await supabase
      .from('return_statements')
      .delete()
      .eq('order_id', id)

    if (returnStatementError) {
      // 반품명세서 삭제 실패해도 주문 삭제는 진행
    }

    // 주문 아이템 삭제
    const { error: itemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', id)

    if (itemsError) {
      return NextResponse.json({
        success: false,
        error: '주문 아이템 삭제에 실패했습니다.'
      }, { status: 500 })
    }

    // 주문 삭제
    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({
        success: false,
        error: '주문 삭제에 실패했습니다.'
      }, { status: 500 })
    }

    // 발주 주문인 경우 시간순 재고 재할당 수행
    if (order.order_type === 'purchase') {
      console.log('🔄 발주 주문 삭제 후 시간순 재고 재할당 시작')
      
      try {
        // 모든 발주 주문 조회 (시간 순서대로)
        const { data: allPurchaseOrders, error: allOrdersError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            created_at,
            status,
            order_items (
              id,
              product_id,
              quantity,
              shipped_quantity,
              color,
              size,
              product_name
            )
          `)
          .eq('order_type', 'purchase')
          .in('status', ['pending', 'confirmed', 'partial'])
          .order('created_at', { ascending: true })
        
        if (!allOrdersError && allPurchaseOrders) {
          console.log(`📊 재할당 대상 발주 주문 수: ${allPurchaseOrders.length}`)
          
          // 모든 상품의 재고를 원래 상태로 복원 (할당 해제)
          const productsToReset = new Set()
          for (const purchaseOrder of allPurchaseOrders) {
            for (const item of purchaseOrder.order_items || []) {
              if (item.product_id && item.shipped_quantity > 0) {
                productsToReset.add(item.product_id)
              }
            }
          }
          
          // 각 상품별로 재고 복원
          for (const productId of productsToReset) {
            try {
              const { data: product, error: productError } = await supabase
                .from('products')
                .select('id, name, inventory_options, stock_quantity')
                .eq('id', productId)
                .single()
              
              if (productError || !product) continue
              
              // 해당 상품의 모든 할당량 계산
              let totalAllocatedByOption = new Map()
              let totalAllocatedGeneral = 0
              
              for (const purchaseOrder of allPurchaseOrders) {
                for (const item of purchaseOrder.order_items || []) {
                  if (item.product_id === productId && item.shipped_quantity > 0) {
                    if (product.inventory_options && Array.isArray(product.inventory_options)) {
                      const optionKey = `${item.color}-${item.size}`
                      const currentAllocated = totalAllocatedByOption.get(optionKey) || 0
                      totalAllocatedByOption.set(optionKey, currentAllocated + item.shipped_quantity)
                    } else {
                      totalAllocatedGeneral += item.shipped_quantity
                    }
                  }
                }
              }
              
              // 재고 복원
              if (product.inventory_options && Array.isArray(product.inventory_options)) {
                const restoredOptions = product.inventory_options.map((option: any) => {
                  const optionKey = `${option.color}-${option.size}`
                  const allocatedAmount = totalAllocatedByOption.get(optionKey) || 0
                  return {
                    ...option,
                    stock_quantity: option.stock_quantity + allocatedAmount
                  }
                })
                
                const totalStock = restoredOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)
                
                await supabase
                  .from('products')
                  .update({
                    inventory_options: restoredOptions,
                    stock_quantity: totalStock,
                    updated_at: getKoreaTime()
                  })
                  .eq('id', productId)
              } else {
                await supabase
                  .from('products')
                  .update({
                    stock_quantity: product.stock_quantity + totalAllocatedGeneral,
                    updated_at: getKoreaTime()
                  })
                  .eq('id', productId)
              }
            } catch (error) {
              console.error(`재고 복원 오류 - 상품 ID: ${productId}`, error)
            }
          }
          
          // 모든 주문의 shipped_quantity 초기화
          for (const purchaseOrder of allPurchaseOrders) {
            await supabase
              .from('order_items')
              .update({ shipped_quantity: 0 })
              .eq('order_id', purchaseOrder.id)
          }
          
          // 시간 순서대로 재고 재할당
          for (const purchaseOrder of allPurchaseOrders) {
            let orderFullyAllocated = true
            let orderHasPartialAllocation = false
            
            for (const item of purchaseOrder.order_items || []) {
              if (!item.product_id || item.quantity <= 0) continue
              
              try {
                const { data: product, error: productError } = await supabase
                  .from('products')
                  .select('id, name, inventory_options, stock_quantity')
                  .eq('id', item.product_id)
                  .single()
                
                if (productError || !product) {
                  orderFullyAllocated = false
                  continue
                }
                
                let allocatedQuantity = 0
                const requestedQuantity = item.quantity
                
                if (product.inventory_options && Array.isArray(product.inventory_options)) {
                  const inventoryOption = product.inventory_options.find(
                    (option: any) => option.color === item.color && option.size === item.size
                  )
                  
                  if (inventoryOption) {
                    const availableStock = inventoryOption.stock_quantity || 0
                    allocatedQuantity = Math.min(requestedQuantity, availableStock)
                    
                    if (allocatedQuantity > 0) {
                      const updatedOptions = product.inventory_options.map((option: any) => {
                        if (option.color === item.color && option.size === item.size) {
                          return {
                            ...option,
                            stock_quantity: option.stock_quantity - allocatedQuantity
                          }
                        }
                        return option
                      })
                      
                      const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)
                      
                      await supabase
                        .from('products')
                        .update({
                          inventory_options: updatedOptions,
                          stock_quantity: totalStock,
                          updated_at: getKoreaTime()
                        })
                        .eq('id', item.product_id)
                    }
                  }
                } else {
                  const availableStock = product.stock_quantity || 0
                  allocatedQuantity = Math.min(requestedQuantity, availableStock)
                  
                  if (allocatedQuantity > 0) {
                    await supabase
                      .from('products')
                      .update({
                        stock_quantity: availableStock - allocatedQuantity,
                        updated_at: getKoreaTime()
                      })
                      .eq('id', item.product_id)
                  }
                }
                
                // 주문 아이템에 할당된 수량 업데이트
                if (allocatedQuantity > 0) {
                  await supabase
                    .from('order_items')
                    .update({
                      shipped_quantity: allocatedQuantity
                    })
                    .eq('id', item.id)
                  
                  // 재고 변동 이력 기록
                  await supabase
                    .from('stock_movements')
                    .insert({
                      product_id: item.product_id,
                      movement_type: 'order_allocation',
                      quantity: -allocatedQuantity,
                      color: item.color || null,
                      size: item.size || null,
                      notes: `주문 삭제 후 시간순 재할당 (${purchaseOrder.order_number}) - ${item.color}/${item.size}`,
                      reference_id: purchaseOrder.id,
                      reference_type: 'order',
                      created_at: getKoreaTime()
                    })
                }
                
                // 할당 상태 확인
                if (allocatedQuantity < requestedQuantity) {
                  orderFullyAllocated = false
                  if (allocatedQuantity > 0) {
                    orderHasPartialAllocation = true
                  }
                }
                
              } catch (error) {
                console.error(`재고 할당 오류 - 상품 ID: ${item.product_id}`, error)
                orderFullyAllocated = false
              }
            }
            
            // 주문 상태 업데이트
            let orderStatus = 'pending'  // 대기중
            if (orderFullyAllocated) {
              orderStatus = 'processing' // 작업중 (전량 할당 완료)
            } else if (orderHasPartialAllocation) {
              orderStatus = 'processing' // 작업중 (부분 할당)
            }
            
            await supabase
              .from('orders')
              .update({
                status: orderStatus,
                updated_at: getKoreaTime()
              })
              .eq('id', purchaseOrder.id)
          }
          
          console.log('🎉 발주 주문 삭제 후 시간순 재고 재할당 완료')
        }
      } catch (reallocationError) {
        console.error('시간순 재고 재할당 오류:', reallocationError)
        // 재할당 실패해도 주문 삭제는 성공으로 처리
      }
    }

    return NextResponse.json({
      success: true,
      message: '발주서가 삭제되었습니다.'
    })

  } catch (error) {
    console.error('Order delete error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 