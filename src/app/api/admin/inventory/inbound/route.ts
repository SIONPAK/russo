import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { product_id, quantity, reason, color, size } = body

    if (!product_id || !quantity || quantity === 0) {
      return NextResponse.json({
        success: false,
        error: '상품 ID와 유효한 수량을 입력해주세요.'
      }, { status: 400 })
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json({
        success: false,
        error: `${quantity > 0 ? '입고' : '출고'} 사유를 입력해주세요.`
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

    const isInbound = quantity > 0
    const isOutbound = quantity < 0

    console.log(`🔄 [${isInbound ? '입고' : '출고'} 등록] 물리적 재고 조정:`, {
      productId: product_id,
      productName: product.name,
      color,
      size,
      quantity,
      reason: reason.trim(),
      type: isInbound ? 'inbound' : 'outbound'
    })

    // 재고 조정 처리
    if (quantity > 0) {
      // 🔄 입고 처리 (물리적 재고 증가)
      const { data: adjustResult, error: adjustError } = await supabase
        .rpc('adjust_physical_stock', {
          p_product_id: product_id,
          p_color: color || null,
          p_size: size || null,
          p_quantity_change: quantity,
          p_reason: `관리자 입고 - ${reason}`
        })

      if (adjustError || !adjustResult) {
        console.error('❌ 물리적 재고 조정 실패:', adjustError)
        return NextResponse.json({
          success: false,
          error: '입고 처리에 실패했습니다.'
        }, { status: 500 })
      }

      console.log(`✅ 물리적 재고 조정 완료: ${product_id} ${quantity > 0 ? '+' : ''}${quantity}`)

      // 🔄 재고 조정 후 가용 재고 업데이트 (물리적 재고 기준으로 재계산)
      const { data: updatedProduct, error: refetchError } = await supabase
        .from('products')
        .select('inventory_options')
        .eq('id', product_id)
        .single()

      if (refetchError || !updatedProduct) {
        console.error('❌ 업데이트된 상품 조회 실패:', refetchError)
      } else {
        // 가용 재고 = 물리적 재고로 설정 (재할당 전)
        if (color && size) {
          const updatedOptions = updatedProduct.inventory_options.map((option: any) => {
            if (option.color === color && option.size === size) {
              return {
                ...option,
                stock_quantity: option.physical_stock || 0  // 가용 재고 = 물리적 재고
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
              updated_at: new Date().toISOString()
            })
            .eq('id', product_id)
            
          console.log(`✅ 가용 재고 업데이트 완료: ${product_id} (${color}/${size})`)
        } else {
          // 전체 재고 업데이트
          const updatedOptions = updatedProduct.inventory_options.map((option: any) => ({
            ...option,
            stock_quantity: option.physical_stock || 0  // 가용 재고 = 물리적 재고
          }))

          const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)

          await supabase
            .from('products')
            .update({
              inventory_options: updatedOptions,
              stock_quantity: totalStock,
              updated_at: new Date().toISOString()
            })
            .eq('id', product_id)
            
          console.log(`✅ 가용 재고 업데이트 완료: ${product_id}`)
        }
      }

      // 📝 재고 변동 이력 기록
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: product_id,
          movement_type: 'inbound',
          quantity: quantity,
          color: color || null,
          size: size || null,
          notes: `관리자 입고 - ${reason}`,
          created_at: new Date().toISOString()
        })

      if (movementError) {
        console.error('❌ 재고 변동 이력 기록 실패:', movementError)
      } else {
        console.log('✅ 재고 변동 이력 기록 완료')
      }

      // 🎯 입고 처리 후 자동 할당 처리
      console.log(`🔄 입고 처리 후 자동 할당 시작 - 상품: ${product_id}, 색상: ${color}, 사이즈: ${size}, 입고량: ${quantity}`)
      
      // 잠시 대기 후 자동 할당 (데이터 동기화)
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 🎯 입고 후 재할당 처리는 재고 조정 API에서 처리
      console.log(`✅ 입고 처리 완료 - 재할당은 시스템에서 자동으로 처리됩니다.`)

      return NextResponse.json({
        success: true,
        message: `입고 처리가 완료되었습니다.`,
        data: {
          productId: product_id,
          productName: product.name,
          adjustment: quantity,
          color: color || null,
          size: size || null,
          note: '재고 증가 후 자동 할당이 처리됩니다.'
        }
      })
    } else {
      // 🔄 출고 처리 (물리적 재고 감소)
      const { data: adjustResult, error: adjustError } = await supabase
        .rpc('adjust_physical_stock', {
          p_product_id: product_id,
          p_color: color || null,
          p_size: size || null,
          p_quantity_change: quantity,
          p_reason: `관리자 출고 - ${reason}`
        })

      if (adjustError || !adjustResult) {
        console.error('❌ 물리적 재고 조정 실패:', adjustError)
        return NextResponse.json({
          success: false,
          error: '출고 처리에 실패했습니다.'
        }, { status: 500 })
      }

      console.log(`✅ 물리적 재고 조정 완료: ${product_id} ${quantity}`)

      // 🔄 재고 조정 후 가용 재고 업데이트 (물리적 재고 기준으로 재계산)
      const { data: updatedProduct, error: refetchError } = await supabase
        .from('products')
        .select('inventory_options')
        .eq('id', product_id)
        .single()

      if (refetchError || !updatedProduct) {
        console.error('❌ 업데이트된 상품 조회 실패:', refetchError)
      } else {
        // 가용 재고 = 물리적 재고로 설정 (재할당 전)
        if (color && size) {
          const updatedOptions = updatedProduct.inventory_options.map((option: any) => {
            if (option.color === color && option.size === size) {
              return {
                ...option,
                stock_quantity: option.physical_stock || 0  // 가용 재고 = 물리적 재고
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
              updated_at: new Date().toISOString()
            })
            .eq('id', product_id)
            
          console.log(`✅ 가용 재고 업데이트 완료: ${product_id} (${color}/${size})`)
        } else {
          // 전체 재고 업데이트
          const updatedOptions = updatedProduct.inventory_options.map((option: any) => ({
            ...option,
            stock_quantity: option.physical_stock || 0  // 가용 재고 = 물리적 재고
          }))

          const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)

          await supabase
            .from('products')
            .update({
              inventory_options: updatedOptions,
              stock_quantity: totalStock,
              updated_at: new Date().toISOString()
            })
            .eq('id', product_id)
            
          console.log(`✅ 가용 재고 업데이트 완료: ${product_id}`)
        }
      }

      // 📝 재고 변동 이력 기록
      const { error: movementError } = await supabase
        .from('stock_movements')
        .insert({
          product_id: product_id,
          movement_type: 'outbound',
          quantity: quantity,
          color: color || null,
          size: size || null,
          notes: `관리자 출고 - ${reason}`,
          created_at: new Date().toISOString()
        })

      if (movementError) {
        console.error('❌ 재고 변동 이력 기록 실패:', movementError)
      } else {
        console.log('✅ 재고 변동 이력 기록 완료')
      }

      // 🎯 출고 처리 후 재할당 처리
      console.log(`🔄 출고 처리 후 재할당 시작 - 상품: ${product_id}, 색상: ${color}, 사이즈: ${size}`)
      
      // 잠시 대기 후 재할당 (데이터 동기화)
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // 🎯 출고 후 재할당 처리는 재고 조정 API에서 처리
      console.log(`✅ 출고 처리 완료 - 재할당은 시스템에서 자동으로 처리됩니다.`)

      return NextResponse.json({
        success: true,
        message: `출고 처리가 완료되었습니다.`,
        data: {
          productId: product_id,
          productName: product.name,
          adjustment: quantity,
          color: color || null,
          size: size || null,
          note: '재고 차감 후 자동 재할당이 처리됩니다.'
        }
      })
    }

  } catch (error) {
    console.error('Inbound/Outbound registration error:', error)
    return NextResponse.json({
      success: false,
      error: '재고 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 