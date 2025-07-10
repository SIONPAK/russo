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
          isOption: !!(color && size && color !== '-' && size !== '-')
        })

        const { data: adjustResult, error: adjustError } = await supabase
          .rpc('adjust_physical_stock', {
            p_product_id: product.id,
            p_color: (color && color !== '-') ? color : null,
            p_size: (size && size !== '-') ? size : null,
            p_quantity_change: stockQuantity,
            p_reason: `엑셀 일괄 업로드 - ${stockQuantity > 0 ? '입고' : '출고'}`
          })

        if (adjustError || !adjustResult) {
          console.error('물리적 재고 조정 실패:', adjustError)
          errors.push(`${i + 2}행: 재고 조정 실패 (${productCode}) - ${adjustError?.message || '알 수 없는 오류'}`)
          errorCount++
          continue
        }

        console.log('✅ [엑셀 업로드] 물리적 재고 조정 완료')

        // 🎯 입고 처리 이후 자동 할당 (양수인 경우만)
        if (stockQuantity > 0) {
          console.log(`🔄 자동 할당 시작: ${product.id}, ${color}, ${size}`)
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
              inboundQuantity: stockQuantity,
              allocations: autoAllocationResult.allocations
            })
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

    // 🎯 재고 업로드 완료 후 전체 재할당 수행
    console.log(`🔄 전체 재할당 시작...`)
    let globalReallocationResult = null
    
    try {
      globalReallocationResult = await performGlobalReallocation(supabase)
      console.log(`✅ 전체 재할당 완료:`, globalReallocationResult)
    } catch (error) {
      console.error(`❌ 전체 재할당 실패:`, error)
    }

    const finalMessage = `재고 업로드 완료: 성공 ${successCount}건, 실패 ${errorCount}건${allocationResults.length > 0 ? `, 자동 할당 ${allocationResults.length}건` : ''}${globalReallocationResult ? `, 전체 재할당 ${globalReallocationResult.totalProcessed}건` : ''}`

    return NextResponse.json({
      success: true,
      data: {
        totalRows: data.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10), // 최대 10개 오류만 표시
        allocations: allocationResults, // 자동 할당 결과 포함
        globalReallocation: globalReallocationResult // 전체 재할당 결과 포함
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

// 🎯 미출고 주문 자동 할당 함수 (새로운 구조 적용)
async function autoAllocateToUnshippedOrders(supabase: any, productId: string, color?: string, size?: string) {
  try {
    console.log(`🔍 미출고 주문 조회 시작 - 상품 ID: ${productId}, 색상: ${color}, 사이즈: ${size}`)
    
    // 1. 해당 상품의 미출고 주문 아이템 조회 (시간순)
    let query = supabase
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
        orders!order_items_order_id_fkey (
          id,
          order_number,
          status,
          created_at,
          users!orders_user_id_fkey (
            company_name,
            customer_grade
          )
        )
      `)
      .eq('product_id', productId)
      .in('orders.status', ['pending', 'processing', 'confirmed', 'partial'])
      .order('orders.created_at', { ascending: true })

    // 색상/사이즈 필터링
    if (color) query = query.eq('color', color)
    if (size) query = query.eq('size', size)

    const { data: unshippedItems, error: queryError } = await query

    if (queryError) {
      console.error('❌ 미출고 주문 조회 실패:', queryError)
      return { success: false, message: '미출고 주문 조회 실패' }
    }

    if (!unshippedItems || unshippedItems.length === 0) {
      console.log('📋 미출고 주문이 없습니다.')
      return { success: true, message: '미출고 주문이 없습니다.', allocations: [] }
    }

    // 실제 미출고 수량이 있는 아이템만 필터링
    const itemsWithUnshipped = unshippedItems.filter(item => {
      const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
      return unshippedQuantity > 0
    })

    console.log(`📋 미출고 아이템 ${itemsWithUnshipped.length}개 발견`)

    if (itemsWithUnshipped.length === 0) {
      return { success: true, message: '할당할 미출고 주문이 없습니다.', allocations: [] }
    }

    // 2. 현재 가용 재고 조회
    const { data: availableStock, error: stockError } = await supabase
      .rpc('calculate_available_stock', {
        p_product_id: productId,
        p_color: color,
        p_size: size
      })

    if (stockError) {
      console.error('❌ 가용 재고 조회 실패:', stockError)
      return { success: false, message: '가용 재고 조회 실패' }
    }

    console.log(`📦 가용 재고: ${availableStock}개`)

    if (availableStock <= 0) {
      return { success: true, message: '가용 재고가 없습니다.', allocations: [] }
    }

    // 3. 시간순으로 재고 할당
    let remainingStock = availableStock
    const allocations = []

    for (const item of itemsWithUnshipped) {
      if (remainingStock <= 0) break

      const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
      const allocateQuantity = Math.min(unshippedQuantity, remainingStock)

      if (allocateQuantity > 0) {
        // 재고 할당 (새로운 함수 사용)
        const { data: allocationResult, error: allocationError } = await supabase
          .rpc('allocate_stock', {
            p_product_id: productId,
            p_color: color,
            p_size: size,
            p_quantity: allocateQuantity
          })

        if (allocationError || !allocationResult) {
          console.error('❌ 재고 할당 실패:', allocationError)
          continue
        }

        // 출고 수량 업데이트
        const newShippedQuantity = (item.shipped_quantity || 0) + allocateQuantity
        
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            shipped_quantity: newShippedQuantity
          })
          .eq('id', item.id)

        if (updateError) {
          console.error('❌ 주문 아이템 업데이트 실패:', updateError)
          // 할당된 재고 롤백
          await supabase.rpc('deallocate_stock', {
            p_product_id: productId,
            p_color: color,
            p_size: size,
            p_quantity: allocateQuantity
          })
          continue
        }

        allocations.push({
          orderId: item.order_id,
          orderNumber: item.orders.order_number,
          companyName: item.orders.users?.company_name || '알 수 없음',
          customerGrade: item.orders.users?.customer_grade || 'normal',
          productName: item.product_name,
          color: item.color,
          size: item.size,
          allocatedQuantity: allocateQuantity,
          totalQuantity: item.quantity,
          previousShipped: item.shipped_quantity || 0,
          newShipped: newShippedQuantity,
          isFullyAllocated: newShippedQuantity >= item.quantity
        })

        remainingStock -= allocateQuantity
        console.log(`✅ 할당 완료: ${item.orders.order_number} - ${allocateQuantity}개`)
      }
    }

    // 4. 주문 상태 업데이트
    const orderIds = [...new Set(allocations.map(alloc => alloc.orderId))]
    
    for (const orderId of orderIds) {
      // 해당 주문의 모든 아이템이 완전히 출고되었는지 확인
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('quantity, shipped_quantity')
        .eq('order_id', orderId)

      const allFullyShipped = orderItems?.every(item => 
        (item.shipped_quantity || 0) >= item.quantity
      )

      const hasPartialShipped = orderItems?.some(item => 
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

    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocatedQuantity, 0)
    
    console.log(`✅ 자동 할당 완료: ${totalAllocated}개 할당, ${allocations.length}개 주문 처리`)

    return {
      success: true,
      message: `${totalAllocated}개 자동 할당 완료`,
      allocations,
      totalAllocated,
      remainingStock
    }

  } catch (error) {
    console.error('❌ 자동 할당 처리 중 오류:', error)
    return { success: false, message: '자동 할당 처리 중 오류 발생' }
  }
}

// 🎯 전체 재할당 함수 (새로운 구조 적용)
async function performGlobalReallocation(supabase: any) {
  try {
    console.log('🔄 전체 재할당 시작 - 부분 할당된 주문 조회')
    
    // 1. 부분 할당된 주문들 조회
    const { data: partialOrders, error: ordersError } = await supabase
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
          shipped_quantity,
          products!inner (
            id,
            stock_quantity,
            inventory_options
          )
        ),
        users!inner (
          company_name
        )
      `)
      .in('status', ['partial', 'confirmed', 'pending'])
      .order('created_at', { ascending: true })

    if (ordersError) {
      console.error('❌ 부분 할당 주문 조회 실패:', ordersError)
      return { success: false, error: '부분 할당 주문 조회 실패' }
    }

    if (!partialOrders || partialOrders.length === 0) {
      console.log('📋 재할당할 주문이 없습니다.')
      return { success: true, message: '재할당할 주문이 없습니다.', totalProcessed: 0 }
    }

    console.log(`📋 전체 주문 ${partialOrders.length}건 조회`)

    // JavaScript에서 실제 미출고 수량이 있는 주문만 필터링
    const ordersWithUnshipped = partialOrders.filter((order: any) => {
      return order.order_items.some((item: any) => {
        const shippedQuantity = item.shipped_quantity || 0
        return shippedQuantity < item.quantity
      })
    })

    console.log(`📋 미출고 수량이 있는 주문 ${ordersWithUnshipped.length}건 발견`)

    if (ordersWithUnshipped.length === 0) {
      return { success: true, message: '재할당할 주문이 없습니다.', totalProcessed: 0 }
    }

    let totalProcessed = 0
    let totalAllocated = 0

    // 2. 각 주문의 미출고 아이템들을 처리
    for (const order of ordersWithUnshipped) {
      for (const item of order.order_items) {
        const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
        
        if (unshippedQuantity <= 0) continue

        // 가용 재고 조회
        const { data: availableStock } = await supabase
          .rpc('calculate_available_stock', {
            p_product_id: item.product_id,
            p_color: item.color,
            p_size: item.size
          })

        if (!availableStock || availableStock <= 0) continue

        const allocateQuantity = Math.min(unshippedQuantity, availableStock)

        if (allocateQuantity > 0) {
          // 재고 할당
          const { data: allocationResult, error: allocationError } = await supabase
            .rpc('allocate_stock', {
              p_product_id: item.product_id,
              p_color: item.color,
              p_size: item.size,
              p_quantity: allocateQuantity
            })

          if (allocationError || !allocationResult) {
            console.error('❌ 재고 할당 실패:', allocationError)
            continue
          }

          // 출고 수량 업데이트
          const newShippedQuantity = (item.shipped_quantity || 0) + allocateQuantity
          
          const { error: updateError } = await supabase
            .from('order_items')
            .update({
              shipped_quantity: newShippedQuantity
            })
            .eq('id', item.id)

          if (updateError) {
            console.error('❌ 주문 아이템 업데이트 실패:', updateError)
            // 할당된 재고 롤백
            await supabase.rpc('deallocate_stock', {
              p_product_id: item.product_id,
              p_color: item.color,
              p_size: item.size,
              p_quantity: allocateQuantity
            })
            continue
          }

          totalAllocated += allocateQuantity
          console.log(`✅ 전체 재할당: ${order.order_number} - ${item.product_name} ${allocateQuantity}개`)
        }
      }
      
      totalProcessed++
    }

    console.log(`✅ 전체 재할당 완료: ${totalProcessed}개 주문 처리, ${totalAllocated}개 할당`)

    return {
      success: true,
      message: `전체 재할당 완료: ${totalProcessed}개 주문 처리`,
      totalProcessed,
      totalAllocated
    }

  } catch (error) {
    console.error('❌ 전체 재할당 중 오류:', error)
    return { success: false, error: '전체 재할당 중 오류 발생' }
  }
} 