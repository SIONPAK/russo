import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx'
import { getKoreaTime } from '@/shared/lib/utils'

export async function POST(request: NextRequest) {
  console.log('=== 엑셀 업로드 API 시작 ===')
  
  try {
    const supabase = await createClient()
    const formData = await request.formData()
    const file = formData.get('file') as File

    console.log('업로드된 파일:', file?.name)

    if (!file) {
      console.log('파일이 없음')
      return NextResponse.json({
        success: false,
        error: '업로드할 파일이 없습니다.'
      }, { status: 400 })
    }

    // 파일 확장자 검증
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json({
        success: false,
        error: '엑셀 파일만 업로드 가능합니다. (.xlsx, .xls)'
      }, { status: 400 })
    }

    // 파일 읽기
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(worksheet)

    console.log('파싱된 데이터 개수:', data.length)
    console.log('첫 번째 행 데이터:', data[0])

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: false,
        error: '엑셀 파일에 데이터가 없습니다.'
      }, { status: 400 })
    }

    let successCount = 0
    let errorCount = 0
    const errors: string[] = []
    const allocationResults: any[] = [] // 자동 할당 결과 저장

    // 각 행 처리
    for (let i = 0; i < data.length; i++) {
      try {
        const row = data[i] as any
        const productCode = row['상품코드']?.toString().trim()
        const color = row['색상']?.toString().trim()
        const size = row['사이즈']?.toString().trim()
        const stockQuantity = parseInt(row['재고수량']?.toString() || '0')

        console.log(`${i + 2}행 처리 시작:`, { productCode, color, size, stockQuantity })

        // 필수 필드 검증
        if (!productCode) {
          errors.push(`${i + 2}행: 상품코드가 필요합니다.`)
          errorCount++
          continue
        }

        if (isNaN(stockQuantity)) {
          errors.push(`${i + 2}행: 재고수량이 유효하지 않습니다.`)
          errorCount++
          continue
        }

        // 🎯 음수 입력 시 안전장치: 물리재고가 0 이하로 떨어지지 않도록 제한
        let targetStockQuantity = stockQuantity
        if (stockQuantity < 0) {
          console.log(`⚠️ 음수값 입력 감지: ${stockQuantity}개 → 0개로 제한`)
          targetStockQuantity = 0
        }

        // 🎯 음수값 처리: 음수 입력 시 0으로 처리
        let finalStockQuantity = stockQuantity
        if (stockQuantity < 0) {
          console.log(`⚠️ 음수값 입력 감지: ${stockQuantity} → 0으로 처리`)
          finalStockQuantity = 0
        }

        // 상품 조회
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, name, inventory_options, stock_quantity')
          .eq('code', productCode)
          .single()

        if (productError || !product) {
          console.log(`상품 조회 실패:`, productError)
          errors.push(`${i + 2}행: 상품을 찾을 수 없습니다. (${productCode})`)
          errorCount++
          continue
        }

        console.log(`상품 조회 성공:`, { id: product.id, name: product.name })

        // 새로운 재고 구조 사용 - 물리적 재고 조정
        console.log('🔄 [엑셀 업로드] 물리적 재고 조정:', {
          productId: product.id,
          productName: product.name,
          color,
          size,
          stockQuantity,
          isOption: !!(color && color !== '-' && size !== '-')
        })

        // 현재 물리적 재고 확인 (재할당 로직 판단용)
        let currentPhysicalStock = 0
        
        if (color && color !== '-' && size && size !== '-' && product.inventory_options) {
          const targetOption = product.inventory_options.find((opt: any) => 
            opt.color === color && opt.size === size
          )
          currentPhysicalStock = targetOption ? (targetOption.physical_stock || 0) : 0
        } else {
          currentPhysicalStock = product.inventory_options 
            ? product.inventory_options.reduce((sum: number, opt: any) => sum + (opt.physical_stock || 0), 0)
            : product.stock_quantity || 0
        }

        console.log(`📊 현재 물리적 재고: ${currentPhysicalStock}개 → 목표: ${targetStockQuantity}개`)

        const { data: adjustResult, error: adjustError } = await supabase
          .rpc('adjust_physical_stock', {
            p_product_id: product.id,
            p_color: (color && color !== '-') ? color : null,
            p_size: (size && size !== '-') ? size : null,
            p_quantity_change: targetStockQuantity - currentPhysicalStock, // 절대값 설정을 위한 차이값 계산
            p_reason: `엑셀 일괄 업로드 - 재고 ${targetStockQuantity}개로 설정`
          })

        if (adjustError || !adjustResult) {
          console.error('물리적 재고 조정 실패:', adjustError)
          errors.push(`${i + 2}행: 재고 조정 실패 (${productCode}) - ${adjustError?.message || '알 수 없는 오류'}`)
          errorCount++
          continue
        }

        console.log('✅ [엑셀 업로드] 물리적 재고 조정 완료')

        // 📝 재고 변동 이력 기록
        const quantityChange = targetStockQuantity - currentPhysicalStock
        const { error: movementError } = await supabase
          .from('stock_movements')
          .insert({
            product_id: product.id,
            movement_type: 'adjustment',
            quantity: quantityChange,
            color: (color && color !== '-') ? color : null,
            size: (size && size !== '-') ? size : null,
            notes: `엑셀 일괄 업로드 - 재고 ${targetStockQuantity}개로 설정 (${productCode})`,
            created_at: getKoreaTime()
          })

        if (movementError) {
          console.error('❌ 재고 변동 이력 기록 실패:', movementError)
        } else {
          console.log('✅ 재고 변동 이력 기록 완료')
        }

        // 🎯 재고 증가 시 자동 할당 (재고가 늘어난 경우)
        if (targetStockQuantity > currentPhysicalStock) {
          console.log(`🔄 재고 증가로 자동 할당 시작: ${product.id}, ${color}, ${size}`)
          const autoAllocationResult = await autoAllocateToUnshippedOrders(
            supabase, 
            product.id, 
            (color && color !== '-') ? color : undefined,
            (size && size !== '-') ? size : undefined
          )
          
          if (autoAllocationResult.allocations && autoAllocationResult.allocations.length > 0) {
            allocationResults.push({
              productCode,
              productName: product.name,
              color: (color && color !== '-') ? color : null,
              size: (size && size !== '-') ? size : null,
              inboundQuantity: targetStockQuantity - currentPhysicalStock,
              allocations: autoAllocationResult.allocations
            })
          }
        }
        
        // 🎯 재고 차감 또는 0으로 설정 시 재할당 처리
        if (targetStockQuantity < currentPhysicalStock || targetStockQuantity === 0) {
          console.log(`🔄 재고 차감/0설정으로 재할당 시작: ${product.id}, ${color}, ${size}`)
          console.log(`📊 ${currentPhysicalStock}개 → ${targetStockQuantity}개 (차감: ${currentPhysicalStock - targetStockQuantity}개)`)
          
          const reallocationResult = await reallocateAfterStockReduction(
            supabase, 
            product.id, 
            (color && color !== '-') ? color : undefined,
            (size && size !== '-') ? size : undefined
          )
          
          if (reallocationResult.success) {
            console.log(`✅ 재할당 완료: ${reallocationResult.message}`)
            
            // 재할당 결과 저장 (미출고 처리된 정보 포함)
            allocationResults.push({
              productCode,
              productName: product.name,
              color: (color && color !== '-') ? color : null,
              size: (size && size !== '-') ? size : null,
              type: 'reallocation',
              previousStock: currentPhysicalStock,
              newStock: targetStockQuantity,
              totalAllocated: reallocationResult.totalAllocated || 0,
              affectedOrders: reallocationResult.affectedOrders || 0,
              reallocations: reallocationResult.reallocations || []
            })
          } else {
            console.error(`❌ 재할당 실패: ${reallocationResult.error}`)
          }
        }

        successCount++
        console.log(`${i + 2}행 처리 완료: 성공`)

      } catch (error) {
        console.error(`Row ${i + 2} processing error:`, error)
        errors.push(`${i + 2}행: 처리 중 오류 발생 - ${error}`)
        errorCount++
      }
    }

    console.log(`=== 업로드 완료 ===`)
    console.log(`총 처리: ${data.length}행, 성공: ${successCount}건, 실패: ${errorCount}건`)
    console.log(`자동 할당 결과:`, allocationResults)
    console.log(`오류 목록:`, errors)

    const finalMessage = `재고 업로드 완료: 성공 ${successCount}건, 실패 ${errorCount}건${allocationResults.length > 0 ? `, 자동 할당 ${allocationResults.length}건` : ''}`

    return NextResponse.json({
      success: true,
      data: {
        totalRows: data.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10), // 최대 10개 오류만 표시
        allocations: allocationResults // 자동 할당 결과 포함
      },
      message: finalMessage
    })

  } catch (error) {
    console.error('Inventory upload error:', error)
    return NextResponse.json({
      success: false,
      error: '재고 업로드 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 🎯 재고 차감 후 시간순 재할당 함수
async function reallocateAfterStockReduction(supabase: any, productId: string, color?: string, size?: string) {
  try {
    console.log(`🔄 재고 차감 후 전체 재할당 시작 - 상품: ${productId}, 색상: ${color}, 사이즈: ${size}`)
    
    // 1. 현재 물리적 재고 확인
    const { data: currentProduct, error: productError } = await supabase
      .from('products')
      .select('stock_quantity, inventory_options')
      .eq('id', productId)
      .single()

    if (productError || !currentProduct) {
      console.error('❌ 상품 재고 조회 실패:', productError)
      return { success: false, error: '상품 재고 조회 실패' }
    }

    let currentPhysicalStock = 0
    
    if (currentProduct.inventory_options && Array.isArray(currentProduct.inventory_options) && color && size) {
      const targetOption = currentProduct.inventory_options.find((opt: any) => 
        opt.color === color && opt.size === size
      )
      currentPhysicalStock = targetOption ? targetOption.physical_stock : 0
      console.log(`📦 현재 물리적 재고 (${color}/${size}): ${currentPhysicalStock}`)
    } else {
      // 전체 재고의 경우 물리적 재고 총합 계산
      currentPhysicalStock = currentProduct.inventory_options 
        ? currentProduct.inventory_options.reduce((sum: number, opt: any) => sum + (opt.physical_stock || 0), 0)
        : currentProduct.stock_quantity || 0
      console.log(`📦 현재 물리적 재고 (전체): ${currentPhysicalStock}`)
    }

    // 2. 해당 상품의 모든 미출고 주문 아이템 조회 (시간 빠른 순)
    let orderItemsQuery = supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        product_id,
        product_name,
        color,
        size,
        quantity,
        shipped_quantity,
        orders!inner (
          id,
          order_number,
          status,
          created_at,
          users!inner (
            company_name
          )
        )
      `)
      .eq('product_id', productId)
      .not('orders.status', 'in', '(shipped,delivered,cancelled,returned,refunded)')
      .order('created_at', { ascending: true, foreignTable: 'orders' }) // 시간 빠른 순 (정방향)

    // 색상/사이즈 옵션이 있는 경우 필터링
    if (color && size) {
      orderItemsQuery = orderItemsQuery
        .eq('color', color)
        .eq('size', size)
    }

    console.log(`🔍 미출고 주문 조회 시작`)
    const { data: unshippedItems, error: itemsError } = await orderItemsQuery

    if (itemsError) {
      console.error('❌ 미출고 주문 조회 실패:', itemsError)
      return { success: false, error: '미출고 주문 조회 실패' }
    }

    console.log(`📊 미출고 주문 조회 결과: ${unshippedItems?.length || 0}건`)

    if (!unshippedItems || unshippedItems.length === 0) {
      console.log('📋 미출고 주문이 없습니다.')
      return { success: true, message: '미출고 주문이 없습니다.', reallocations: [] }
    }

    // 3. 모든 주문의 할당량을 초기화 (0으로 설정)
    console.log(`🔄 기존 할당량 초기화 시작`)
    const resetResults = []
    
    for (const item of unshippedItems) {
      const { error: resetError } = await supabase
        .from('order_items')
        .update({
          shipped_quantity: 0
        })
        .eq('id', item.id)

      if (resetError) {
        console.error('❌ 할당량 초기화 실패:', resetError)
        continue
      }

      resetResults.push({
        orderId: item.order_id,
        orderNumber: item.orders.order_number,
        previousShipped: item.shipped_quantity || 0
      })
    }

    console.log(`✅ 할당량 초기화 완료: ${resetResults.length}건`)

    // 4. 물리적 재고를 기준으로 시간 빠른 순으로 재할당
    const reallocations = []
    let remainingStock = currentPhysicalStock
    
    console.log(`🔄 재할당 시작 - 가용 재고: ${remainingStock}개`)
    
    for (const item of unshippedItems) {
      if (remainingStock <= 0) break

      const requestedQuantity = item.quantity
      const allocateQuantity = Math.min(requestedQuantity, remainingStock)
      
      if (allocateQuantity > 0) {
        console.log(`📝 재할당: ${item.orders.order_number} - ${allocateQuantity}개 할당 (요청: ${requestedQuantity})`)
        
        // 출고 수량 업데이트
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            shipped_quantity: allocateQuantity
          })
          .eq('id', item.id)

        if (updateError) {
          console.error('❌ 주문 아이템 업데이트 실패:', updateError)
          continue
        }

        // 재고 변동 이력 기록
        await supabase
          .from('stock_movements')
          .insert({
            product_id: productId,
            movement_type: 'reallocation',
            quantity: -allocateQuantity,
            color: color || null,
            size: size || null,
            notes: `재고 차감 후 전체 재할당 (${item.orders.order_number})`,
            reference_id: item.order_id,
            reference_type: 'order',
            created_at: getKoreaTime()
          })

        reallocations.push({
          orderId: item.order_id,
          orderNumber: item.orders.order_number,
          companyName: item.orders.users.company_name,
          allocatedQuantity: allocateQuantity,
          requestedQuantity: requestedQuantity,
          isFullyAllocated: allocateQuantity >= requestedQuantity
        })

        remainingStock -= allocateQuantity
        
        console.log(`✅ 재할당 완료: ${item.orders.order_number} - ${allocateQuantity}개, 남은 재고: ${remainingStock}개`)
      }
    }

    // 5. 재고 정보 업데이트 (allocated_stock 및 stock_quantity 동기화)
    const totalAllocated = reallocations.reduce((sum, realloc) => sum + realloc.allocatedQuantity, 0)
    
    console.log(`🔄 재고 정보 업데이트: 총 할당량 ${totalAllocated}개`)
    
    if (currentProduct.inventory_options && Array.isArray(currentProduct.inventory_options) && color && size) {
      const updatedOptions = currentProduct.inventory_options.map((option: any) => {
        if (option.color === color && option.size === size) {
          return {
            ...option,
            allocated_stock: totalAllocated,
            stock_quantity: Math.max(0, (option.physical_stock || 0) - totalAllocated)
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
          updated_at: getKoreaTime()
        })
        .eq('id', productId)
    } else {
      // 전체 재고 업데이트
      await supabase
        .from('products')
        .update({
          stock_quantity: Math.max(0, currentPhysicalStock - totalAllocated),
          updated_at: getKoreaTime()
        })
        .eq('id', productId)
    }

    // 6. 영향받은 주문들의 상태 업데이트
    const affectedOrderIds = [...new Set(reallocations.map(realloc => realloc.orderId))]
    
    for (const orderId of affectedOrderIds) {
      // 해당 주문의 모든 아이템 상태 확인
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('quantity, shipped_quantity')
        .eq('order_id', orderId)

      const allFullyShipped = orderItems?.every((item: any) => 
        (item.shipped_quantity || 0) >= item.quantity
      )

      const hasPartialShipped = orderItems?.some((item: any) => 
        (item.shipped_quantity || 0) > 0
      )

      let newStatus = 'pending'
      if (allFullyShipped) {
        newStatus = 'processing' // 전량 할당 완료
      } else if (hasPartialShipped) {
        newStatus = 'partial' // 부분 할당
      }

      await supabase
        .from('orders')
        .update({ 
          status: newStatus,
          updated_at: getKoreaTime()
        })
        .eq('id', orderId)
    }

    console.log(`🎯 전체 재할당 완료: ${totalAllocated}개 할당, ${reallocations.length}개 주문 처리`)

    return { 
      success: true, 
      message: `재고 차감 후 전체 재할당 완료: ${totalAllocated}개 할당, ${reallocations.length}개 주문 처리`, 
      reallocations,
      totalAllocated,
      remainingStock,
      affectedOrders: affectedOrderIds.length
    }

  } catch (error) {
    console.error('❌ 재고 차감 후 전체 재할당 중 오류 발생:', error)
    return { success: false, error: '재고 차감 후 전체 재할당 중 오류가 발생했습니다.' }
  }
}

// 🎯 재고 증가 시 자동 할당 함수 (재고 조정 API와 동일한 로직)
async function autoAllocateToUnshippedOrders(supabase: any, productId: string, color?: string, size?: string) {
  try {
    console.log(`🔄 자동 할당 시작 - 상품: ${productId}, 색상: ${color}, 사이즈: ${size}`)
    
    // 1. 해당 상품의 미출고 주문 아이템 조회 (시간순)
    let orderItemsQuery = supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        product_id,
        product_name,
        color,
        size,
        quantity,
        shipped_quantity,
        unit_price,
        orders!inner (
          id,
          order_number,
          status,
          created_at,
          users!inner (
            company_name
          )
        )
      `)
      .eq('product_id', productId)
      .not('orders.status', 'in', '(shipped,delivered,cancelled,returned,refunded)')
      .order('created_at', { ascending: true, foreignTable: 'orders' }) // 🔧 주문 시간순 정렬

    // 색상/사이즈 옵션이 있는 경우 필터링
    if (color && size) {
      orderItemsQuery = orderItemsQuery
        .eq('color', color)
        .eq('size', size)
    }

    console.log(`🔍 미출고 주문 조회 시작`)
    const { data: orderItems, error: itemsError } = await orderItemsQuery

    if (itemsError) {
      console.error('❌ 미출고 주문 조회 실패:', itemsError)
      return { success: false, error: '미출고 주문 조회 실패', allocations: [] }
    }

    console.log(`📊 전체 주문 조회 결과: ${orderItems?.length || 0}건`)

    if (!orderItems || orderItems.length === 0) {
      console.log('📋 해당 상품의 주문이 없습니다.')
      return { success: true, message: '해당 상품의 주문이 없습니다.', allocations: [] }
    }

    // JavaScript에서 실제 미출고 수량이 있는 아이템만 필터링 후 시간순 재정렬
    const unshippedItems = orderItems
      .filter((item: any) => {
        const shippedQuantity = item.shipped_quantity || 0
        return shippedQuantity < item.quantity
      })
      .sort((a: any, b: any) => {
        // 🔧 필터링 후 시간순으로 재정렬 (가장 빠른 주문부터)
        return new Date(a.orders.created_at).getTime() - new Date(b.orders.created_at).getTime()
      })

    console.log(`📊 미출고 주문 필터링 결과: ${unshippedItems.length}건`)
    
    // 시간순 정렬 디버깅 로그
    console.log(`📅 시간순 정렬 확인 (가장 빠른 주문부터):`)
    unshippedItems.forEach((item: any, index: number) => {
      console.log(`  ${index + 1}. ${item.orders.order_number} (${item.orders.users.company_name}): ${item.orders.created_at}`)
    })

    if (unshippedItems.length === 0) {
      console.log('📋 미출고 주문이 없습니다.')
      return { success: true, message: '미출고 주문이 없습니다.', allocations: [] }
    }

    // 2. 현재 재고 확인
    const { data: currentProduct, error: productError } = await supabase
      .from('products')
      .select('stock_quantity, inventory_options')
      .eq('id', productId)
      .single()

    if (productError || !currentProduct) {
      console.error('❌ 상품 재고 조회 실패:', productError)
      return { success: false, error: '상품 재고 조회 실패', allocations: [] }
    }

    let availableStock = 0
    
    if (currentProduct.inventory_options && Array.isArray(currentProduct.inventory_options) && color && size) {
      const targetOption = currentProduct.inventory_options.find((opt: any) => 
        opt.color === color && opt.size === size
      )
      availableStock = targetOption ? targetOption.stock_quantity : 0
      console.log(`📦 옵션별 재고 (${color}/${size}): ${availableStock}`)
    } else {
      availableStock = currentProduct.stock_quantity || 0
      console.log(`📦 전체 재고: ${availableStock}`)
    }

    if (availableStock <= 0) {
      console.log('❌ 할당할 재고가 없습니다.')
      return { success: true, message: '할당할 재고가 없습니다.', allocations: [] }
    }

    // 3. 재고 할당 (가장 빠른 주문부터)
    const allocations = []
    let remainingStock = availableStock
    
    console.log(`🔄 재고 할당 시작 - 총 ${unshippedItems.length}개 주문 처리`)
    
    for (const item of unshippedItems) {
      const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
      
      if (unshippedQuantity <= 0) {
        continue
      }

      const allocateQuantity = Math.min(unshippedQuantity, remainingStock)
      
      if (allocateQuantity > 0) {
        const newShippedQuantity = (item.shipped_quantity || 0) + allocateQuantity
        
        console.log(`📝 출고 수량 업데이트: ${item.orders.order_number} (${item.orders.users.company_name}) - ${allocateQuantity}개 할당`)
        
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            shipped_quantity: newShippedQuantity
          })
          .eq('id', item.id)

        if (updateError) {
          console.error('❌ 주문 아이템 업데이트 실패:', updateError)
          continue
        }

        // 재고 변동 이력 기록
        await supabase
          .from('stock_movements')
          .insert({
            product_id: productId,
            movement_type: 'order_allocation',
            quantity: -allocateQuantity,
            color: color || null,
            size: size || null,
            notes: `엑셀 업로드 후 자동 할당 (${item.orders.order_number})`,
            reference_id: item.order_id,
            reference_type: 'order',
            created_at: getKoreaTime()
          })

        allocations.push({
          orderId: item.order_id,
          orderNumber: item.orders.order_number,
          companyName: item.orders.users.company_name,
          allocatedQuantity: allocateQuantity,
          createdAt: item.orders.created_at
        })

        remainingStock -= allocateQuantity
        
        console.log(`✅ 할당 완료: ${item.orders.order_number} (${item.orders.users.company_name}) - ${allocateQuantity}개`)
      }

      if (remainingStock <= 0) {
        console.log(`🔚 재고 소진으로 할당 종료`)
        break
      }
    }

    // 4. 자동 할당 후 가용 재고 업데이트
    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocatedQuantity, 0)
    
    if (totalAllocated > 0) {
      console.log(`🔄 자동 할당 후 가용 재고 업데이트: ${totalAllocated}개 차감`)
      
      if (currentProduct.inventory_options && Array.isArray(currentProduct.inventory_options) && color && size) {
        // 현재 할당된 재고 계산
        const { data: allocatedItems, error: allocatedError } = await supabase
          .from('order_items')
          .select('shipped_quantity')
          .eq('product_id', productId)
          .eq('color', color)
          .eq('size', size)
          .not('shipped_quantity', 'is', null)
          .gt('shipped_quantity', 0)

        const currentAllocated = allocatedItems?.reduce((sum: number, item: any) => sum + (item.shipped_quantity || 0), 0) || 0

        const updatedOptions = currentProduct.inventory_options.map((option: any) => {
          if (option.color === color && option.size === size) {
            return {
              ...option,
              allocated_stock: currentAllocated,  // 🎯 할당된 재고 업데이트
              stock_quantity: Math.max(0, (option.physical_stock || 0) - currentAllocated)
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
            updated_at: getKoreaTime()
          })
          .eq('id', productId)
      } else {
        // 전체 재고의 경우 모든 옵션의 allocated_stock 업데이트
        const { data: allocatedItems, error: allocatedError } = await supabase
          .from('order_items')
          .select('color, size, shipped_quantity')
          .eq('product_id', productId)
          .not('shipped_quantity', 'is', null)
          .gt('shipped_quantity', 0)

        const optionAllocations = new Map()
        
        if (allocatedItems) {
          allocatedItems.forEach((item: any) => {
            const key = `${item.color}-${item.size}`
            const allocated = optionAllocations.get(key) || 0
            optionAllocations.set(key, allocated + (item.shipped_quantity || 0))
          })
        }

        const updatedOptions = currentProduct.inventory_options.map((option: any) => {
          const key = `${option.color}-${option.size}`
          const allocatedForOption = optionAllocations.get(key) || 0
          
          return {
            ...option,
            allocated_stock: allocatedForOption,  // 🎯 할당된 재고 업데이트
            stock_quantity: Math.max(0, (option.physical_stock || 0) - allocatedForOption)
          }
        })

        const totalStock = updatedOptions.reduce((sum: number, opt: any) => sum + (opt.stock_quantity || 0), 0)

        await supabase
          .from('products')
          .update({
            inventory_options: updatedOptions,
            stock_quantity: totalStock,
            updated_at: getKoreaTime()
          })
          .eq('id', productId)
      }
    }
    
    console.log(`🎯 자동 할당 완료: ${totalAllocated}개 할당, ${allocations.length}개 주문 처리`)

    return { 
      success: true, 
      message: `${totalAllocated}개 재고가 ${allocations.length}개 주문에 할당되었습니다.`, 
      allocations 
    }

  } catch (error) {
    console.error('❌ 자동 할당 중 오류 발생:', error)
    return { success: false, error: '자동 할당 중 오류가 발생했습니다.', allocations: [] }
  }
} 