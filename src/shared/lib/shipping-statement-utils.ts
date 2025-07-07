import * as XLSX from 'xlsx-js-style'
import fs from 'fs'
import path from 'path'

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

// 반품 명세서 데이터 인터페이스
export interface ReturnStatementData {
  statementNumber: string
  companyName: string
  businessLicenseNumber?: string
  email: string
  phone: string
  address: string
  postalCode: string
  customerGrade: string
  returnDate: string
  returnReason: string
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

// 차감 명세서 데이터 인터페이스
export interface DeductionStatementData {
  statementNumber: string
  companyName: string
  businessLicenseNumber?: string
  email: string
  phone: string
  address: string
  postalCode: string
  customerGrade: string
  deductionDate: string
  deductionReason: string
  deductionType: string
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
  const units = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
  const tens = ['', '십', '백', '천']
  const tenThousands = ['', '만', '억', '조']
  
  if (num === 0) return '영원'
  
  let result = ''
  let unitIndex = 0
  
  while (num > 0) {
    const part = num % 10000
    if (part > 0) {
      let partStr = ''
      let tempPart = part
      let tensIndex = 0
      
      while (tempPart > 0) {
        const digit = tempPart % 10
        if (digit > 0) {
          partStr = units[digit] + tens[tensIndex] + partStr
        }
        tempPart = Math.floor(tempPart / 10)
        tensIndex++
      }
      
      result = partStr + tenThousands[unitIndex] + result
    }
    num = Math.floor(num / 10000)
    unitIndex++
  }
  
  return result + '원'
}

// 공통 템플릿 처리 함수
const processTemplate = (data: any, title: string, items: any[], specialNote?: string, isShippingStatement = false) => {
  // 템플릿 파일 로드
  const templatePath = path.join(process.cwd(), 'public/templates/루소_영수증.xlsx')
  const templateBuffer = fs.readFileSync(templatePath)
  
  const workbook = XLSX.read(templateBuffer, { type: 'buffer' })
  const worksheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[worksheetName]

  // 색상별 상품 그룹화
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
      const key = `${item.productName}_${color}`
      
      if (grouped[key]) {
        grouped[key].totalQuantity += item.quantity
        grouped[key].totalPrice += item.totalPrice || (item.unitPrice * item.quantity)
      } else {
        const totalPrice = item.totalPrice || (item.unitPrice * item.quantity)
        const supplyAmount = totalPrice
        const taxAmount = Math.floor(supplyAmount * 0.1)
        
        grouped[key] = {
          productName: item.productName,
          color,
          totalQuantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice,
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

  const groupedItems = groupItemsByColorAndProduct(items)

  // 제목 및 병합 설정
  if (!worksheet['!merges']) {
    worksheet['!merges'] = []
  }
  worksheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } })
  
  worksheet['A1'] = {
    t: 's',
    v: title,
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
  worksheet['C3'] = { t: 's', v: new Date(data.date).toLocaleDateString('ko-KR') } // 날짜
  worksheet['C4'] = { t: 's', v: data.companyName } // 회사명

  // 합계금액 (공급가액 + 세액)
  const totalSupplyAmount = groupedItems.reduce((sum, item) => sum + item.supplyAmount, 0)
  const totalTaxAmount = groupedItems.reduce((sum, item) => sum + item.taxAmount, 0)
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
  
  // 상품 정보 입력 (12행부터 21행까지, 10개)
  for (let i = 0; i < 10; i++) {
    const row = 12 + i
    
    if (i < groupedItems.length) {
      const item = groupedItems[i]
      
      // 품명 (C열) - 좌측정렬
      worksheet[`C${row}`] = { 
        t: 's', 
        v: item.productName,
        s: {
          alignment: { horizontal: 'left' }
        }
      }
      
      // 규격/색상 (D열) - 중앙정렬
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
      
      // 비고 (I열) - 출고 명세서는 비워두고, 반품/차감 명세서만 사유 표시
      let remarks = ''
      if (!isShippingStatement && specialNote && i === 0) {
        remarks = specialNote
      }
      worksheet[`I${row}`] = { t: 's', v: remarks }
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
  
  // 합계 행 (22행)
  const summaryRow = 22
  
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

  // 열 너비 조정
  if (!worksheet['!cols']) {
    worksheet['!cols'] = []
  }
  worksheet['!cols'][0] = { width: 7.1 }   // A열
  worksheet['!cols'][1] = { width: 5 }     // B열
  worksheet['!cols'][2] = { width: 25 }    // C열 (품명)
  worksheet['!cols'][3] = { width: 15 }    // D열 (규격)
  worksheet['!cols'][4] = { width: 8 }     // E열 (수량)
  worksheet['!cols'][5] = { width: 12 }    // F열 (단가)
  worksheet['!cols'][6] = { width: 12 }    // G열 (공급가액)
  worksheet['!cols'][7] = { width: 12 }    // H열 (세액)
  worksheet['!cols'][8] = { width: 15 }    // I열 (비고)

  // 엑셀 파일 생성
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

// 출고 명세서 생성 함수
export async function generateShippingStatement(data: ShippingStatementData): Promise<Buffer> {
  try {
    // 색상별 상품 그룹화
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
        const key = `${item.productName}_${color}`
        
        if (grouped[key]) {
          grouped[key].totalQuantity += item.quantity
          grouped[key].totalPrice += item.totalPrice || (item.unitPrice * item.quantity)
        } else {
          const totalPrice = item.totalPrice || (item.unitPrice * item.quantity)
          const supplyAmount = totalPrice
          const taxAmount = Math.floor(supplyAmount * 0.1)
          
          grouped[key] = {
            productName: item.productName,
            color,
            totalQuantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice,
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

    const groupedItems = groupItemsByColorAndProduct(data.items)

    // 배송비 계산 (20장 미만일 때)
    const totalQuantity = groupedItems.reduce((sum, item) => sum + item.totalQuantity, 0)
    const actualShippingFee = totalQuantity >= 20 ? 0 : 3000

    // 배송비 항목 추가 (20장 미만일 때)
    const itemsWithShipping = [...groupedItems]
    if (actualShippingFee > 0) {
      itemsWithShipping.push({
        productName: '배송비',
        color: '-',
        totalQuantity: 1,
        unitPrice: actualShippingFee,
        totalPrice: actualShippingFee,
        supplyAmount: actualShippingFee,
        taxAmount: 0
      })
    }

    return processTemplate(
      {
        companyName: data.companyName,
        customerGrade: data.customerGrade,
        date: data.shippedAt
      },
      '영수증(공급받는자)',
      itemsWithShipping,
      undefined,
      true // 출고 명세서임을 표시
    )
  } catch (error) {
    console.error('출고 명세서 생성 중 오류 발생:', error)
    throw error
  }
}

// 반품 명세서 생성 함수
export async function generateReturnStatement(data: ReturnStatementData): Promise<Buffer> {
  try {
    return processTemplate(
      {
        companyName: data.companyName,
        customerGrade: data.customerGrade,
        date: data.returnDate
      },
      '반품명세서(공급받는자)',
      data.items,
      `반품사유: ${data.returnReason}`,
      false // 반품 명세서
    )
  } catch (error) {
    console.error('반품 명세서 생성 중 오류 발생:', error)
    throw error
  }
}

// 차감 명세서 생성 함수
export async function generateDeductionStatement(data: DeductionStatementData): Promise<Buffer> {
  try {
    return processTemplate(
      {
        companyName: data.companyName,
        customerGrade: data.customerGrade,
        date: data.deductionDate
      },
      '차감명세서(공급받는자)',
      data.items,
      `차감사유: ${data.deductionReason}`,
      false // 차감 명세서
    )
  } catch (error) {
    console.error('차감 명세서 생성 중 오류 발생:', error)
    throw error
  }
} 