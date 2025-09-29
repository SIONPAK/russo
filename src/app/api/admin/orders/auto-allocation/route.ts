import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    console.log('🔄 [자동 할당] 미출고 주문 자동 할당 시작')

    // 1. 미출고 주문들 조회 (shipped_quantity < quantity)
    const { data: unshippedOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        created_at,
        order_items (
          id,
          product_id,
          color,
          size,
          quantity,
          shipped_quantity,
          product_name,
          products (
            id,
            inventory_options
          )
        )
      `)
      .in('status', ['pending', 'processing', 'confirmed'])
      .order('created_at', { ascending: true }) // 시간순 정렬

    if (ordersError) {
      console.error('❌ [자동 할당] 미출고 주문 조회 실패:', ordersError)
      return NextResponse.json({ 
        success: false, 
        error: '미출고 주문 조회에 실패했습니다.' 
      }, { status: 500 })
    }

    if (!unshippedOrders || unshippedOrders.length === 0) {
      console.log('📋 [자동 할당] 미출고 주문이 없습니다.')
      return NextResponse.json({ 
        success: true, 
        message: '미출고 주문이 없습니다.',
        data: { allocated: 0, total: 0 }
      })
    }

    // 2. 각 주문의 미출고 아이템들 확인 및 할당
    let allocatedCount = 0
    let totalProcessed = 0

    for (const order of unshippedOrders) {
      for (const item of order.order_items) {
        const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
        
        if (unshippedQuantity > 0) {
          totalProcessed++
          
          console.log(`🔍 [자동 할당] 미출고 아이템 확인:`, {
            orderNumber: order.order_number,
            productName: item.product_name,
            color: item.color,
            size: item.size,
            unshippedQuantity
          })

          // 가용 재고 확인
          const { data: availableStock, error: stockError } = await supabase
            .rpc('calculate_available_stock', {
              p_product_id: item.product_id,
              p_color: item.color,
              p_size: item.size
            })

          if (!stockError && availableStock > 0) {
            // 할당 가능한 수량 계산 (가용 재고와 미출고 수량 중 작은 값)
            const allocatableQuantity = Math.min(availableStock, unshippedQuantity)
            
            console.log(`✅ [자동 할당] 재고 할당 시작:`, {
              orderNumber: order.order_number,
              productName: item.product_name,
              color: item.color,
              size: item.size,
              unshippedQuantity,
              availableStock,
              allocatableQuantity
            })

            // 재고 할당
            console.log(`🔄 [자동 할당] allocate_stock RPC 호출 시작:`, {
              productId: item.product_id,
              productName: item.product_name,
              color: item.color,
              size: item.size,
              quantity: allocatableQuantity,
              timestamp: new Date().toISOString()
            })
            
            const { data: allocationResult, error: allocationError } = await supabase
              .rpc('allocate_stock', {
                p_product_id: item.product_id,
                p_quantity: allocatableQuantity,
                p_color: item.color,
                p_size: item.size
              })
              
            console.log(`📊 [자동 할당] allocate_stock RPC 결과:`, {
              success: !allocationError,
              error: allocationError,
              result: allocationResult,
              timestamp: new Date().toISOString()
            })

            if (!allocationError && allocationResult) {
              // 출고 수량 업데이트 (기존 출고수량 + 할당수량)
              const newShippedQuantity = (item.shipped_quantity || 0) + allocatableQuantity
              
              console.log(`🔄 [자동 할당] order_items 업데이트 시작:`, {
                orderItemId: item.id,
                orderNumber: order.order_number,
                productName: item.product_name,
                previousShippedQuantity: item.shipped_quantity || 0,
                newShippedQuantity,
                allocatedQuantity: allocatableQuantity,
                timestamp: new Date().toISOString()
              })
              
              const { error: updateError } = await supabase
                .from('order_items')
                .update({
                  shipped_quantity: newShippedQuantity,
                  allocated_quantity: ((item as any).allocated_quantity || 0) + allocatableQuantity
                })
                .eq('id', item.id)
                
              console.log(`📊 [자동 할당] order_items 업데이트 결과:`, {
                success: !updateError,
                error: updateError,
                timestamp: new Date().toISOString()
              })

              if (!updateError) {
                // 🔧 allocated_stock 업데이트
                console.log(`🔄 [자동 할당] products 조회 시작:`, {
                  productId: item.product_id,
                  productName: item.product_name,
                  timestamp: new Date().toISOString()
                })
                
                const { data: product, error: productError } = await supabase
                  .from('products')
                  .select('inventory_options')
                  .eq('id', item.product_id)
                  .single()
                  
                console.log(`📊 [자동 할당] products 조회 결과:`, {
                  success: !productError,
                  error: productError,
                  hasInventoryOptions: !!product?.inventory_options,
                  timestamp: new Date().toISOString()
                })

                if (!productError && product?.inventory_options) {
                  const updatedOptions = product.inventory_options.map((option: any) => {
                    if (option.color === item.color && option.size === item.size) {
                      const currentAllocated = option.allocated_stock || 0
                      const newAllocated = currentAllocated + allocatableQuantity
                      const physicalStock = option.physical_stock || 0
                      const newStockQuantity = Math.max(0, physicalStock - newAllocated)
                      
                      console.log(`🔧 [자동 할당] allocated_stock 업데이트 상세:`, {
                        productName: item.product_name,
                        color: item.color,
                        size: item.size,
                        currentAllocated,
                        newAllocated,
                        physicalStock,
                        newStockQuantity,
                        allocatedQuantity: allocatableQuantity,
                        timestamp: new Date().toISOString()
                      })
                      
                      return {
                        ...option,
                        allocated_stock: newAllocated,
                        stock_quantity: newStockQuantity
                      }
                    }
                    return option
                  })

                  const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)
                  
                  console.log(`🔄 [자동 할당] products 업데이트 시작:`, {
                    productId: item.product_id,
                    totalStock,
                    updatedOptionsCount: updatedOptions.length,
                    timestamp: new Date().toISOString()
                  })

                  const { error: productUpdateError } = await supabase
                    .from('products')
                    .update({
                      inventory_options: updatedOptions,
                      stock_quantity: totalStock,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', item.product_id)
                    
                  console.log(`📊 [자동 할당] products 업데이트 결과:`, {
                    success: !productUpdateError,
                    error: productUpdateError,
                    productId: item.product_id,
                    timestamp: new Date().toISOString()
                  })

                  if (!productUpdateError) {
                    console.log(`✅ [자동 할당] allocated_stock 업데이트 완료: ${item.product_name} (${item.color}/${item.size})`)
                  } else {
                    console.error(`❌ [자동 할당] allocated_stock 업데이트 실패:`, productUpdateError)
                  }
                }

                allocatedCount++
                console.log(`✅ [자동 할당] 할당 완료:`, {
                  orderNumber: order.order_number,
                  productName: item.product_name,
                  color: item.color,
                  size: item.size,
                  allocatedQuantity: allocatableQuantity,
                  newShippedQuantity,
                  remainingUnshipped: unshippedQuantity - allocatableQuantity
                })
              } else {
                console.error(`❌ [자동 할당] 출고 수량 업데이트 실패:`, updateError)
              }
            } else {
              console.error(`❌ [자동 할당] 재고 할당 실패:`, allocationError)
            }
          } else {
            console.log(`⚠️ [자동 할당] 재고 부족:`, {
              orderNumber: order.order_number,
              productName: item.product_name,
              color: item.color,
              size: item.size,
              unshippedQuantity,
              availableStock: availableStock || 0
            })
          }
        }
      }
    }

    console.log(`✅ [자동 할당] 자동 할당 완료:`, {
      totalProcessed,
      allocatedCount,
      successRate: totalProcessed > 0 ? (allocatedCount / totalProcessed * 100).toFixed(1) + '%' : '0%'
    })

    return NextResponse.json({
      success: true,
      message: `${allocatedCount}건의 미출고 주문이 자동 할당되었습니다.`,
      data: {
        allocated: allocatedCount,
        total: totalProcessed,
        successRate: totalProcessed > 0 ? (allocatedCount / totalProcessed * 100).toFixed(1) + '%' : '0%'
      }
    })

  } catch (error) {
    console.error('❌ [자동 할당] 자동 할당 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '자동 할당 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 