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
      const row: any = data[i]
      
      try {
        // 필수 필드 검증
        const productCode = row['상품코드'] || row['코드'] || row['product_code']
        const color = row['색상'] || row['color'] || ''
        const size = row['사이즈'] || row['size'] || ''
        const stockQuantity = parseInt(row['재고수량'] || row['수량'] || row['stock_quantity'] || '0')

        console.log(`${i + 2}행 처리:`, { productCode, color, size, stockQuantity })

        // 설명글이 포함된 행 자동 스킵
        if (!productCode || 
            productCode.includes('※') || 
            productCode.includes('필수입력') || 
            productCode.includes('예:') || 
            productCode.includes('기존 상품의') ||
            productCode.includes('정확히 입력') ||
            color?.includes('※') ||
            color?.includes('필수입력') ||
            color?.includes('예:') ||
            size?.includes('※') ||
            size?.includes('필수입력') ||
            size?.includes('예:')) {
          console.log(`${i + 2}행: 설명글이 포함된 행으로 자동 스킵합니다. (${productCode})`)
          continue
        }

        // 재고수량이 숫자가 아닌 경우 자동 스킵
        if (isNaN(stockQuantity)) {
          console.log(`${i + 2}행: 유효하지 않은 재고수량으로 자동 스킵합니다. (${row['재고수량'] || row['수량'] || row['stock_quantity']})`)
          continue
        }

        // 수량이 0인 경우 스킵 (오류 발생시키지 않음)
        if (stockQuantity === 0) {
          console.log(`${i + 2}행: 수량이 0이므로 스킵합니다. (${productCode})`)
          continue
        }

        // 상품 조회
        console.log(`상품 조회 중: ${productCode}`)
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

        console.log(`상품 조회 성공:`, { id: product.id, name: product.name, currentStock: product.stock_quantity })

        // 옵션별 재고 업데이트
        if (color && size && color !== '-' && size !== '-') {
          console.log(`옵션별 재고 업데이트 시작: ${color}/${size}`)
          const inventoryOptions = product.inventory_options || []
          
          // 대소문자 구분 없이 옵션 찾기
          const optionIndex = inventoryOptions.findIndex(
            (option: any) => 
              option.color.toLowerCase() === color.toLowerCase() && 
              option.size.toLowerCase() === size.toLowerCase()
          )

          if (optionIndex === -1) {
            console.log(`옵션을 찾을 수 없음:`, { color, size, availableOptions: inventoryOptions })
            errors.push(`${i + 2}행: 해당 옵션을 찾을 수 없습니다. (${color}/${size})`)
            errorCount++
            continue
          }

          // 기존 재고량 저장
          const previousStock = inventoryOptions[optionIndex].stock_quantity || 0
          
          // 음수 처리 (출고) 시 현재 재고 초과 방지
          let newStock = stockQuantity
          let actualChangeAmount = stockQuantity - previousStock
          
          if (stockQuantity < 0) {
            // 음수인 경우 (출고)
            if (previousStock === 0) {
              // 현재 재고가 0이면 스킵 (처리하지 않음)
              console.log(`${i + 2}행: 현재 재고가 0개이므로 스킵합니다. (${productCode} - ${color}/${size})`)
              continue
            } else if (Math.abs(stockQuantity) > previousStock) {
              // 출고 요청량이 현재 재고보다 많은 경우, 현재 재고만큼만 출고
              newStock = 0
              actualChangeAmount = -previousStock
              console.log(`출고 요청량(${Math.abs(stockQuantity)})이 현재 재고(${previousStock})보다 많아 현재 재고만큼만 출고합니다.`)
            } else {
              // 정상적인 출고 처리
              newStock = previousStock + stockQuantity // stockQuantity가 음수이므로 덧셈
              actualChangeAmount = stockQuantity
            }
          } else {
            // 양수인 경우 (입고) - 기존 재고에 추가
            newStock = previousStock + stockQuantity
            actualChangeAmount = stockQuantity
          }

          console.log(`옵션 재고 변경:`, { 
            previousStock, 
            requestedStock: stockQuantity, 
            newStock, 
            actualChangeAmount 
          })

          // 옵션 재고 업데이트
          inventoryOptions[optionIndex].stock_quantity = newStock

          // 전체 재고량 재계산
          const totalStock = inventoryOptions.reduce((sum: number, option: any) => sum + (option.stock_quantity || 0), 0)

          console.log(`DB 업데이트 시작: 옵션 재고`)
          const { error: updateError } = await supabase
            .from('products')
            .update({
              inventory_options: inventoryOptions,
              stock_quantity: totalStock,
              updated_at: getKoreaTime()
            })
            .eq('id', product.id)

          if (updateError) {
            console.log(`DB 업데이트 실패:`, updateError)
            errors.push(`${i + 2}행: 재고 업데이트 실패 (${productCode}) - ${updateError.message}`)
            errorCount++
            continue
          }

          console.log(`DB 업데이트 성공: 옵션 재고`)

          // 재고 변동 이력 기록
          if (actualChangeAmount !== 0) {
            const movementData = {
              product_id: product.id,
              movement_type: actualChangeAmount > 0 ? 'inbound' : 'outbound',
              quantity: Math.abs(actualChangeAmount),
              color: inventoryOptions[optionIndex].color,
              size: inventoryOptions[optionIndex].size,
              notes: `${inventoryOptions[optionIndex].color}/${inventoryOptions[optionIndex].size} 옵션 재고 ${actualChangeAmount > 0 ? '입고' : '출고'} (엑셀 일괄 업로드) - 이전: ${previousStock}, 추가: ${stockQuantity}, 결과: ${newStock}`,
              created_at: getKoreaTime()
            }
            
            console.log(`재고 변동 이력 기록 시작:`, movementData)
            const { data: movementResult, error: movementError } = await supabase
              .from('stock_movements')
              .insert(movementData)
              .select()
            
            if (movementError) {
              console.error(`재고 변동 이력 기록 실패:`, movementError)
              errors.push(`${i + 2}행: 재고 변동 이력 기록 실패 - ${movementError.message}`)
              errorCount++
              continue
            } else {
              console.log(`재고 변동 이력 기록 성공:`, movementResult)
            }
          }

          // 🎯 입고 처리 이후 자동 할당 (양수인 경우만)
          if (actualChangeAmount > 0) {
            console.log(`🔄 옵션별 자동 할당 시작: ${product.id}, ${color}, ${size}`)
            const autoAllocationResult = await autoAllocateToUnshippedOrders(supabase, product.id, color, size)
            if (autoAllocationResult.allocations && autoAllocationResult.allocations.length > 0) {
              allocationResults.push({
                productCode,
                productName: product.name,
                color,
                size,
                inboundQuantity: actualChangeAmount,
                allocations: autoAllocationResult.allocations
              })
            }
          }
        } else {
          // 전체 재고 업데이트 (옵션이 없는 경우)
          console.log(`일반 재고 업데이트 시작`)
          const previousStock = product.stock_quantity || 0
          
          // 음수 처리 (출고) 시 현재 재고 초과 방지
          let newStock = stockQuantity
          let actualChangeAmount = stockQuantity - previousStock
          
          if (stockQuantity < 0) {
            // 음수인 경우 (출고)
            if (previousStock === 0) {
              // 현재 재고가 0이면 스킵 (처리하지 않음)
              console.log(`${i + 2}행: 현재 재고가 0개이므로 스킵합니다. (${productCode})`)
              continue
            } else if (Math.abs(stockQuantity) > previousStock) {
              // 출고 요청량이 현재 재고보다 많은 경우, 현재 재고만큼만 출고
              newStock = 0
              actualChangeAmount = -previousStock
              console.log(`출고 요청량(${Math.abs(stockQuantity)})이 현재 재고(${previousStock})보다 많아 현재 재고만큼만 출고합니다.`)
            } else {
              // 정상적인 출고 처리
              newStock = previousStock + stockQuantity // stockQuantity가 음수이므로 덧셈
              actualChangeAmount = stockQuantity
            }
          } else {
            // 양수인 경우 (입고) - 기존 재고에 추가
            newStock = previousStock + stockQuantity
            actualChangeAmount = stockQuantity
          }

          console.log(`일반 재고 변경:`, { 
            previousStock, 
            requestedStock: stockQuantity, 
            newStock, 
            actualChangeAmount 
          })

          console.log(`DB 업데이트 시작: 일반 재고`)
          const { error: updateError } = await supabase
            .from('products')
            .update({
              stock_quantity: newStock,
              updated_at: getKoreaTime()
            })
            .eq('id', product.id)

          if (updateError) {
            console.log(`DB 업데이트 실패:`, updateError)
            errors.push(`${i + 2}행: 재고 업데이트 실패 (${productCode}) - ${updateError.message}`)
            errorCount++
            continue
          }

          console.log(`DB 업데이트 성공: 일반 재고`)

          // 재고 변동 이력 기록
          if (actualChangeAmount !== 0) {
            const movementData = {
              product_id: product.id,
              movement_type: actualChangeAmount > 0 ? 'inbound' : 'outbound',
              quantity: Math.abs(actualChangeAmount),
              color: null,
              size: null,
              notes: `전체 재고 ${actualChangeAmount > 0 ? '입고' : '출고'} (엑셀 일괄 업로드) - 이전: ${previousStock}, 추가: ${stockQuantity}, 결과: ${newStock}`,
              created_at: getKoreaTime()
            }
            
            console.log(`재고 변동 이력 기록 시작:`, movementData)
            const { data: movementResult, error: movementError } = await supabase
              .from('stock_movements')
              .insert(movementData)
              .select()
            
            if (movementError) {
              console.error(`재고 변동 이력 기록 실패:`, movementError)
              errors.push(`${i + 2}행: 재고 변동 이력 기록 실패 - ${movementError.message}`)
              errorCount++
              continue
            } else {
              console.log(`재고 변동 이력 기록 성공:`, movementResult)
            }
          }

          // 🎯 입고 처리 이후 자동 할당 (양수인 경우만)
          if (actualChangeAmount > 0) {
            console.log(`🔄 일반 재고 자동 할당 시작: ${product.id}`)
            const autoAllocationResult = await autoAllocateToUnshippedOrders(supabase, product.id)
            if (autoAllocationResult.allocations && autoAllocationResult.allocations.length > 0) {
              allocationResults.push({
                productCode,
                productName: product.name,
                color: null,
                size: null,
                inboundQuantity: actualChangeAmount,
                allocations: autoAllocationResult.allocations
              })
            }
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

// 🎯 미출고 주문 자동 할당 함수
async function autoAllocateToUnshippedOrders(supabase: any, productId: string, color?: string, size?: string) {
  try {
    console.log(`🔄 자동 할당 시작 - 상품: ${productId}, 색상: ${color}, 사이즈: ${size}`)
    
    // 1. 해당 상품의 미출고 주문 아이템 조회 (시간순)
    // 출고 완료되지 않은 모든 주문 상태 포함
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
      .not('orders.status', 'in', '(shipped,delivered,cancelled,returned,refunded)') // 출고/배송 완료 및 취소/반품 제외
      .order('id', { ascending: true }) // order_items ID로 정렬 (시간순과 유사)

    // 색상/사이즈 옵션이 있는 경우 필터링
    if (color && size) {
      orderItemsQuery = orderItemsQuery
        .eq('color', color)
        .eq('size', size)
    }

    // 실제 미출고 수량이 있는 아이템만 조회 (JavaScript에서 필터링)
    // orderItemsQuery = orderItemsQuery.lt('shipped_quantity', 'quantity')

    const { data: orderItems, error: itemsError } = await orderItemsQuery

    if (itemsError) {
      console.error('미출고 주문 조회 실패:', itemsError)
      return { success: false, error: '미출고 주문 조회 실패' }
    }



    console.log(`📊 전체 주문 조회 결과: ${orderItems?.length || 0}건`)

    if (!orderItems || orderItems.length === 0) {
      console.log('📋 해당 상품의 주문이 없습니다.')
      return { success: true, message: '해당 상품의 주문이 없습니다.', allocations: [] }
    }

    // JavaScript에서 실제 미출고 수량이 있는 아이템만 필터링
    const unshippedItems = orderItems.filter((item: any) => {
      const shippedQuantity = item.shipped_quantity || 0
      return shippedQuantity < item.quantity
    })

    console.log(`📊 미출고 주문 필터링 결과: ${unshippedItems.length}건`)

    if (unshippedItems.length === 0) {
      console.log('📋 미출고 주문이 없습니다.')
      return { success: true, message: '미출고 주문이 없습니다.', allocations: [] }
    }

    console.log(`📋 미출고 주문 ${unshippedItems.length}건 발견`)

    // 2. 현재 재고 확인
    const { data: currentProduct, error: productError } = await supabase
      .from('products')
      .select('stock_quantity, inventory_options')
      .eq('id', productId)
      .single()

    if (productError || !currentProduct) {
      console.error('상품 재고 조회 실패:', productError)
      return { success: false, error: '상품 재고 조회 실패' }
    }

    let availableStock = 0
    
    if (currentProduct.inventory_options && Array.isArray(currentProduct.inventory_options) && color && size) {
      // 옵션별 재고 확인
      const targetOption = currentProduct.inventory_options.find((opt: any) => 
        opt.color === color && opt.size === size
      )
      availableStock = targetOption ? targetOption.stock_quantity : 0
    } else {
      // 전체 재고 확인
      availableStock = currentProduct.stock_quantity || 0
    }

    console.log(`📦 현재 가용 재고: ${availableStock}`)

    if (availableStock <= 0) {
      console.log('❌ 할당할 재고가 없습니다.')
      return { success: true, message: '할당할 재고가 없습니다.', allocations: [] }
    }

    // 3. 시간순으로 재고 할당
    const allocations = []
    let remainingStock = availableStock
    
    for (const item of unshippedItems) {
      const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
      
      if (unshippedQuantity <= 0) {
        continue // 이미 완전히 출고된 아이템은 스킵
      }

      const allocateQuantity = Math.min(unshippedQuantity, remainingStock)
      
      if (allocateQuantity > 0) {
        // 출고 수량 업데이트
        const newShippedQuantity = (item.shipped_quantity || 0) + allocateQuantity
        
        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            shipped_quantity: newShippedQuantity
          })
          .eq('id', item.id)

        if (updateError) {
          console.error('주문 아이템 업데이트 실패:', updateError)
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
            notes: `엑셀 업로드 후 자동 할당 (${item.orders.order_number}) - ${color || ''}/${size || ''}`,
            reference_id: item.order_id,
            reference_type: 'order',
            created_at: getKoreaTime()
          })

        allocations.push({
          orderId: item.order_id,
          orderNumber: item.orders.order_number,
          companyName: item.orders.users.company_name,
          productName: item.product_name,
          color: item.color,
          size: item.size,
          allocatedQuantity: allocateQuantity,
          totalShippedQuantity: newShippedQuantity,
          remainingQuantity: item.quantity - newShippedQuantity
        })

        remainingStock -= allocateQuantity
        
        console.log(`✅ 할당 완료: ${item.orders.order_number} (${item.orders.users.company_name}) - ${allocateQuantity}개`)
      }

      if (remainingStock <= 0) {
        break // 재고 소진
      }
    }

    // 4. 재고 차감 (실제 재고에서 할당량 차감)
    const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocatedQuantity, 0)
    
    if (totalAllocated > 0) {
      if (currentProduct.inventory_options && Array.isArray(currentProduct.inventory_options) && color && size) {
        // 옵션별 재고 차감
        const updatedOptions = currentProduct.inventory_options.map((option: any) => {
          if (option.color === color && option.size === size) {
            return {
              ...option,
              stock_quantity: option.stock_quantity - totalAllocated
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
        // 전체 재고 차감
        await supabase
          .from('products')
          .update({
            stock_quantity: currentProduct.stock_quantity - totalAllocated,
            updated_at: getKoreaTime()
          })
          .eq('id', productId)
      }
    }

    // 5. 주문 상태 업데이트
    const orderIds = [...new Set(allocations.map(alloc => alloc.orderId))]
    
    for (const orderId of orderIds) {
      // 해당 주문의 모든 아이템 확인
      const { data: allOrderItems, error: allItemsError } = await supabase
        .from('order_items')
        .select('quantity, shipped_quantity')
        .eq('order_id', orderId)

      if (allItemsError) {
        console.error('주문 아이템 조회 실패:', allItemsError)
        continue
      }

      // 전체 주문 수량과 출고 수량 비교
      const totalQuantity = allOrderItems.reduce((sum: number, item: any) => sum + item.quantity, 0)
      const totalShipped = allOrderItems.reduce((sum: number, item: any) => sum + (item.shipped_quantity || 0), 0)

      let newStatus = 'confirmed'
      if (totalShipped > 0) {
        newStatus = totalShipped >= totalQuantity ? 'partial' : 'processing'
      }

      await supabase
        .from('orders')
        .update({
          status: newStatus,
          updated_at: getKoreaTime()
        })
        .eq('id', orderId)
    }

    console.log(`🎯 자동 할당 완료: ${totalAllocated}개 할당, ${allocations.length}개 주문 처리`)

    return { 
      success: true, 
      message: `${totalAllocated}개 재고가 ${allocations.length}개 주문에 할당되었습니다.`, 
      allocations 
    }

  } catch (error) {
    console.error('자동 할당 중 오류 발생:', error)
    return { success: false, error: '자동 할당 중 오류가 발생했습니다.' }
  }
}

// 🎯 전체 재할당 함수 - 부분 할당된 주문들을 다시 완전 할당 시도
async function performGlobalReallocation(supabase: any) {
  try {
    console.log('🔄 전체 재할당 시작 - 부분 할당된 주문 조회')
    
    // 1. 부분 할당된 주문들 조회 (partial 상태와 confirmed 상태에서 미출고가 있는 주문들)
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
      console.log('📋 재할당할 주문이 없습니다.')
      return { success: true, message: '재할당할 주문이 없습니다.', totalProcessed: 0 }
    }

    let totalProcessed = 0
    let fullyAllocatedCount = 0
    const reallocationResults = []

    // 2. 각 주문에 대해 재할당 시도
    for (const order of ordersWithUnshipped) {
      try {
        console.log(`🔍 주문 ${order.order_number} 재할당 시작`)
        let orderFullyAllocated = true
        let orderHasNewAllocation = false
        const orderResult = {
          orderId: order.id,
          orderNumber: order.order_number,
          companyName: order.users.company_name,
          items: []
        }

        // 각 주문 아이템에 대해 재할당 시도
        for (const item of order.order_items) {
          const unshippedQuantity = item.quantity - (item.shipped_quantity || 0)
          let newShippedQuantity = item.shipped_quantity || 0
          
          if (unshippedQuantity <= 0) {
            continue // 이미 완전히 출고된 아이템은 스킵
          }

          console.log(`  📦 아이템 ${item.product_name} (${item.color}/${item.size}) - 미출고: ${unshippedQuantity}`)

          // 현재 재고 확인
          const product = item.products
          let availableStock = 0

          if (product.inventory_options && Array.isArray(product.inventory_options) && item.color && item.size) {
            // 옵션별 재고 확인
            const targetOption = product.inventory_options.find((opt: any) => 
              opt.color === item.color && opt.size === item.size
            )
            availableStock = targetOption ? targetOption.stock_quantity : 0
          } else {
            // 전체 재고 확인
            availableStock = product.stock_quantity || 0
          }

          console.log(`  📦 가용 재고: ${availableStock}`)

          if (availableStock > 0) {
            const allocateQuantity = Math.min(unshippedQuantity, availableStock)
            
            if (allocateQuantity > 0) {
              console.log(`  ✅ ${allocateQuantity}개 할당 시도`)
              
              // 출고 수량 업데이트
              newShippedQuantity = (item.shipped_quantity || 0) + allocateQuantity
              
              const { error: updateError } = await supabase
                .from('order_items')
                .update({
                  shipped_quantity: newShippedQuantity
                })
                .eq('id', item.id)

              if (updateError) {
                console.error('❌ 주문 아이템 업데이트 실패:', updateError)
                orderFullyAllocated = false
                continue
              }

              // 재고 차감
              if (product.inventory_options && Array.isArray(product.inventory_options) && item.color && item.size) {
                // 옵션별 재고 차감
                const updatedOptions = product.inventory_options.map((option: any) => {
                  if (option.color === item.color && option.size === item.size) {
                    return {
                      ...option,
                      stock_quantity: option.stock_quantity - allocateQuantity
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
                  .eq('id', product.id)
              } else {
                // 전체 재고 차감
                await supabase
                  .from('products')
                  .update({
                    stock_quantity: product.stock_quantity - allocateQuantity,
                    updated_at: getKoreaTime()
                  })
                  .eq('id', product.id)
              }

              // 재고 변동 이력 기록
              await supabase
                .from('stock_movements')
                .insert({
                  product_id: product.id,
                  movement_type: 'order_allocation',
                  quantity: -allocateQuantity,
                  color: item.color || null,
                  size: item.size || null,
                  notes: `재고 업로드 후 전체 재할당 (${order.order_number})`,
                  reference_id: order.id,
                  reference_type: 'order',
                  created_at: getKoreaTime()
                })

              orderHasNewAllocation = true
              ;(orderResult.items as any).push({
                productName: item.product_name,
                color: item.color,
                size: item.size,
                allocatedQuantity: allocateQuantity,
                totalShippedQuantity: newShippedQuantity,
                remainingQuantity: item.quantity - newShippedQuantity
              })

              console.log(`  ✅ ${allocateQuantity}개 할당 완료`)
            }
          }

          // 아직 미출고 수량이 남아있으면 부분 할당 상태
          if (newShippedQuantity < item.quantity) {
            orderFullyAllocated = false
          }
        }

        // 주문 상태 업데이트
        if (orderFullyAllocated) {
          await supabase
            .from('orders')
            .update({
              status: 'confirmed',
              updated_at: getKoreaTime()
            })
            .eq('id', order.id)
          
          fullyAllocatedCount++
          console.log(`  ✅ 주문 ${order.order_number} 완전 할당 완료`)
        } else if (orderHasNewAllocation) {
          await supabase
            .from('orders')
            .update({
              status: 'partial',
              updated_at: getKoreaTime()
            })
            .eq('id', order.id)
          
          console.log(`  ⚠️  주문 ${order.order_number} 부분 할당 상태`)
        }

        if (orderHasNewAllocation) {
          reallocationResults.push(orderResult)
        }
        
        totalProcessed++

      } catch (error) {
        console.error(`❌ 주문 ${order.order_number} 재할당 실패:`, error)
      }
    }

    console.log(`🎯 전체 재할당 완료: ${totalProcessed}건 처리, ${fullyAllocatedCount}건 완전 할당`)

    return {
      success: true,
      message: `전체 재할당 완료: ${totalProcessed}건 처리, ${fullyAllocatedCount}건 완전 할당`,
      totalProcessed,
      fullyAllocatedCount,
      results: reallocationResults
    }

  } catch (error) {
    console.error('❌ 전체 재할당 중 오류 발생:', error)
    return { success: false, error: '전체 재할당 중 오류가 발생했습니다.' }
  }
} 