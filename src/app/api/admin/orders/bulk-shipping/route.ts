import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { orderIds } = await request.json()
    
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '주문 ID가 필요합니다.'
      }, { status: 400 })
    }

    const supabase = await createClient()
    
    const results = []
    let successful = 0
    let failed = 0

    for (const orderId of orderIds) {
      try {
        // 주문 정보 조회
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            user_id,
            status,
            order_items (
              id,
              product_id,
              product_name,
              color,
              size,
              quantity,
              shipped_quantity,
              unit_price,
              products (
                id,
                inventory_options,
                stock_quantity
              )
            )
          `)
          .eq('id', orderId)
          .single()

        if (orderError || !order) {
          results.push({
            orderId,
            orderNumber: 'Unknown',
            success: false,
            error: '주문을 찾을 수 없습니다.'
          })
          failed++
          continue
        }

        // 이미 출고된 주문인지 확인
        if (order.status === 'shipped' || order.status === 'delivered') {
          results.push({
            orderId,
            orderNumber: order.order_number,
            success: false,
            error: '이미 출고된 주문입니다.'
          })
          failed++
          continue
        }

        // 각 상품 아이템에 대해 출고 처리
        const updatePromises = []
        let hasShippableItems = false

        for (const item of order.order_items) {
          // 이미 출고된 수량이 있으면 스킵
          if (item.shipped_quantity && item.shipped_quantity > 0) {
            continue
          }

          // 출고 가능한 수량 계산 (주문 수량과 현재 재고 중 작은 값)
          let availableStock = 0
          const product = item.products as any
          
          if (product && product.inventory_options && Array.isArray(product.inventory_options)) {
            // 옵션별 재고 확인
            const option = product.inventory_options.find(
              (opt: any) => opt.color === item.color && opt.size === item.size
            )
            availableStock = option?.stock_quantity || 0
          } else {
            // 전체 재고 확인
            availableStock = (product && product.stock_quantity) || 0
          }

          const shippableQuantity = Math.min(item.quantity, availableStock)
          
          if (shippableQuantity > 0) {
            hasShippableItems = true

            // 출고 수량 업데이트
            updatePromises.push(
              supabase
                .from('order_items')
                .update({
                  shipped_quantity: shippableQuantity,
                  updated_at: new Date().toISOString()
                })
                .eq('id', item.id)
            )

            // 재고 변동 이력 기록
            const movementData = {
              product_id: item.product_id,
              movement_type: 'order_shipment',
              quantity: -shippableQuantity, // 출고는 음수
              notes: `주문 벌크 출고 처리`,
              reference_id: orderId,
              reference_type: 'order',
              created_at: new Date().toISOString()
            }
            
            console.log('재고 변동 이력 기록 시도:', movementData)
            
            updatePromises.push(
              supabase
                .from('stock_movements')
                .insert(movementData)
            )

            // 재고 차감
            if (product && product.inventory_options && Array.isArray(product.inventory_options)) {
              // 옵션별 재고 차감
              const updatedOptions = product.inventory_options.map((opt: any) => {
                if (opt.color === item.color && opt.size === item.size) {
                  return {
                    ...opt,
                    stock_quantity: Math.max(0, opt.stock_quantity - shippableQuantity)
                  }
                }
                return opt
              })

              // 전체 재고량 재계산
              const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + opt.stock_quantity, 0)

              updatePromises.push(
                supabase
                  .from('products')
                  .update({
                    inventory_options: updatedOptions,
                    stock_quantity: totalStock,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', item.product_id)
              )
            } else {
              // 전체 재고 차감
              updatePromises.push(
                supabase
                  .from('products')
                  .update({
                    stock_quantity: Math.max(0, ((product && product.stock_quantity) || 0) - shippableQuantity),
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', item.product_id)
              )
            }
          }
        }

        if (!hasShippableItems) {
          results.push({
            orderId,
            orderNumber: order.order_number,
            success: false,
            error: '출고 가능한 재고가 없습니다.'
          })
          failed++
          continue
        }

        // 모든 업데이트 실행
        const updateResults = await Promise.all(updatePromises)
        const hasError = updateResults.some(result => result.error)

        if (hasError) {
          results.push({
            orderId,
            orderNumber: order.order_number,
            success: false,
            error: '재고 업데이트 중 오류가 발생했습니다.'
          })
          failed++
          continue
        }

        // 주문 상태를 '배송중'으로 업데이트
        const { error: statusError } = await supabase
          .from('orders')
          .update({
            status: 'shipped',
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)

        if (statusError) {
          results.push({
            orderId,
            orderNumber: order.order_number,
            success: false,
            error: '주문 상태 업데이트 실패'
          })
          failed++
          continue
        }

        results.push({
          orderId,
          orderNumber: order.order_number,
          success: true,
          message: '출고 처리 완료'
        })
        successful++

      } catch (error) {
        console.error(`Order ${orderId} shipping error:`, error)
        results.push({
          orderId,
          orderNumber: 'Unknown',
          success: false,
          error: '출고 처리 중 오류가 발생했습니다.'
        })
        failed++
      }
    }

    return NextResponse.json({
      success: true,
      message: `일괄 출고 처리 완료: 성공 ${successful}건, 실패 ${failed}건`,
      data: {
        total: orderIds.length,
        successful,
        failed,
        results
      }
    })

  } catch (error) {
    console.error('Bulk shipping error:', error)
    return NextResponse.json({
      success: false,
      error: '일괄 출고 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 