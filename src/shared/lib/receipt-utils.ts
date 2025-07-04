import * as XLSX from 'xlsx-js-style'
import { saveAs } from 'file-saver'

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
    
    // 합계금액 (D9 - 십일만구천칠백원정, I9 - ₩128,370) - 중앙정렬
    const totalAmountKorean = numberToKorean(receiptData.totalAmount)
    const totalAmountFormatted = receiptData.totalAmount.toLocaleString()
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
    
    // 합계 계산
    const totalSupplyAmount = groupedItems.reduce((sum, item) => sum + item.supplyAmount, 0)
    const totalTaxAmount = groupedItems.reduce((sum, item) => sum + item.taxAmount, 0)
    
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
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
} 