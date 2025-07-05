import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 권한 확인 제거 - 일반 클라이언트 사용

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: '파일이 업로드되지 않았습니다.' 
      }, { status: 400 })
    }

    // 엑셀 파일 파싱
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    // 헤더 행 제거
    const rows = jsonData.slice(1) as any[]
    
    let updatedCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (const row of rows) {
      try {
        const [
          , // 번호 (사용하지 않음)
          productCode,
          productName,
          category,
          color,
          size,
          totalStock,
          reservedStock,
          availableStock
        ] = row

        if (!productCode || !color || !size) {
          continue // 필수 필드가 없으면 스킵
        }

        // 상품 조회
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id')
          .eq('code', productCode)
          .single()

        if (productError || !product) {
          errors.push(`상품코드 ${productCode}를 찾을 수 없습니다.`)
          errorCount++
          continue
        }

        // 재고 정보 업데이트 또는 생성
        const { error: inventoryError } = await supabase
          .from('inventory')
          .upsert({
            product_id: product.id,
            color: color.toString().trim(),
            size: size.toString().trim(),
            quantity: parseInt(totalStock) || 0,
            reserved_quantity: parseInt(reservedStock) || 0,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'product_id,color,size'
          })

        if (inventoryError) {
          console.error('Inventory update error:', inventoryError)
          errors.push(`${productCode} (${color}/${size}) 재고 업데이트 실패`)
          errorCount++
        } else {
          updatedCount++
        }

      } catch (error) {
        console.error('Row processing error:', error)
        errorCount++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        updatedCount,
        errorCount,
        errors: errors.slice(0, 10) // 최대 10개 오류만 반환
      },
      message: `${updatedCount}개 재고 업데이트 완료${errorCount > 0 ? `, ${errorCount}개 오류` : ''}`
    })

  } catch (error) {
    console.error('Inventory upload error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '재고 업로드 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 