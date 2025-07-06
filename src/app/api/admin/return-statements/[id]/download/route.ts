import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx-js-style'

// 반품명세서 다운로드 API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 반품명세서 정보 조회
    const { data: statement, error: statementError } = await supabase
      .from('return_statements')
      .select(`
        *,
        orders!return_statements_order_id_fkey (
          *,
          users!orders_user_id_fkey (
            id,
            company_name,
            representative_name,
            email,
            phone,
            address,
            business_number
          )
        )
      `)
      .eq('id', id)
      .single()

    if (statementError || !statement) {
      return NextResponse.json({
        success: false,
        error: '반품명세서를 찾을 수 없습니다.'
      }, { status: 404 })
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

    // 제목 서식 설정
    worksheet['!merges'] = worksheet['!merges'] || []
    worksheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } })
    
    worksheet['A1'] = {
      t: 's',
      v: '반품명세서',
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
    worksheet['C3'] = { t: 's', v: new Date().toLocaleDateString('ko-KR') }
    worksheet['C4'] = { t: 's', v: statement.orders.users.company_name || statement.orders.shipping_name }
    
    // 총 금액 계산
    const totalAmount = statement.refund_amount
    const totalAmountKorean = numberToKorean(totalAmount)
    const totalAmountFormatted = totalAmount.toLocaleString()
    
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

    // 반품 상품 정보 입력 (12행부터 21행까지)
    const items = statement.items || []
    for (let i = 0; i < 10; i++) {
      const row = 12 + i
      
      if (i < items.length) {
        const item = items[i]
        const totalPrice = item.unit_price * item.return_quantity
        const supplyAmount = totalPrice
        const taxAmount = Math.floor(supplyAmount * 0.1)
        
        // 품명 (C열)
        worksheet[`C${row}`] = { 
          t: 's', 
          v: item.product_name,
          s: {
            alignment: { horizontal: 'left' }
          }
        }
        
        // 규격/색상 (D열)
        worksheet[`D${row}`] = {
          t: 's',
          v: item.color || '-',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 수량 (E열)
        worksheet[`E${row}`] = {
          t: 'n',
          v: item.return_quantity,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 단가 (F열)
        worksheet[`F${row}`] = {
          t: 'n',
          v: item.unit_price,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 공급가액 (G열)
        worksheet[`G${row}`] = {
          t: 'n',
          v: supplyAmount,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 세액 (H열)
        worksheet[`H${row}`] = {
          t: 'n',
          v: taxAmount,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 비고 (I열)
        worksheet[`I${row}`] = { 
          t: 's', 
          v: `반품사유: ${statement.return_reason}`
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
    const totalSupplyAmount = items.reduce((sum: number, item: any) => sum + (item.unit_price * item.return_quantity), 0)
    const totalTaxAmount = Math.floor(totalSupplyAmount * 0.1)
    
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
    const fileName = `return_statement_${statement.statement_number}.xlsx`

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
    console.error('Return statement download API error:', error)
    return NextResponse.json({
      success: false,
      error: '반품명세서 다운로드 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 