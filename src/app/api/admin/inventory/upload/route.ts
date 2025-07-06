import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
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

        if (!productCode) {
          errors.push(`${i + 2}행: 상품코드가 없습니다.`)
          errorCount++
          continue
        }

        if (isNaN(stockQuantity) || stockQuantity < 0) {
          errors.push(`${i + 2}행: 유효하지 않은 재고수량입니다. (${stockQuantity})`)
          errorCount++
          continue
        }

        // 상품 조회
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, name, inventory_options')
          .eq('code', productCode)
          .single()

        if (productError || !product) {
          errors.push(`${i + 2}행: 상품을 찾을 수 없습니다. (${productCode})`)
          errorCount++
          continue
        }

        // 옵션별 재고 업데이트
        if (color && size) {
          const inventoryOptions = product.inventory_options || []
          const optionIndex = inventoryOptions.findIndex(
            (option: any) => option.color === color && option.size === size
          )

          if (optionIndex === -1) {
            errors.push(`${i + 2}행: 해당 옵션을 찾을 수 없습니다. (${color}/${size})`)
            errorCount++
            continue
          }

          // 옵션 재고 업데이트
          inventoryOptions[optionIndex].stock_quantity = stockQuantity

          // 전체 재고량 재계산
          const totalStock = inventoryOptions.reduce((sum: number, option: any) => sum + option.stock_quantity, 0)

          const { error: updateError } = await supabase
            .from('products')
            .update({
              inventory_options: inventoryOptions,
              stock_quantity: totalStock,
              updated_at: new Date().toISOString()
            })
            .eq('id', product.id)

          if (updateError) {
            errors.push(`${i + 2}행: 재고 업데이트 실패 (${productCode})`)
            errorCount++
            continue
          }
        } else {
          // 전체 재고 업데이트 (옵션이 없는 경우)
          const { error: updateError } = await supabase
            .from('products')
            .update({
              stock_quantity: stockQuantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', product.id)

          if (updateError) {
            errors.push(`${i + 2}행: 재고 업데이트 실패 (${productCode})`)
            errorCount++
            continue
          }
        }

        successCount++

      } catch (error) {
        console.error(`Row ${i + 2} processing error:`, error)
        errors.push(`${i + 2}행: 처리 중 오류 발생`)
        errorCount++
      }
    }

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