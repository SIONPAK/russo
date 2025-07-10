import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx'
import { getKoreaDate } from '@/shared/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 상품 정보 조회 (샘플 데이터용)
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        code,
        inventory_options
      `)
      .limit(5) // 샘플로 5개만

    if (error) {
      console.error('Products fetch error:', error)
      return NextResponse.json({ 
        success: false, 
        error: '상품 데이터를 조회할 수 없습니다.' 
      }, { status: 500 })
    }

    // 양식 데이터 생성
    const templateData: any[] = []

    // 샘플 데이터 추가
    if (products && products.length > 0) {
      products.forEach(product => {
        if (product.inventory_options && Array.isArray(product.inventory_options) && product.inventory_options.length > 0) {
          // 옵션별 재고가 있는 경우
          product.inventory_options.forEach((option: any) => {
            templateData.push({
              '상품코드': product.code,
              '색상': option.color,
              '사이즈': option.size,
              '재고수량': option.stock_quantity || 0
            })
          })
        } else {
          // 단일 재고인 경우
          templateData.push({
            '상품코드': product.code,
            '색상': '-',
            '사이즈': '-',
            '재고수량': 0
          })
        }
      })
    }

    // 워크북 생성
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(templateData)

    // 열 너비 설정
    const colWidths = [
      { wch: 20 },  // 상품코드
      { wch: 15 },  // 색상
      { wch: 15 },  // 사이즈
      { wch: 15 },  // 재고수량
    ]
    ws['!cols'] = colWidths

    // 시트 추가
    XLSX.utils.book_append_sheet(wb, ws, '재고업로드양식')

    // 엑셀 파일 생성
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const base64Data = Buffer.from(excelBuffer).toString('base64')

    // 파일명 생성
    const currentDate = getKoreaDate()
    const fileName = `재고업로드양식_${currentDate}.xlsx`

    return NextResponse.json({
      success: true,
      data: {
        fileData: base64Data,
        fileName: fileName,
        message: '재고 업로드 양식이 준비되었습니다.'
      }
    })

  } catch (error) {
    console.error('Template generation error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '양식 생성 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 