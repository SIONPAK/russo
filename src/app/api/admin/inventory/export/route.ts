import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // 권한 확인 제거 - 일반 클라이언트 사용

    // 상품 및 재고 정보 조회
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        code,
        price,
        category:categories(name),
        inventory:inventory(
          color,
          size,
          quantity,
          reserved_quantity,
          updated_at
        )
      `)
      .order('name')

    if (error) {
      console.error('Products fetch error:', error)
      return NextResponse.json({ 
        success: false, 
        error: '재고 데이터를 조회할 수 없습니다.' 
      }, { status: 500 })
    }

    // 엑셀 데이터 생성
    const excelData: any[] = []
    let rowIndex = 1

    products.forEach(product => {
      if (product.inventory && product.inventory.length > 0) {
        // 옵션별 재고가 있는 경우
        product.inventory.forEach((inv: any) => {
          const availableStock = inv.quantity - (inv.reserved_quantity || 0)
          const stockValue = availableStock * product.price
          
          excelData.push({
            '번호': rowIndex++,
            '상품코드': product.code,
            '상품명': product.name,
            '카테고리': (product.category as any)?.name || '',
            '색상': inv.color,
            '사이즈': inv.size,
            '총재고': inv.quantity,
            '예약재고': inv.reserved_quantity || 0,
            '가용재고': availableStock,
            '단가': product.price,
            '재고금액': stockValue,
            '재고상태': availableStock === 0 ? '품절' : availableStock <= 10 ? '부족' : '정상',
            '최종업데이트': inv.updated_at ? new Date(inv.updated_at).toLocaleDateString('ko-KR') : ''
          })
        })
      } else {
        // 단일 재고인 경우 (기본값 0)
        excelData.push({
          '번호': rowIndex++,
          '상품코드': product.code,
          '상품명': product.name,
          '카테고리': (product.category as any)?.name || '',
          '색상': '-',
          '사이즈': '-',
          '총재고': 0,
          '예약재고': 0,
          '가용재고': 0,
          '단가': product.price,
          '재고금액': 0,
          '재고상태': '품절',
          '최종업데이트': ''
        })
      }
    })

    // 워크북 생성
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // 열 너비 설정
    const colWidths = [
      { wch: 6 },   // 번호
      { wch: 15 },  // 상품코드
      { wch: 25 },  // 상품명
      { wch: 12 },  // 카테고리
      { wch: 10 },  // 색상
      { wch: 10 },  // 사이즈
      { wch: 8 },   // 총재고
      { wch: 8 },   // 예약재고
      { wch: 8 },   // 가용재고
      { wch: 10 },  // 단가
      { wch: 12 },  // 재고금액
      { wch: 8 },   // 재고상태
      { wch: 12 },  // 최종업데이트
    ]
    ws['!cols'] = colWidths

    // 시트 추가
    XLSX.utils.book_append_sheet(wb, ws, '재고현황')

    // 엑셀 파일 생성
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const base64Data = Buffer.from(excelBuffer).toString('base64')

    // 파일명 생성
    const currentDate = new Date().toISOString().split('T')[0]
    const fileName = `재고현황_${currentDate}.xlsx`

    return NextResponse.json({
      success: true,
      data: {
        fileData: base64Data,
        fileName: fileName,
        totalCount: excelData.length
      },
      message: `${excelData.length}개의 재고 데이터가 준비되었습니다.`
    })

  } catch (error) {
    console.error('Inventory export error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '재고 현황 다운로드 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 