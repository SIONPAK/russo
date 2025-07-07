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

    // 오후 3시 이전인지 확인 (한국 시간)
    const now = new Date()
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
    const orderTime = new Date(order.created_at)
    const orderKoreaTime = new Date(orderTime.getTime() + (9 * 60 * 60 * 1000))
    
    // 주문일의 오후 3시 (한국 시간)
    const cutoffTime = new Date(orderKoreaTime)
    cutoffTime.setHours(15, 0, 0, 0)
    
    if (koreaTime >= cutoffTime) {
      return NextResponse.json({
        success: false,
        error: '오후 3시 이후에는 발주서를 삭제할 수 없습니다.'
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