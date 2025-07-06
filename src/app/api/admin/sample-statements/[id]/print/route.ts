import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx-js-style'

// 샘플 명세서 출력 API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 샘플 명세서 정보 조회
    const { data: statement, error: statementError } = await supabase
      .from('sample_statements')
      .select(`
        *,
        sample_statement_items (
          *,
          products!sample_statement_items_product_id_fkey (
            id,
            name,
            code,
            price
          )
        )
      `)
      .eq('id', id)
      .single()

    if (statementError || !statement) {
      return NextResponse.json({
        success: false,
        error: '샘플 명세서를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    if (!statement.sample_statement_items || statement.sample_statement_items.length === 0) {
      return NextResponse.json({
        success: false,
        error: '샘플 명세서에 아이템이 없습니다.'
      }, { status: 400 })
    }

    // 템플릿 파일 로드
    const templatePath = '/templates/루소_영수증.xlsx'
    const templateUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${templatePath}`
    
    const templateResponse = await fetch(templateUrl)
    if (!templateResponse.ok) {
      throw new Error('템플릿 파일을 불러올 수 없습니다.')
    }

    const templateBuffer = await templateResponse.arrayBuffer()
    const workbook = XLSX.read(templateBuffer, { type: 'array' })
    const worksheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[worksheetName]

    // 색상별 상품 그룹화 (출고명세서와 동일한 로직)
    const groupItemsByColorAndProduct = (items: any[]) => {
      const grouped: { [key: string]: { 
        productName: string
        color: string
        totalQuantity: number
        unitPrice: number
        totalPrice: number
        supplyAmount: number
        taxAmount: number
      }} = {}
      
      items.forEach(item => {
        const color = item.color || '기본'
        const key = `${item.product_name}_${color}`
        
        if (grouped[key]) {
          grouped[key].totalQuantity += item.quantity
          grouped[key].totalPrice += item.total_price
        } else {
          grouped[key] = {
            productName: item.product_name,
            color,
            totalQuantity: item.quantity,
            unitPrice: item.unit_price,
            totalPrice: item.total_price,
            supplyAmount: item.supply_amount,
            taxAmount: item.tax_amount
          }
        }
      })
      
      // 합계 재계산
      Object.keys(grouped).forEach(key => {
        const item = grouped[key]
        item.supplyAmount = item.totalPrice
        item.taxAmount = Math.floor(item.supplyAmount * 0.1)
      })
      
      return Object.values(grouped)
    }

    // 숫자를 한글로 변환하는 함수
    const numberToKorean = (num: number): string => {
      const units = ['', '만', '억', '조']
      const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
      const tens = ['', '십', '이십', '삼십', '사십', '오십', '육십', '칠십', '팔십', '구십']
      
      if (num === 0) return '영'
      
      let result = ''
      let unitIndex = 0
      
      while (num > 0) {
        const chunk = num % 10000
        if (chunk > 0) {
          let chunkStr = ''
          
          const thousands = Math.floor(chunk / 1000)
          const hundreds = Math.floor((chunk % 1000) / 100)
          const tensDigit = Math.floor((chunk % 100) / 10)
          const onesDigit = chunk % 10
          
          if (thousands > 0) {
            chunkStr += (thousands === 1 ? '' : digits[thousands]) + '천'
          }
          if (hundreds > 0) {
            chunkStr += (hundreds === 1 ? '' : digits[hundreds]) + '백'
          }
          if (tensDigit > 0) {
            chunkStr += tensDigit === 1 ? '십' : tens[tensDigit]
          }
          if (onesDigit > 0) {
            chunkStr += digits[onesDigit]
          }
          
          result = chunkStr + units[unitIndex] + result
        }
        
        num = Math.floor(num / 10000)
        unitIndex++
      }
      
      return result + '원정'
    }

    const groupedItems = groupItemsByColorAndProduct(statement.sample_statement_items)
    
    // 총 금액 계산
    const totalAmount = statement.total_amount || 0

    // 제목 서식 설정 - "샘플 명세서"로 변경
    worksheet['!merges'] = worksheet['!merges'] || []
    worksheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } })
    
    worksheet['A1'] = {
      t: 's',
      v: '샘플 명세서',
      s: {
        font: { bold: true, sz: 20 },
        alignment: { horizontal: 'center', vertical: 'center' }
      }
    }
    
    // 행 높이 설정
    if (!worksheet['!rows']) {
      worksheet['!rows'] = []
    }
    worksheet['!rows'][0] = { hpt: 32 }
    
    // 기본 정보 입력
    worksheet['C3'] = { t: 's', v: new Date(statement.statement_date).toLocaleDateString('ko-KR') }
    worksheet['C4'] = { t: 's', v: statement.customer_name }
    
    // 합계금액 (공급가액 + 세액)
    const totalSupplyAmount = statement.supply_amount || 0
    const totalTaxAmount = statement.tax_amount || 0
    const finalTotalAmount = totalSupplyAmount + totalTaxAmount
    
    const totalAmountKorean = numberToKorean(finalTotalAmount)
    const totalAmountFormatted = finalTotalAmount.toLocaleString()
    worksheet['D9'] = {
      t: 's',
      v: totalAmountKorean,
      s: {
        alignment: { horizontal: 'center' },
        font: { bold: true }
      }
    }
    worksheet['I9'] = {
      t: 's',
      v: `₩${totalAmountFormatted}`,
      s: {
        alignment: { horizontal: 'center' },
        font: { bold: true }
      }
    }

    // 상품 정보 입력 (12행부터 21행까지)
    for (let i = 0; i < 10; i++) {
      const row = 12 + i
      
      if (i < groupedItems.length) {
        const item = groupedItems[i]
        
        // 품명 (C열)
        worksheet[`C${row}`] = { 
          t: 's', 
          v: item.productName,
          s: {
            alignment: { horizontal: 'left' }
          }
        }
        
        // 규격/색상 (D열)
        worksheet[`D${row}`] = {
          t: 's',
          v: item.color,
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 수량 (E열)
        worksheet[`E${row}`] = {
          t: 'n',
          v: item.totalQuantity,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 단가 (F열)
        worksheet[`F${row}`] = {
          t: 'n',
          v: item.unitPrice,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 공급가액 (G열)
        worksheet[`G${row}`] = {
          t: 'n',
          v: item.supplyAmount,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 세액 (H열)
        worksheet[`H${row}`] = {
          t: 'n',
          v: item.taxAmount,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 비고 (I열) - 샘플 타입 표시
        const sampleType = statement.sample_statement_items[0]?.sample_type === 'photography' ? '촬영용' : '판매용'
        worksheet[`I${row}`] = { 
          t: 's', 
          v: sampleType,
          s: {
            alignment: { horizontal: 'center' }
          }
        }
      } else {
        // 빈 행 처리
        worksheet[`C${row}`] = { t: 's', v: '' }
        worksheet[`D${row}`] = { t: 's', v: '' }
        worksheet[`E${row}`] = { t: 's', v: '' }
        worksheet[`F${row}`] = { t: 's', v: '' }
        worksheet[`G${row}`] = { t: 's', v: '' }
        worksheet[`H${row}`] = { t: 's', v: '' }
        worksheet[`I${row}`] = { t: 's', v: '' }
      }
    }
    
    // 합계 행 (22행)
    const summaryRow = 22
    
    worksheet[`B${summaryRow}`] = {
      t: 's',
      v: '합    계',
      s: {
        alignment: { horizontal: 'center' },
        font: { bold: true }
      }
    }
    worksheet[`G${summaryRow}`] = {
      t: 'n',
      v: totalSupplyAmount,
      z: '#,##0',
      s: {
        alignment: { horizontal: 'center' },
        font: { bold: true }
      }
    }
    worksheet[`H${summaryRow}`] = {
      t: 'n',
      v: totalTaxAmount,
      z: '#,##0',
      s: {
        alignment: { horizontal: 'center' },
        font: { bold: true }
      }
    }

    // 열 너비 조정
    if (!worksheet['!cols']) {
      worksheet['!cols'] = []
    }
    worksheet['!cols'][0] = { width: 7.1 }   // A열
    worksheet['!cols'][1] = { width: 5 }     // B열
    worksheet['!cols'][2] = { width: 25 }    // C열
    worksheet['!cols'][3] = { width: 15 }    // D열
    worksheet['!cols'][4] = { width: 8 }     // E열
    worksheet['!cols'][5] = { width: 12 }    // F열
    worksheet['!cols'][6] = { width: 12 }    // G열
    worksheet['!cols'][7] = { width: 12 }    // H열
    worksheet['!cols'][8] = { width: 15 }    // I열

    // 엑셀 파일 생성
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })

    // 파일명 생성
    const fileName = `sample_statement_${statement.statement_number}.xlsx`

    // 엑셀 파일을 직접 반환
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Sample statement print API error:', error)
    return NextResponse.json({
      success: false,
      error: '샘플 명세서 출력 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 