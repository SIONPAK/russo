import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { product_id, quantity, reason, color, size } = body

    if (!product_id || !quantity || quantity <= 0) {
      return NextResponse.json({
        success: false,
        error: '상품 ID와 유효한 수량을 입력해주세요.'
      }, { status: 400 })
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({
        success: false,
        error: '입고 사유를 입력해주세요.'
      }, { status: 400 })
    }

    // 상품 정보 조회
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, code, stock_quantity, inventory_options')
      .eq('id', product_id)
      .single()

    if (productError || !product) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 재고 업데이트
    if (product.inventory_options && Array.isArray(product.inventory_options) && color && size) {
      // 옵션별 재고 업데이트
      const updatedOptions = product.inventory_options.map((option: any) => {
        if (option.color === color && option.size === size) {
          return {
            ...option,
            stock_quantity: (option.stock_quantity || 0) + quantity
          }
        }
        return option
      })

      // 전체 재고량 재계산
      const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)

      const { error: updateError } = await supabase
        .from('products')
        .update({
          inventory_options: updatedOptions,
          stock_quantity: totalStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', product_id)

      if (updateError) {
        console.error('Product update error:', updateError)
        return NextResponse.json({
          success: false,
          error: '재고 업데이트에 실패했습니다.'
        }, { status: 500 })
      }
    } else {
      // 전체 재고 업데이트
      const newStock = (product.stock_quantity || 0) + quantity

      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock_quantity: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', product_id)

      if (updateError) {
        console.error('Product update error:', updateError)
        return NextResponse.json({
          success: false,
          error: '재고 업데이트에 실패했습니다.'
        }, { status: 500 })
      }
    }

    // 재고 변동 이력 기록
    const movementData = {
      product_id,
      movement_type: 'inbound',
      quantity: quantity,
      notes: `수동 입고 등록${color && size ? ` (${color}/${size})` : ''} - ${reason.trim()}`,
      created_at: new Date().toISOString()
    }
    
    console.log(`재고 변동 이력 기록 시도:`, movementData)
    
    const { data: movementResult, error: movementError } = await supabase
      .from('stock_movements')
      .insert(movementData)
      .select()

    if (movementError) {
      console.error('Stock movement error:', movementError)
      // 재고 변동 이력 기록 실패는 경고만 하고 계속 진행
      console.warn('재고 변동 이력 기록에 실패했습니다:', movementError)
    } else {
      console.log(`재고 변동 이력 기록 성공:`, movementResult)
    }

    return NextResponse.json({
      success: true,
      message: `${quantity}개 입고가 완료되었습니다.`,
      data: {
        product_id,
        product_name: product.name,
        quantity,
        reason: reason.trim(),
        color,
        size
      }
    })

  } catch (error) {
    console.error('Inbound registration error:', error)
    return NextResponse.json({
      success: false,
      error: '입고 등록 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 