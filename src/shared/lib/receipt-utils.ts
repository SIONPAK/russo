import * as XLSX from 'xlsx-js-style'
import { saveAs } from 'file-saver'
import ExcelJS from 'exceljs'
import path from 'path'

export interface ReceiptData {
  orderNumber: string
  orderDate: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  shippingName: string
  shippingPhone: string
  shippingAddress: string
  shippingPostalCode: string
  items: Array<{
    productName: string
    productCode: string
    quantity: number
    unitPrice: number
    totalPrice: number
    color?: string
    size?: string
    options?: any
  }>
  subtotal: number
  shippingFee: number
  totalAmount: number
  notes?: string
}

// 거래명세서 데이터 인터페이스
export interface TradeStatementData {
  orderNumber: string
  orderDate: string
  customerName: string
  customerPhone: string
  customerEmail: string
  businessNumber?: string
  shippingName: string
  shippingPhone: string
  shippingAddress: string
  shippingPostalCode: string
  items: Array<{
    productName: string
    productCode: string
    quantity: number
    shippedQuantity: number
    unitPrice: number
    totalPrice: number
    color: string
    size: string
  }>
  subtotal: number
  shippingFee: number
  totalAmount: number
  notes?: string
}

// 출고 명세서 데이터 인터페이스
export interface ShippingStatementData {
  orderNumber: string
  companyName: string
  businessLicenseNumber?: string
  email: string
  phone: string
  address: string
  postalCode: string
  customerGrade: string
  shippedAt: string
  items: Array<{
    productName: string
    color: string
    size: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
  totalAmount: number
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

// options에서 색상 추출하는 함수 (사이즈는 무시)
const extractColor = (item: ReceiptData['items'][0]) => {
  let color = item.color || '기본'
  
  if (item.options) {
    try {
      if (typeof item.options === 'string') {
        const parsed = JSON.parse(item.options)
        color = parsed.color || color
      } else if (typeof item.options === 'object') {
        color = item.options.color || color
      }
    } catch (e) {
      // JSON 파싱 실패 시 기본값 사용
    }
  }
  
  return color
}

// 색상별로만 상품 그룹화 (사이즈 무시, 수량 합치기)
const groupItemsByColorAndProduct = (items: ReceiptData['items']) => {
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
    const color = extractColor(item)
    const key = `${item.productName}_${color}`
    
    if (grouped[key]) {
      grouped[key].totalQuantity += item.quantity
      grouped[key].totalPrice += item.totalPrice
    } else {
      const supplyAmount = item.totalPrice
      const taxAmount = Math.floor(supplyAmount * 0.1)
      
      grouped[key] = {
        productName: item.productName,
        color,
        totalQuantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        supplyAmount,
        taxAmount
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

// 행을 삽입하는 함수 (10개 이상일 때만)
const insertRows = (worksheet: XLSX.WorkSheet, startRow: number, numRows: number) => {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:I30')
  
  // 기존 셀들을 아래로 이동 (22행부터 아래쪽 모든 내용)
  for (let row = range.e.r; row >= startRow; row--) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const oldAddr = XLSX.utils.encode_cell({ r: row, c: col })
      const newAddr = XLSX.utils.encode_cell({ r: row + numRows, c: col })
      
      if (worksheet[oldAddr]) {
        worksheet[newAddr] = { ...worksheet[oldAddr] }
        delete worksheet[oldAddr]
      }
    }
  }
  
  // 범위 업데이트
  range.e.r += numRows
  worksheet['!ref'] = XLSX.utils.encode_range(range)
}

// 숫자 셀에 콤마 포맷과 중앙정렬 적용
const createNumberCell = (value: number) => {
  return {
    t: 'n',
    v: value,
    z: '#,##0',
    s: {
      alignment: { horizontal: 'center' }
    }
  }
}

// 텍스트 셀에 중앙정렬 적용
const createCenterTextCell = (value: string) => {
  return {
    t: 's',
    v: value,
    s: {
      alignment: { horizontal: 'center' }
    }
  }
}

// 빈 셀 처리 (값이 없으면 빈 셀로)
const createEmptyCell = () => {
  return { t: 's', v: '' }
}

export const generateReceipt = async (receiptData: ReceiptData) => {
  try {
    // 템플릿 파일 로드 (한글 파일명을 URL 인코딩)
    const templateResponse = await fetch(`/templates/${encodeURIComponent('루소_영수증.xlsx')}`)
    if (!templateResponse.ok) {
      throw new Error('템플릿 파일을 불러올 수 없습니다.')
    }
    
    const templateBuffer = await templateResponse.arrayBuffer()
    const workbook = XLSX.read(templateBuffer, { type: 'array' })
    
    // 첫 번째 워크시트 가져오기
    const worksheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[worksheetName]
    
    // 색상별 상품 그룹화
    const groupedItems = groupItemsByColorAndProduct(receiptData.items)
    
    // 10개 이상의 상품이 있을 때만 행 추가
    const extraRows = Math.max(0, groupedItems.length - 10)
    if (extraRows > 0) {
      insertRows(worksheet, 22, extraRows) // 22행(합계행) 이전에 행 추가
    }
    
    // 제목 서식 설정
    // 영수증 제목 병합 셀 (A1:I1)
    worksheet['!merges'] = worksheet['!merges'] || []
    worksheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } })
    
    // "영수증(공급받는자)" 전체 텍스트
    worksheet['A1'] = {
      t: 's',
      v: '영수증(공급받는자)',
      s: {
        font: { bold: true, sz: 20 },
        alignment: { horizontal: 'center', vertical: 'center' }
      }
    }
    
    // 행 높이 설정 (32pt)
    if (!worksheet['!rows']) {
      worksheet['!rows'] = []
    }
    worksheet['!rows'][0] = { hpt: 32 }
    
    // 기본 정보 입력 (템플릿 구조 유지)
    // 날짜 (C3)
    worksheet['C3'] = { t: 's', v: new Date().toLocaleDateString('ko-KR') }
    
    // 수신/회사명 (C4) - 회사명으로 변경
    worksheet['C4'] = { t: 's', v: receiptData.customerName }
    
    // 합계금액 (공급가액 + 세액) - 중앙정렬
    const totalSupplyAmount = groupedItems.reduce((sum, item) => sum + item.supplyAmount, 0)
    const totalTaxAmount = groupedItems.reduce((sum, item) => sum + item.taxAmount, 0)
    
    // 20장 이상 무료배송 확인 (실제 출고 수량 기준)
    const totalQuantity = receiptData.items.reduce((sum, item) => sum + item.quantity, 0)
    const actualShippingFee = totalQuantity >= 20 ? 0 : (receiptData.shippingFee || 0)
    const finalTotalAmount = totalSupplyAmount + totalTaxAmount + actualShippingFee
    
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
    
    // 상품 정보 입력 (12행부터 21행까지, 10개 이상이면 추가 행에)
    for (let i = 0; i < 10 + extraRows; i++) {
      const row = 12 + i
      
      if (i < groupedItems.length) {
        const item = groupedItems[i]
        
        // 품명 (C열) - 좌측정렬 (기본)
        worksheet[`C${row}`] = { 
          t: 's', 
          v: item.productName,
          s: {
            alignment: { horizontal: 'left' }
          }
        }
        
        // 규격/색상만 (D열) - 중앙정렬
        worksheet[`D${row}`] = {
          t: 's',
          v: item.color,
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 수량 (E열) - 콤마 포맷, 중앙정렬
        worksheet[`E${row}`] = {
          t: 'n',
          v: item.totalQuantity,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 단가 (F열) - 콤마 포맷, 중앙정렬
        worksheet[`F${row}`] = {
          t: 'n',
          v: item.unitPrice,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 공급가액 (G열) - 콤마 포맷, 중앙정렬
        worksheet[`G${row}`] = {
          t: 'n',
          v: item.supplyAmount,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 세액 (H열) - 콤마 포맷, 중앙정렬
        worksheet[`H${row}`] = {
          t: 'n',
          v: item.taxAmount,
          z: '#,##0',
          s: {
            alignment: { horizontal: 'center' }
          }
        }
        
        // 비고 (I열) - 비워둠
        worksheet[`I${row}`] = { t: 's', v: '' }
      } else {
        // 빈 행 처리 - 모든 셀을 빈 값으로
        worksheet[`C${row}`] = { t: 's', v: '' }
        worksheet[`D${row}`] = { t: 's', v: '' }
        worksheet[`E${row}`] = { t: 's', v: '' }
        worksheet[`F${row}`] = { t: 's', v: '' }
        worksheet[`G${row}`] = { t: 's', v: '' }
        worksheet[`H${row}`] = { t: 's', v: '' }
        worksheet[`I${row}`] = { t: 's', v: '' }
      }
    }
    
    // 합계 행 위치 (22행 + 추가된 행 수)
    const summaryRow = 22 + extraRows
    
    // "합    계" 텍스트 - 중앙정렬, 볼드
    worksheet[`B${summaryRow}`] = {
      t: 's',
      v: '합    계',
      s: {
        alignment: { horizontal: 'center' },
        font: { bold: true }
      }
    }
    
    // 공급가액 합계 (G열) - 콤마 포맷, 중앙정렬
    worksheet[`G${summaryRow}`] = {
      t: 'n',
      v: totalSupplyAmount,
      z: '#,##0',
      s: {
        alignment: { horizontal: 'center' },
        font: { bold: true }
      }
    }
    
    // 세액 합계 (H열) - 콤마 포맷, 중앙정렬
    worksheet[`H${summaryRow}`] = {
      t: 'n',
      v: totalTaxAmount,
      z: '#,##0',
      s: {
        alignment: { horizontal: 'center' },
        font: { bold: true }
      }
    }
    
    // 열 너비 조정 (53pt = 약 7.1 문자)
    if (!worksheet['!cols']) {
      worksheet['!cols'] = []
    }
    worksheet['!cols'][0] = { width: 7.1 }   // A열 (53pt)
    worksheet['!cols'][1] = { width: 5 }     // B열 (No.)
    worksheet['!cols'][2] = { width: 25 }    // C열 (품명)
    worksheet['!cols'][3] = { width: 15 }    // D열 (규격)
    worksheet['!cols'][4] = { width: 8 }     // E열 (수량)
    worksheet['!cols'][5] = { width: 12 }    // F열 (단가)
    worksheet['!cols'][6] = { width: 12 }    // G열 (공급가액)
    worksheet['!cols'][7] = { width: 12 }    // H열 (세액)
    worksheet['!cols'][8] = { width: 15 }    // I열 (비고)
    
    // 엑셀 파일 생성
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    
    // 파일 다운로드
    const fileName = `lusso_영수증_${receiptData.orderNumber}.xlsx`
    saveAs(blob, fileName)
    
    return true
  } catch (error) {
    console.error('영수증 생성 실패:', error)
    return false
  }
}

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\./g, '-').slice(0, -1)
}

// 거래명세서 생성 함수
export async function generateTradeStatement(data: TradeStatementData, fileName: string): Promise<string> {
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('거래명세서')

    // 컬럼 너비 설정
    worksheet.columns = [
      { width: 3 },   // A
      { width: 12 },  // B
      { width: 15 },  // C
      { width: 12 },  // D
      { width: 8 },   // E
      { width: 8 },   // F
      { width: 12 },  // G
      { width: 15 },  // H
      { width: 12 }   // I
    ]

    // 회사 로고 및 제목
    worksheet.mergeCells('A1:I3')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = '거래명세서'
    titleCell.font = { size: 24, bold: true }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    titleCell.border = {
      top: { style: 'thick' },
      left: { style: 'thick' },
      bottom: { style: 'thick' },
      right: { style: 'thick' }
    }

    // 회사 정보
    let row = 5
    worksheet.mergeCells(`A${row}:C${row}`)
    worksheet.getCell(`A${row}`).value = '공급자 정보'
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 }
    worksheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } }

    row++
    worksheet.getCell(`A${row}`).value = '상호명:'
    worksheet.getCell(`B${row}`).value = '루소'
    worksheet.getCell(`A${row + 1}`).value = '사업자번호:'
    worksheet.getCell(`B${row + 1}`).value = '123-45-67890'
    worksheet.getCell(`A${row + 2}`).value = '연락처:'
    worksheet.getCell(`B${row + 2}`).value = '010-2131-7540'

    // 고객 정보
    worksheet.mergeCells(`E${row - 1}:G${row - 1}`)
    worksheet.getCell(`E${row - 1}`).value = '공급받는자 정보'
    worksheet.getCell(`E${row - 1}`).font = { bold: true, size: 12 }
    worksheet.getCell(`E${row - 1}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } }

    worksheet.getCell(`E${row}`).value = '상호명:'
    worksheet.getCell(`F${row}`).value = data.customerName
    worksheet.getCell(`E${row + 1}`).value = '사업자번호:'
    worksheet.getCell(`F${row + 1}`).value = data.businessNumber || '-'
    worksheet.getCell(`E${row + 2}`).value = '연락처:'
    worksheet.getCell(`F${row + 2}`).value = data.customerPhone

    row += 4

    // 주문 정보
    worksheet.mergeCells(`A${row}:I${row}`)
    worksheet.getCell(`A${row}`).value = '주문 정보'
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 }
    worksheet.getCell(`A${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } }

    row++
    worksheet.getCell(`A${row}`).value = '주문번호:'
    worksheet.getCell(`B${row}`).value = data.orderNumber
    worksheet.getCell(`D${row}`).value = '주문일자:'
    worksheet.getCell(`E${row}`).value = data.orderDate

    row++
    worksheet.getCell(`A${row}`).value = '배송지:'
    worksheet.mergeCells(`B${row}:I${row}`)
    worksheet.getCell(`B${row}`).value = `${data.shippingName} / ${data.shippingPhone} / ${data.shippingAddress}`

    row += 2

    // 상품 목록 헤더
    const headers = ['번호', '상품명', '상품코드', '색상', '사이즈', '주문수량', '출고수량', '단가', '금액']
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(row, index + 1)
      cell.value = header
      cell.font = { bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    })

    row++

    // 상품 목록
    data.items.forEach((item, index) => {
      const cells = [
        index + 1,
        item.productName,
        item.productCode,
        item.color,
        item.size,
        item.quantity,
        item.shippedQuantity,
        item.unitPrice.toLocaleString(),
        item.totalPrice.toLocaleString()
      ]

      cells.forEach((value, cellIndex) => {
        const cell = worksheet.getCell(row, cellIndex + 1)
        cell.value = value
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
        cell.alignment = { 
          horizontal: cellIndex === 1 ? 'left' : 'center', 
          vertical: 'middle' 
        }
      })
      row++
    })

    // 합계
    row++
    worksheet.getCell(`G${row}`).value = '소계:'
    worksheet.getCell(`G${row}`).font = { bold: true }
    worksheet.getCell(`H${row}`).value = data.subtotal.toLocaleString()
    worksheet.getCell(`H${row}`).font = { bold: true }

    row++
    worksheet.getCell(`G${row}`).value = '배송비:'
    worksheet.getCell(`G${row}`).font = { bold: true }
    worksheet.getCell(`H${row}`).value = data.shippingFee.toLocaleString()
    worksheet.getCell(`H${row}`).font = { bold: true }

    row++
    worksheet.getCell(`G${row}`).value = '총액:'
    worksheet.getCell(`G${row}`).font = { bold: true }
    worksheet.getCell(`H${row}`).value = data.totalAmount.toLocaleString()
    worksheet.getCell(`H${row}`).font = { bold: true }
    worksheet.getCell(`H${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } }

    // 비고
    if (data.notes) {
      row += 2
      worksheet.getCell(`A${row}`).value = '비고:'
      worksheet.getCell(`A${row}`).font = { bold: true }
      worksheet.mergeCells(`B${row}:I${row}`)
      worksheet.getCell(`B${row}`).value = data.notes
    }

    // 파일 저장 (실제 구현에서는 클라우드 스토리지에 업로드)
    const buffer = await workbook.xlsx.writeBuffer()
    
    // 임시로 로컬 URL 반환 (실제로는 클라우드 스토리지 URL)
    const fileUrl = `/api/files/statements/${fileName}`
    
    return fileUrl

  } catch (error) {
    console.error('거래명세서 생성 오류:', error)
    throw new Error('거래명세서 생성에 실패했습니다.')
  }
} 