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

        if (!productCode) {
          errors.push(`${i + 2}행: 상품코드가 없습니다.`)
          errorCount++
          continue
        }

        if (isNaN(stockQuantity)) {
          errors.push(`${i + 2}행: 유효하지 않은 재고수량입니다. (${stockQuantity})`)
          errorCount++
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
              // 현재 재고가 0이면 출고 불가
              errors.push(`${i + 2}행: 현재 재고가 0개이므로 출고할 수 없습니다. (${productCode} - ${color}/${size})`)
              errorCount++
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
            // 양수인 경우 (입고) - 그대로 처리
            newStock = stockQuantity
            actualChangeAmount = stockQuantity - previousStock
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
              notes: `${inventoryOptions[optionIndex].color}/${inventoryOptions[optionIndex].size} 옵션 재고 ${actualChangeAmount > 0 ? '입고' : '출고'} (엑셀 일괄 업로드) - 이전: ${previousStock}, 설정: ${newStock}, 변경: ${actualChangeAmount > 0 ? '+' : ''}${actualChangeAmount}`,
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
              // 현재 재고가 0이면 출고 불가
              errors.push(`${i + 2}행: 현재 재고가 0개이므로 출고할 수 없습니다. (${productCode})`)
              errorCount++
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
            // 양수인 경우 (입고) - 그대로 처리
            newStock = stockQuantity
            actualChangeAmount = stockQuantity - previousStock
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
              notes: `전체 재고 ${actualChangeAmount > 0 ? '입고' : '출고'} (엑셀 일괄 업로드) - 이전: ${previousStock}, 설정: ${newStock}, 변경: ${actualChangeAmount > 0 ? '+' : ''}${actualChangeAmount}`,
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
    console.log(`오류 목록:`, errors)

    return NextResponse.json({
      success: true,
      data: {
        totalRows: data.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10) // 최대 10개 오류만 표시
      },
      message: `재고 업로드 완료: 성공 ${successCount}건, 실패 ${errorCount}건`
    })

  } catch (error) {
    console.error('Inventory upload error:', error)
    return NextResponse.json({
      success: false,
      error: '재고 업로드 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 