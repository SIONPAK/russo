import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') // 'inbound' | 'outbound'
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!type || !['inbound', 'outbound'].includes(type)) {
      return NextResponse.json({ 
        success: false, 
        error: '유효한 타입을 지정해주세요. (inbound 또는 outbound)' 
      }, { status: 400 })
    }

    // stock_movements 테이블에서 입고/출고 내역 조회
    let query = supabase
      .from('stock_movements')
      .select(`
        *,
        products!stock_movements_product_id_fkey (
          id,
          name,
          code
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // 입고/출고 타입에 따른 필터링
    if (type === 'inbound') {
      // 입고: 재고 증가 (양수) - adjustment(+), purchase, return, sample_return 등
      query = query.gt('quantity', 0)
    } else if (type === 'outbound') {
      // 출고: 재고 감소 (음수) - order_shipment, sample_out, order_allocation, adjustment(-) 등
      query = query.lt('quantity', 0)
    }

    const { data: movements, error: movementsError } = await query

    if (movementsError) {
      console.error('Stock movements fetch error:', movementsError)
      return NextResponse.json({ 
        success: false, 
        error: '재고 변동 내역을 조회할 수 없습니다.' 
      }, { status: 500 })
    }

    // 추가 정보 조회 (주문 정보, 샘플 정보 등)
    const enrichedMovements = await Promise.all(
      (movements || []).map(async (movement) => {
        // 현재 재고 수량 조회
        const { data: currentProduct } = await supabase
          .from('products')
          .select('stock_quantity, inventory_options')
          .eq('id', movement.product_id)
          .single()

        let currentStock = 0
        if (currentProduct) {
          if (movement.color && movement.size && currentProduct.inventory_options) {
            // 옵션별 재고 조회 (해당 색상/사이즈의 현재 재고)
            const option = currentProduct.inventory_options.find(
              (opt: any) => opt.color === movement.color && opt.size === movement.size
            )
            currentStock = option?.stock_quantity || 0
          } else {
            // 전체 재고 조회 (색상/사이즈가 없는 경우)
            currentStock = currentProduct.stock_quantity || 0
          }
        }

        // 해당 입고/출고 이후에 발생한 모든 재고 변동량 계산
        let totalChangesAfter = 0
        const { data: laterMovements } = await supabase
          .from('stock_movements')
          .select('quantity')
          .eq('product_id', movement.product_id)
          .eq('color', movement.color || null)
          .eq('size', movement.size || null)
          .gt('created_at', movement.created_at)

        if (laterMovements) {
          totalChangesAfter = laterMovements.reduce((sum, mv) => sum + (mv.quantity || 0), 0)
        }

        // 해당 입고/출고 시점의 재고 = 현재 재고 - 이후 변동량 + 해당 변동량
        const stockAfterThisMovement = currentStock - totalChangesAfter
        
        const enrichedMovement = {
          ...movement,
          product_name: movement.products?.name || '알 수 없음',
          product_code: movement.products?.code || '',
          color: movement.color || '-',
          size: movement.size || '-',
          quantity: Math.abs(movement.quantity), // 절댓값으로 표시
          stock_quantity: Math.max(0, stockAfterThisMovement), // 해당 입고/출고 후의 재고 수량
        }

        // 참조 타입에 따른 추가 정보 조회
        if (movement.reference_type === 'order' && movement.reference_id) {
          // 주문 정보 조회
          const { data: orderData } = await supabase
            .from('orders')
            .select(`
              order_number,
              users!orders_user_id_fkey (
                company_name
              )
            `)
            .eq('id', movement.reference_id)
            .single()

          if (orderData) {
            enrichedMovement.order_number = orderData.order_number
            enrichedMovement.customer_name = (orderData.users as any)?.company_name
          }
        } else if (movement.reference_type === 'sample' && movement.reference_id) {
          // 샘플 정보 조회
          const { data: sampleData } = await supabase
            .from('samples')
            .select(`
              sample_number,
              customer_name
            `)
            .eq('id', movement.reference_id)
            .single()

          if (sampleData) {
            enrichedMovement.sample_number = sampleData.sample_number
            enrichedMovement.customer_name = sampleData.customer_name
          }
        }

        return enrichedMovement
      })
    )

    return NextResponse.json({
      success: true,
      data: enrichedMovements,
      meta: {
        total: enrichedMovements.length,
        offset,
        limit,
        type
      }
    })

  } catch (error) {
    console.error('Stock movements API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 