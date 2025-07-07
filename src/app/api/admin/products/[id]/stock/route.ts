import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { getKoreaTime } from '@/shared/lib/utils'

interface StockAdjustmentRequest {
  adjustment: number
  color?: string
  size?: string
  reason: string
}

// PATCH /api/admin/products/[id]/stock - 재고 조정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: productId } = await params
    const body: StockAdjustmentRequest = await request.json()
    
    const { adjustment, color, size, reason } = body
    
    if (!adjustment || adjustment === 0) {
      return NextResponse.json({
        success: false,
        error: '유효한 재고 조정 수량을 입력해주세요.'
      }, { status: 400 })
    }

    // 상품 정보 조회
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, stock_quantity, inventory_options')
      .eq('id', productId)
      .single()

    if (fetchError || !product) {
      return NextResponse.json({
        success: false,
        error: '상품을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 옵션별 재고 조정
    if (color && size) {
      const inventoryOptions = product.inventory_options || []
      const optionIndex = inventoryOptions.findIndex(
        (option: any) => option.color === color && option.size === size
      )

      if (optionIndex === -1) {
        return NextResponse.json({
          success: false,
          error: '해당 옵션을 찾을 수 없습니다.'
        }, { status: 404 })
      }

      const currentQuantity = inventoryOptions[optionIndex].stock_quantity
      const newQuantity = Math.max(0, currentQuantity + adjustment)

      // 재고가 부족한 경우 체크
      if (adjustment < 0 && currentQuantity < Math.abs(adjustment)) {
        return NextResponse.json({
          success: false,
          error: `현재 재고(${currentQuantity}개)가 부족합니다.`
        }, { status: 400 })
      }

      // 옵션 재고 업데이트
      inventoryOptions[optionIndex].stock_quantity = newQuantity

      // 전체 재고량 재계산
      const totalStock = inventoryOptions.reduce((sum: number, option: any) => sum + option.stock_quantity, 0)

      const { error: updateError } = await supabase
        .from('products')
        .update({
          inventory_options: inventoryOptions,
          stock_quantity: totalStock,
          updated_at: getKoreaTime()
        })
        .eq('id', productId)

      if (updateError) {
        console.error('Stock update error:', updateError)
        return NextResponse.json({
          success: false,
          error: '재고 조정에 실패했습니다.'
        }, { status: 500 })
      }

      // 재고 변동 이력 기록
      const movementData = {
        product_id: productId,
        movement_type: 'adjustment',
        quantity: adjustment,
        notes: `옵션별 재고 조정 (${color}/${size}) - ${reason || '수동 재고 조정'}`,
        created_at: getKoreaTime()
      }
      
      console.log('재고 변동 이력 기록 시도:', movementData)
      
      const { data: movementResult, error: movementError } = await supabase
        .from('stock_movements')
        .insert(movementData)
        .select()
      
      if (movementError) {
        console.error('재고 변동 이력 기록 실패:', movementError)
      } else {
        console.log('재고 변동 이력 기록 성공:', movementResult)
      }

      console.log(`재고 조정 완료: ${product.id} (${color}/${size}) ${currentQuantity} → ${newQuantity}`)

    } else {
      // 일반 재고 조정
      const currentQuantity = product.stock_quantity
      const newQuantity = Math.max(0, currentQuantity + adjustment)

      // 재고가 부족한 경우 체크
      if (adjustment < 0 && currentQuantity < Math.abs(adjustment)) {
        return NextResponse.json({
          success: false,
          error: `현재 재고(${currentQuantity}개)가 부족합니다.`
        }, { status: 400 })
      }

      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock_quantity: newQuantity,
          updated_at: getKoreaTime()
        })
        .eq('id', productId)

      if (updateError) {
        console.error('Stock update error:', updateError)
        return NextResponse.json({
          success: false,
          error: '재고 조정에 실패했습니다.'
        }, { status: 500 })
      }

      // 재고 변동 이력 기록
      const movementData = {
        product_id: productId,
        movement_type: 'adjustment',
        quantity: adjustment,
        notes: `전체 재고 조정 - ${reason || '수동 재고 조정'}`,
        created_at: getKoreaTime()
      }
      
      console.log('재고 변동 이력 기록 시도:', movementData)
      
      const { data: movementResult, error: movementError } = await supabase
        .from('stock_movements')
        .insert(movementData)
        .select()
      
      if (movementError) {
        console.error('재고 변동 이력 기록 실패:', movementError)
      } else {
        console.log('재고 변동 이력 기록 성공:', movementResult)
      }

      console.log(`재고 조정 완료: ${product.id} ${currentQuantity} → ${newQuantity}`)
    }

    return NextResponse.json({
      success: true,
      message: `재고가 ${adjustment > 0 ? '증가' : '감소'}되었습니다.`,
      data: {
        productId,
        adjustment,
        reason
      }
    })

  } catch (error) {
    console.error('Stock adjustment error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 