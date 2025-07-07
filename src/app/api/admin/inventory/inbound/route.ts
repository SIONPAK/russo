import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

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
          updated_at: getKoreaTime()
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
          updated_at: getKoreaTime()
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
      color: color || null,
      size: size || null,
      notes: `수동 입고 등록${color && size ? ` (${color}/${size})` : ''} - ${reason.trim()}`,
      created_at: getKoreaTime()
    }
    
    console.log(`재고 변동 이력 기록 시도:`, movementData)
    
    const { data: movementResult, error: movementError } = await supabase
      .from('stock_movements')
      .insert(movementData)
      .select()

    if (movementError) {
      console.error('Stock movement error:', movementError)
      console.error('Movement data:', movementData)
      
      // 재고 변동 이력 기록 실패 시 오류 반환 (재고 업데이트는 이미 완료되었으므로 롤백 필요)
      
      // 재고 롤백 시도
      try {
        if (product.inventory_options && Array.isArray(product.inventory_options) && color && size) {
          // 옵션별 재고 롤백
          const rollbackOptions = product.inventory_options.map((option: any) => {
            if (option.color === color && option.size === size) {
              return {
                ...option,
                stock_quantity: (option.stock_quantity || 0) // 원래 수량으로 복원
              }
            }
            return option
          })

          const rollbackTotalStock = rollbackOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)

          await supabase
            .from('products')
            .update({
              inventory_options: rollbackOptions,
              stock_quantity: rollbackTotalStock,
              updated_at: getKoreaTime()
            })
            .eq('id', product_id)
        } else {
          // 전체 재고 롤백
          await supabase
            .from('products')
            .update({
              stock_quantity: product.stock_quantity, // 원래 수량으로 복원
              updated_at: getKoreaTime()
            })
            .eq('id', product_id)
        }
      } catch (rollbackError) {
        console.error('재고 롤백 실패:', rollbackError)
      }
      
      return NextResponse.json({
        success: false,
        error: `재고 변동 이력 기록에 실패했습니다: ${movementError.message}`,
        details: movementError
      }, { status: 500 })
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