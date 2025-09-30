import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { getKoreaTime } from '@/shared/lib/utils'

interface StockAdjustmentRequest {
  adjustment?: number // 조정량 (기존 방식)
  absolute_value?: number // 절대값 설정 (새로운 방식)
  color?: string
  size?: string
  reason: string
}

// 🎯 자동 할당 함수
async function autoAllocateToUnshippedOrders(supabase: any, productId: string, color: string, size: string) {
  try {
    console.log(`🔄 [자동 할당] 시작: ${productId} (${color}/${size})`)
    
    // 1. 미출고 주문 조회 (주문 빠른순)
    const { data: unshippedOrders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        created_at,
        order_items!inner (
          id,
          product_id,
          product_name,
          color,
          size,
          quantity,
          shipped_quantity
        )
      `)
      .in('status', ['pending', 'confirmed', 'processing', 'allocated'])
      .eq('order_items.product_id', productId)
      .eq('order_items.color', color)
      .eq('order_items.size', size)
      .order('created_at', { ascending: true })

    if (ordersError) {
      console.error('❌ [자동 할당] 미출고 주문 조회 실패:', ordersError)
      return { success: false, error: '미출고 주문 조회 실패' }
    }

    if (!unshippedOrders || unshippedOrders.length === 0) {
      console.log(`ℹ️ [자동 할당] 할당할 미출고 주문 없음: ${productId} (${color}/${size})`)
      return { success: true, totalAllocated: 0, allocations: [] }
    }

    // 2. 가용 재고 조회
    const { data: stockData, error: stockError } = await supabase
      .rpc('calculate_available_stock', {
        p_product_id: productId,
        p_color: color,
        p_size: size
      })

    if (stockError) {
      console.error('❌ [자동 할당] 가용 재고 조회 실패:', stockError)
      return { success: false, error: '가용 재고 조회 실패' }
    }

    const availableStock = stockData || 0
    console.log(`📊 [자동 할당] 가용 재고: ${availableStock}개`)

    if (availableStock <= 0) {
      console.log(`ℹ️ [자동 할당] 가용 재고 없음: ${productId} (${color}/${size})`)
      return { success: true, totalAllocated: 0, allocations: [] }
    }

    let totalAllocated = 0
    let remainingStock = availableStock
    const allocations: any[] = []

    // 3. 주문별 할당 처리
    for (const order of unshippedOrders) {
      if (remainingStock <= 0) break

      const orderItems = order.order_items.filter((item: any) => 
        item.product_id === productId && 
        item.color === color && 
        item.size === size
      )

      for (const item of orderItems) {
        if (remainingStock <= 0) break

        const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
        if (unshippedQuantity <= 0) continue

        const allocatableQuantity = Math.min(unshippedQuantity, remainingStock)
        
        console.log(`🔄 [자동 할당] 할당 처리:`, {
          orderNumber: order.order_number,
          productName: item.product_name,
          color: item.color,
          size: item.size,
          unshippedQuantity,
          allocatableQuantity,
          remainingStock
        })

        // 재고 할당
        const { data: allocationResult, error: allocationError } = await supabase
          .rpc('allocate_stock', {
            p_product_id: productId,
            p_quantity: allocatableQuantity,
            p_color: color,
            p_size: size
          })

        if (allocationError) {
          console.error('❌ [자동 할당] 재고 할당 실패:', allocationError)
          continue
        }

        // 출고 수량 업데이트
        const newShippedQuantity = (item.shipped_quantity || 0) + allocatableQuantity
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            shipped_quantity: newShippedQuantity,
            allocated_quantity: ((item as any).allocated_quantity || 0) + allocatableQuantity
          })
          .eq('id', item.id)

        if (updateError) {
          console.error('❌ [자동 할당] 출고 수량 업데이트 실패:', updateError)
          continue
        }

        // allocated_stock 업데이트
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('inventory_options')
          .eq('id', productId)
          .single()

        if (!productError && product?.inventory_options) {
          const updatedOptions = product.inventory_options.map((option: any) => {
            if (option.color === color && option.size === size) {
              const currentAllocated = option.allocated_stock || 0
              const newAllocated = currentAllocated + allocatableQuantity
              
              console.log(`🔧 [자동 할당] allocated_stock 업데이트: ${item.product_name} (${color}/${size}) - ${currentAllocated} → ${newAllocated} (할당: ${allocatableQuantity}개)`)
              
              return {
                ...option,
                allocated_stock: newAllocated,
                stock_quantity: Math.max(0, (option.physical_stock || 0) - newAllocated)
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
            .eq('id', productId)
        }

        totalAllocated += allocatableQuantity
        remainingStock -= allocatableQuantity
        
        allocations.push({
          orderId: order.id,
          orderNumber: order.order_number,
          itemId: item.id,
          allocatedQuantity: allocatableQuantity
        })

        console.log(`✅ [자동 할당] 할당 완료: ${order.order_number} - ${allocatableQuantity}개`)
      }
    }

    console.log(`✅ [자동 할당] 완료: 총 ${totalAllocated}개 할당`)
    return { 
      success: true, 
      totalAllocated, 
      allocations,
      remainingStock 
    }

  } catch (error) {
    console.error('❌ [자동 할당] 오류:', error)
    return { success: false, error: '자동 할당 처리 중 오류 발생' }
  }
}

// PATCH 메서드 추가 (프론트엔드 호환성)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return await handleStockAdjustment(request, params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return await handleStockAdjustment(request, params);
}

// 공통 처리 함수
async function handleStockAdjustment(
  request: NextRequest,
  params: Promise<{ id: string }>
) {
  try {
    const { id: productId } = await params
    const body: StockAdjustmentRequest = await request.json()
    const { adjustment, absolute_value, color, size, reason } = body

    console.log(`🔄 [재고 조정] 시작:`, {
      productId,
      adjustment,
      absolute_value,
      color,
      size,
      reason,
      timestamp: new Date().toISOString()
    })

    // 조정량 계산
    let finalAdjustment: number
    if (absolute_value !== undefined) {
      // 절대값 설정 모드
      const { data: currentProduct, error: currentError } = await supabase
        .from('products')
        .select('inventory_options, stock_quantity')
        .eq('id', productId)
        .single()

      if (currentError || !currentProduct) {
        console.error('❌ [재고 조정] 현재 재고 조회 실패:', currentError)
        return NextResponse.json({
          success: false,
          error: '현재 재고 조회에 실패했습니다.'
        }, { status: 500 })
      }

      let currentPhysicalStock = 0
      if (color && size && currentProduct.inventory_options) {
        const targetOption = currentProduct.inventory_options.find((option: any) => 
          option.color === color && option.size === size
        )
        currentPhysicalStock = targetOption?.physical_stock || 0
      } else {
        currentPhysicalStock = currentProduct.stock_quantity || 0
      }

      finalAdjustment = absolute_value - currentPhysicalStock
      console.log(`📊 [재고 조정] 절대값 설정: 현재 ${currentPhysicalStock}개 → 목표 ${absolute_value}개 (조정: ${finalAdjustment > 0 ? '+' : ''}${finalAdjustment}개)`)
    } else {
      // 상대값 조정 모드
      finalAdjustment = adjustment || 0
      console.log(`📊 [재고 조정] 상대값 조정: ${finalAdjustment > 0 ? '+' : ''}${finalAdjustment}개`)
    }

    if (finalAdjustment === 0) {
      console.log(`ℹ️ [재고 조정] 조정량이 0이므로 처리하지 않음`)
      return NextResponse.json({
        success: true,
        message: '조정량이 0이므로 처리하지 않았습니다.'
      })
    }

    // 옵션별 재고 조정
    if (color && size) {
      console.log(`🔄 [재고 조정] 옵션별 재고 조정 시작 (${color}/${size})`)
      
      // 물리적 재고 조정 RPC 사용
      console.log(`🔄 [재고 조정] add_physical_stock RPC 호출 시작:`, {
        productId,
        color,
        size,
        finalAdjustment,
        reason: `관리자 재고 ${absolute_value !== undefined ? '설정' : '조정'} (${color}/${size}) - ${reason || '수동 재고 조정'}`,
        timestamp: new Date().toISOString()
      })
      
      const { data: adjustResult, error: adjustError } = await supabase
        .rpc('add_physical_stock', {
          p_product_id: productId,
          p_color: color,
          p_size: size,
          p_additional_stock: finalAdjustment,
          p_reason: `관리자 재고 ${absolute_value !== undefined ? '설정' : '조정'} (${color}/${size}) - ${reason || '수동 재고 조정'}`
        })
        
      console.log(`📊 [재고 조정] add_physical_stock RPC 결과:`, {
        success: !adjustError,
        error: adjustError,
        errorMessage: adjustError?.message,
        errorCode: adjustError?.code,
        errorDetails: adjustError?.details,
        result: adjustResult,
        productId,
        timestamp: new Date().toISOString()
      })

      if (adjustError || !adjustResult) {
        console.error('❌ [재고 조정] 물리적 재고 조정 실패:', adjustError)
        return NextResponse.json({
          success: false,
          error: '재고 조정에 실패했습니다.'
        }, { status: 500 })
      }

      console.log(`✅ [재고 조정] 물리적 재고 조정 완료: ${productId} (${color}/${size}) ${finalAdjustment > 0 ? '+' : ''}${finalAdjustment}`)
      
      // 🔧 allocated_stock 초기화 및 stock_quantity 재설정
      const { data: updatedProduct, error: refetchError } = await supabase
        .from('products')
        .select('inventory_options')
        .eq('id', productId)
        .single()

      if (!refetchError && updatedProduct?.inventory_options) {
        console.log(`🔄 [재고 조정] allocated_stock 초기화 및 stock_quantity 재설정 시작:`, {
          productId,
          color,
          size,
          timestamp: new Date().toISOString()
        })
        
        const updatedOptions = updatedProduct.inventory_options.map((option: any) => {
          if (option.color === color && option.size === size) {
            const physicalStock = option.physical_stock || 0
            const previousAllocated = option.allocated_stock || 0
            const previousStockQuantity = option.stock_quantity || 0
            
            console.log(`🔧 [재고 조정] 옵션 초기화 상세:`, {
              productId,
              color,
              size,
              physicalStock,
              previousAllocated,
              previousStockQuantity,
              newAllocated: 0,
              newStockQuantity: physicalStock,
              timestamp: new Date().toISOString()
            })
            
            return {
              ...option,
              allocated_stock: 0,
              stock_quantity: physicalStock
            }
          }
          return option
        })
        
        const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)
        
        console.log(`🔄 [재고 조정] products 업데이트 시작:`, {
          productId,
          totalStock,
          updatedOptionsCount: updatedOptions.length,
          timestamp: new Date().toISOString()
        })
        
        const { error: updateError } = await supabase
          .from('products')
          .update({
            inventory_options: updatedOptions,
            stock_quantity: totalStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', productId)
          
        console.log(`📊 [재고 조정] products 업데이트 결과:`, {
          success: !updateError,
          error: updateError,
          productId,
          timestamp: new Date().toISOString()
        })
        
        if (updateError) {
          console.error('❌ [재고 조정] allocated_stock 초기화 실패:', updateError)
        } else {
          console.log(`✅ [재고 조정] allocated_stock 초기화 완료: ${productId} (${color}/${size})`)
        }
      }
      
      // 🎯 자동 할당 실행
      console.log(`🔄 [재고 조정] 자동 할당 시작:`, {
        productId,
        color,
        size,
        finalAdjustment,
        timestamp: new Date().toISOString()
      })
      
      // 잠시 대기 후 자동 할당 (데이터 동기화)
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const allocationResults = await autoAllocateToUnshippedOrders(supabase, productId, color, size)
      
      console.log(`📊 [재고 조정] 자동 할당 결과:`, {
        success: allocationResults?.success,
        totalAllocated: allocationResults?.totalAllocated,
        allocations: allocationResults?.allocations?.length || 0,
        productId,
        color,
        size,
        timestamp: new Date().toISOString()
      })
      
      if (allocationResults?.success && (allocationResults?.totalAllocated || 0) > 0) {
        console.log(`✅ [재고 조정] 자동 할당 완료: ${allocationResults.totalAllocated || 0}개 할당`)
      } else {
        console.log(`ℹ️ [재고 조정] 자동 할당 결과: 할당할 주문이 없거나 할당 실패`)
      }

      return NextResponse.json({
        success: true,
        message: `재고 조정이 완료되었습니다. (${finalAdjustment > 0 ? '+' : ''}${finalAdjustment}개)`,
        adjustment: finalAdjustment,
        allocationResults
      })

    } else {
      // 전체 재고 조정
      console.log(`🔄 [재고 조정] 전체 재고 조정 시작`)
      
      const { data: adjustResult, error: adjustError } = await supabase
        .rpc('add_physical_stock', {
          p_product_id: productId,
          p_color: null,
          p_size: null,
          p_additional_stock: finalAdjustment,
          p_reason: `관리자 재고 ${absolute_value !== undefined ? '설정' : '조정'} - ${reason || '수동 재고 조정'}`
        })

      if (adjustError || !adjustResult) {
        console.error('❌ [재고 조정] 물리적 재고 조정 실패:', adjustError)
        return NextResponse.json({
          success: false,
          error: '재고 조정에 실패했습니다.'
        }, { status: 500 })
      }

      console.log(`✅ [재고 조정] 물리적 재고 조정 완료: ${productId} ${finalAdjustment > 0 ? '+' : ''}${finalAdjustment}`)

      return NextResponse.json({
        success: true,
        message: `전체 재고 조정이 완료되었습니다. (${finalAdjustment > 0 ? '+' : ''}${finalAdjustment}개)`,
        adjustment: finalAdjustment
      })
    }

  } catch (error) {
    console.error('❌ [재고 조정] 오류:', error)
    return NextResponse.json({
      success: false,
      error: '재고 조정 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}