import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// POST - 운송장 번호 등록 및 출고처리
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { orderIds } = await request.json()

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '주문 ID가 필요합니다.'
      }, { status: 400 })
    }

    console.log('출고처리 시작:', { orderIds })

    // 주문 정보 조회 (order_items 포함)
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          id,
          company_name,
          representative_name
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
      .in('id', orderIds)

    if (orderError) {
      console.error('주문 조회 오류:', orderError)
      return NextResponse.json({
        success: false,
        error: `주문 조회 오류: ${orderError.message}`
      }, { status: 500 })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: '주문을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 운송장 번호 유효성 검사
    const ordersWithoutTracking = orders.filter(order => 
      !order.tracking_number || order.tracking_number.trim() === ''
    )

    if (ordersWithoutTracking.length > 0) {
      const orderNumbers = ordersWithoutTracking.map(order => order.order_number).join(', ')
      return NextResponse.json({
        success: false,
        error: `운송장 번호가 입력되지 않은 주문이 있습니다: ${orderNumbers}`
      }, { status: 400 })
    }

    // 명세서 확정 상태 확인 (미출고건 제외)
    const unconfirmedOrders = orders.filter(order => {
      // 출고수량이 0인 주문(미출고)은 확정명세서 없이 출고처리 가능
      const totalShipped = order.order_items?.reduce((sum: number, item: any) => sum + (item.shipped_quantity || 0), 0) || 0
      const isUnshipped = totalShipped === 0
      
      return order.status !== 'confirmed' && !isUnshipped
    })
    
    if (unconfirmedOrders.length > 0) {
      const orderNumbers = unconfirmedOrders.map(order => order.order_number).join(', ')
      return NextResponse.json({
        success: false,
        error: `명세서가 확정되지 않은 주문이 있습니다: ${orderNumbers} (※ 미출고건은 확정명세서 없이 출고처리 가능)`
      }, { status: 400 })
    }

    const results = []
    const currentTime = getKoreaTime()
    
    for (const order of orders) {
      try {
        // 출고수량 확인 (미출고건 로그용)
        const totalShipped = order.order_items?.reduce((sum: number, item: any) => sum + (item.shipped_quantity || 0), 0) || 0
        const isUnshipped = totalShipped === 0
        
        if (isUnshipped) {
          console.log(`📦 미출고건 처리: ${order.order_number} - 출고수량 0개, 마일리지 차감 0원`)
        }

        // 🎯 출고 처리 (물리재고 차감 + allocated_stock 초기화 + 재할당)
        if (!isUnshipped && order.order_items) {
          for (const item of order.order_items) {
            const shippedQuantity = item.shipped_quantity || 0
            const allocatedQuantity = item.allocated_quantity || 0
            
            if (shippedQuantity > 0) {
              console.log(`🔄 출고 처리 시작: ${item.product_name} (${item.color}/${item.size}) - 출고: ${shippedQuantity}개, 할당: ${allocatedQuantity}개`)
              
              // 1. 물리재고 차감 (JavaScript에서 직접 처리)
              try {
                // 상품 정보 조회
                const { data: product, error: productError } = await supabase
                  .from('products')
                  .select('inventory_options')
                  .eq('id', item.product_id)
                  .single()

                if (productError || !product) {
                  console.error('❌ 상품 정보 조회 실패:', productError)
                  continue
                }

                if (product.inventory_options && Array.isArray(product.inventory_options)) {
                  // 해당 옵션 찾기
                  const optionIndex = product.inventory_options.findIndex((opt: any) => 
                    opt.color === item.color && opt.size === item.size
                  )

                  if (optionIndex !== -1) {
                    const option = product.inventory_options[optionIndex]
                    const currentPhysicalStock = option.physical_stock || 0
                    const newPhysicalStock = Math.max(0, currentPhysicalStock - shippedQuantity)

                    // 옵션 업데이트
                    const updatedOptions = [...product.inventory_options]
                    updatedOptions[optionIndex] = {
                      ...option,
                      physical_stock: newPhysicalStock,
                      allocated_stock: 0,
                      stock_quantity: newPhysicalStock
                    }

                    // 상품 업데이트
                    const { error: updateError } = await supabase
                      .from('products')
                      .update({ 
                        inventory_options: updatedOptions,
                        updated_at: currentTime
                      })
                      .eq('id', item.product_id)

                    if (updateError) {
                      console.error('❌ 재고 업데이트 실패:', updateError)
                    } else {
                      console.log(`✅ 출고 처리 완료: ${item.product_name} (${item.color}/${item.size}) ${shippedQuantity}개`)
                      console.log(`📊 재고 변동: ${currentPhysicalStock}개 → ${newPhysicalStock}개`)
                      
                      // 재고 변동 이력 기록
                      try {
                        await supabase
                          .from('stock_movements')
                          .insert({
                            product_id: item.product_id,
                            movement_type: 'shipment',
                            quantity: -shippedQuantity, // 출고는 음수
                            color: item.color,
                            size: item.size,
                            notes: `출고 처리 - 주문번호: ${order.order_number} (물리재고: ${currentPhysicalStock} → ${newPhysicalStock})`,
                            created_at: currentTime
                          })
                      } catch (historyError) {
                        console.error('❌ 재고 변동 이력 기록 실패:', historyError)
                      }
                    }
                  } else {
                    console.error('❌ 해당 옵션을 찾을 수 없음:', item.color, item.size)
                  }
                } else {
                  console.error('❌ 상품에 옵션 정보가 없음')
                }
              } catch (stockError) {
                console.error('❌ 출고 처리 실패:', stockError)
                // 출고 처리 실패해도 주문은 출고 처리 계속 진행
              }

              // 2. allocated_quantity를 0으로 초기화
              const { error: allocationError } = await supabase
                .from('order_items')
                .update({ 
                  allocated_quantity: 0,
                  updated_at: currentTime
                })
                .eq('id', item.id)

              if (allocationError) {
                console.error('❌ 할당량 초기화 실패:', allocationError)
              } else {
                console.log(`✅ 할당량 초기화 완료: ${item.product_name} (${item.color}/${item.size}) - ${allocatedQuantity}개 → 0개`)
              }
            }
          }
        }

        // 주문 상태를 shipped로 업데이트 (출고완료)
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({ 
            status: 'shipped',
            shipped_at: currentTime,
            updated_at: currentTime
          })
          .eq('id', order.id)

        if (orderUpdateError) {
          console.error('주문 상태 업데이트 오류:', orderUpdateError)
          results.push({
            orderId: order.id,
            orderNumber: order.order_number,
            success: false,
            error: '주문 상태 업데이트 실패'
          })
          continue
        }

        results.push({
          orderId: order.id,
          orderNumber: order.order_number,
          success: true,
          trackingNumber: order.tracking_number,
          orderStatus: 'shipped',
          shippedAt: currentTime
        })

        console.log('출고처리 완료:', {
          orderNumber: order.order_number,
          trackingNumber: order.tracking_number,
          orderStatus: 'shipped'
        })

      } catch (error) {
        console.error('주문 출고처리 오류:', error)
        results.push({
          orderId: order.id,
          orderNumber: order.order_number,
          success: false,
          error: '출고처리 중 오류 발생'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      success: true,
      data: {
        total: results.length,
        success: successCount,
        failed: failCount,
        results: results
      },
      message: `${successCount}개 주문이 출고처리되었습니다.`
    })

  } catch (error) {
    console.error('출고처리 API 오류:', error)
    return NextResponse.json({
      success: false,
      error: '출고처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 