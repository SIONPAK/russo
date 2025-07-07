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

    // 헤더 설명 추가
    templateData.push({
      '상품코드': '※ 필수입력 - 기존 상품의 코드를 정확히 입력하세요',
      '색상': '※ 옵션상품인 경우 필수입력 (예: 블랙, 화이트, 레드)',
      '사이즈': '※ 옵션상품인 경우 필수입력 (예: S, M, L, XL, FREE)',
      '재고수량': '※ 필수입력 - 설정할 재고 수량 (숫자만 입력)'
    })

    // 빈 행 추가
    templateData.push({
      '상품코드': '',
      '색상': '',
      '사이즈': '',
      '재고수량': ''
    })

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

    // 첫 번째 행 스타일 설정 (설명 행)
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:D1')
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (!ws[cellAddress]) continue
      
      ws[cellAddress].s = {
        fill: { fgColor: { rgb: 'FFFF00' } }, // 노란색 배경
        font: { bold: true, color: { rgb: 'FF0000' } }, // 빨간색 굵은 글씨
        alignment: { wrapText: true, vertical: 'center' }
      }
    }

    // 시트 추가
    XLSX.utils.book_append_sheet(wb, ws, '재고업로드양식')

    // 사용법 시트 추가
    const instructionData = [
      { '항목': '사용법', '내용': '재고 일괄 업로드 양식 사용 방법' },
      { '항목': '', '내용': '' },
      { '항목': '1. 상품코드', '내용': '기존에 등록된 상품의 코드를 정확히 입력하세요.' },
      { '항목': '', '내용': '상품코드가 잘못되면 업로드가 실패합니다.' },
      { '항목': '', '내용': '' },
      { '항목': '2. 색상/사이즈', '내용': '옵션이 있는 상품의 경우 색상과 사이즈를 정확히 입력하세요.' },
      { '항목': '', '내용': '옵션이 없는 상품의 경우 "-"로 입력하거나 비워두세요.' },
      { '항목': '', '내용': '' },
      { '항목': '3. 재고수량', '내용': '설정할 재고 수량을 숫자로만 입력하세요.' },
      { '항목': '', '내용': '음수는 입력할 수 없습니다.' },
      { '항목': '', '내용': '' },
      { '항목': '4. 업로드 방법', '내용': '1) 노란색 설명 행은 삭제하고 데이터만 남겨주세요.' },
      { '항목': '', '내용': '2) 관리자 > 재고 관리 > 일괄 업로드에서 파일을 선택하세요.' },
      { '항목': '', '내용': '3) 업로드 버튼을 클릭하면 재고가 일괄 업데이트됩니다.' },
      { '항목': '', '내용': '' },
      { '항목': '주의사항', '내용': '업로드 전 반드시 백업을 권장합니다.' },
      { '항목': '', '내용': '잘못된 데이터로 인한 재고 오류는 복구가 어려울 수 있습니다.' }
    ]

    const instructionWs = XLSX.utils.json_to_sheet(instructionData)
    instructionWs['!cols'] = [{ wch: 15 }, { wch: 60 }]
    XLSX.utils.book_append_sheet(wb, instructionWs, '사용법')

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