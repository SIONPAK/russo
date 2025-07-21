import * as XLSX from 'xlsx-js-style'
import fs from 'fs'
import path from 'path'
import { getKoreaDate } from './utils'

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
    supplyAmount: number
    taxAmount: number
  }>
  totalAmount: number
  supplyAmount: number
  taxAmount: number
  shippingFee: number
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

// 미출고 명세서 데이터 인터페이스
export interface UnshippedStatementData {
  statementNumber: string
  companyName: string
  businessLicenseNumber?: string
  email: string
  phone: string
  address: string
  postalCode: string
  customerGrade: string
  unshippedDate: string
  unshippedReason: string
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

// 확정 명세서 데이터 인터페이스
export interface ConfirmedStatementData {
  statement_number: string
  order_number: string
  order_date: string
  company_name: string
  representative_name: string
  items: Array<{
    product_name: string
    color: string
    size: string
    ordered_quantity: number
    shipped_quantity: number
    unit_price: number
    total_price: number
  }>
  total_amount: number
  shipping_fee: number
  notes?: string
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
  console.log('🔍 processTemplate 호출:', {
    companyName: data.companyName,
    title,
    itemsCount: items.length,
    environment: process.env.NODE_ENV
  })

  // 템플릿 파일 로드 (인코딩 명시)
  const templatePath = path.join(process.cwd(), 'public/templates/루소_영수증.xlsx')
  console.log('📁 템플릿 경로:', templatePath)
  
  const templateBuffer = fs.readFileSync(templatePath)
  console.log('📄 템플릿 로드 완료, 크기:', templateBuffer.length)
  
  // XLSX 옵션에 인코딩 명시
  const workbook = XLSX.read(templateBuffer, { 
    type: 'buffer',
    codepage: 65001, // UTF-8
    cellText: false,
    cellDates: true
  })
  const worksheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[worksheetName]
  console.log('📊 워크시트 로드 완료:', worksheetName)

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
        const additionalPrice = item.totalPrice || (item.unitPrice * item.quantity)
        // 수량 = 공급가액 / 단가
        const additionalQuantity = additionalPrice / item.unitPrice
        grouped[key].totalQuantity += additionalQuantity
        grouped[key].totalPrice += additionalPrice
      } else {
        const totalPrice = item.totalPrice || (item.unitPrice * item.quantity)
        const supplyAmount = totalPrice
        // 배송비는 부가세 포함으로 분리, 상품은 원래대로
        const taxAmount = item.productName === '배송비' ? 
          totalPrice - Math.round(totalPrice / 1.1) : 
          Math.floor(supplyAmount * 0.1)
        // 수량 = 공급가액 / 단가 (0으로 나누기 방지)
        const calculatedQuantity = item.unitPrice === 0 ? 0 : totalPrice / item.unitPrice
        
        grouped[key] = {
          productName: item.productName,
          color,
          totalQuantity: calculatedQuantity,
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
      // 배송비만 부가세 포함으로 분리, 상품은 원래대로
      if (item.productName === '배송비') {
        item.supplyAmount = Math.round(item.totalPrice / 1.1)
        item.taxAmount = item.totalPrice - item.supplyAmount
        // 수량 재계산 (총가격 / 단가, 0으로 나누기 방지)
        item.totalQuantity = item.unitPrice === 0 ? 0 : item.totalPrice / item.unitPrice
      } else {
        item.taxAmount = Math.floor(item.supplyAmount * 0.1)
        // 수량 재계산 (공급가액 / 단가, 0으로 나누기 방지)
        item.totalQuantity = item.unitPrice === 0 ? 0 : item.supplyAmount / item.unitPrice
      }
    })
    
    return Object.values(grouped)
  }

  const groupedItems = groupItemsByColorAndProduct(items)
  console.log('🔍 그룹화된 아이템:', groupedItems.map(item => ({
    productName: item.productName,
    color: item.color,
    quantity: item.totalQuantity
  })))

  // 제목 및 병합 설정
  if (!worksheet['!merges']) {
    worksheet['!merges'] = []
  }
  worksheet['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } })
  
  // 제목 설정 (명시적 UTF-8 문자열)
  worksheet['A1'] = {
    t: 's',
    v: String(title),
    s: {
      font: { bold: true, sz: 20, name: 'Arial Unicode MS' },
      alignment: { horizontal: 'center', vertical: 'center' }
    }
  }
  
  // 행 높이 설정
  if (!worksheet['!rows']) {
    worksheet['!rows'] = []
  }
  worksheet['!rows'][0] = { hpt: 32 }
  
  // 기본 정보 입력 (한글 데이터 명시적 처리)
  const dateValue = data.date || data.shippedAt
  const formattedDate = dateValue ? 
    getKoreaDate() : 
    getKoreaDate()
  
  worksheet['C3'] = { 
    t: 's', 
    v: String(formattedDate),
    s: { font: { name: 'Arial Unicode MS' } }
  }
  
  worksheet['C4'] = { 
    t: 's', 
    v: String(data.companyName || ''),
    s: { font: { name: 'Arial Unicode MS' } }
  }
  
  console.log('🔍 기본 정보 설정:', {
    date: formattedDate,
    companyName: data.companyName
  })

  // 합계금액 (공급가액 + 세액)
  const totalSupplyAmount = groupedItems.reduce((sum, item) => sum + item.supplyAmount, 0)
  const totalTaxAmount = groupedItems.reduce((sum, item) => sum + item.taxAmount, 0)
  const finalTotalAmount = totalSupplyAmount + totalTaxAmount
  
  const totalAmountKorean = numberToKorean(finalTotalAmount)
  const totalAmountFormatted = finalTotalAmount.toLocaleString()
  
  worksheet['D9'] = {
    t: 's',
    v: String(totalAmountKorean),
    s: {
      alignment: { horizontal: 'center' },
      font: { bold: true, name: 'Arial Unicode MS' }
    }
  }
  worksheet['I9'] = {
    t: 's',
    v: `₩${totalAmountFormatted}`,
    s: {
      alignment: { horizontal: 'center' },
      font: { bold: true, name: 'Arial Unicode MS' }
    }
  }
  
  // 상품 정보 입력 (12행부터 21행까지, 10개)
  for (let i = 0; i < 10; i++) {
    const row = 12 + i
    
    if (i < groupedItems.length) {
      const item = groupedItems[i]
      
      console.log(`🔍 상품 ${i + 1} 처리:`, {
        productName: item.productName,
        color: item.color,
        quantity: item.totalQuantity
      })
      
      // 품명 (C열) - 좌측정렬, UTF-8 명시
      worksheet[`C${row}`] = { 
        t: 's', 
        v: String(item.productName),
        s: {
          alignment: { horizontal: 'left' },
          font: { name: 'Arial Unicode MS' }
        }
      }
      
      // 규격/색상 (D열) - 중앙정렬, UTF-8 명시
      worksheet[`D${row}`] = {
        t: 's',
        v: String(item.color),
        s: {
          alignment: { horizontal: 'center' },
          font: { name: 'Arial Unicode MS' }
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
      worksheet[`I${row}`] = { 
        t: 's', 
        v: String(remarks),
        s: { font: { name: 'Arial Unicode MS' } }
      }
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
  
  // "합    계" 텍스트 - 중앙정렬, 볼드, UTF-8 명시
  worksheet[`B${summaryRow}`] = {
    t: 's',
    v: '합    계',
    s: {
      alignment: { horizontal: 'center' },
      font: { bold: true, name: 'Arial Unicode MS' }
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

  console.log('📊 엑셀 파일 생성 중...')
  
  // 엑셀 파일 생성 (UTF-8 인코딩 명시)
  const buffer = XLSX.write(workbook, { 
    type: 'buffer', 
    bookType: 'xlsx',
    compression: true,
    bookSST: false,
    cellDates: true
  })
  
  console.log('✅ 엑셀 파일 생성 완료, 크기:', buffer.length)
  return buffer
}

// 출고 명세서 생성 함수
export async function generateShippingStatement(data: ShippingStatementData): Promise<Buffer> {
  try {
    console.log('🔍 출고 명세서 생성 시작:', {
      companyName: data.companyName,
      itemsCount: data.items.length,
      supplyAmount: data.supplyAmount,
      taxAmount: data.taxAmount,
      shippingFee: data.shippingFee,
      totalAmount: data.totalAmount
    })

    // 🔧 API에서 전달받은 데이터를 그대로 활용
    const processedItems = data.items.map(item => ({
      productName: item.productName,
      color: item.color || '기본',
      totalQuantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      supplyAmount: item.supplyAmount, // API에서 계산된 값 사용
      taxAmount: item.taxAmount       // API에서 계산된 값 사용
    }))

    // 배송비 추가 (부가세 포함으로 분리)
    const itemsWithShipping = [...processedItems]
    if (data.shippingFee > 0) {
      const shippingSupply = Math.round(data.shippingFee / 1.1)
      const shippingTax = data.shippingFee - shippingSupply
      
      itemsWithShipping.push({
        productName: '배송비',
        color: '-',
        totalQuantity: 1,
        unitPrice: data.shippingFee,
        totalPrice: data.shippingFee,
        supplyAmount: shippingSupply,
        taxAmount: shippingTax
      })
    }

    console.log('🔍 최종 처리 데이터:', {
      companyName: data.companyName,
      customerGrade: data.customerGrade,
      date: data.shippedAt,
      itemsCount: itemsWithShipping.length,
      totalSupplyAmount: itemsWithShipping.reduce((sum, item) => sum + item.supplyAmount, 0),
      totalTaxAmount: itemsWithShipping.reduce((sum, item) => sum + item.taxAmount, 0)
    })

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

// 미출고 명세서 생성 함수
export async function generateUnshippedStatement(data: UnshippedStatementData): Promise<Buffer> {
  try {
    // 미출고 명세서는 모든 수량과 금액을 0으로 강제 설정
    const zeroItems = data.items.map(item => ({
      ...item,
      quantity: 0,
      unitPrice: 0,
      totalPrice: 0
    }))
    
    return processTemplate(
      {
        companyName: data.companyName,
        customerGrade: data.customerGrade,
        date: data.unshippedDate
      },
      '미출고명세서(공급받는자)',
      zeroItems,
      `미출고사유: ${data.unshippedReason}`,
      false // 미출고 명세서
    )
  } catch (error) {
    console.error('미출고 명세서 생성 중 오류 발생:', error)
    throw error
  }
} 

// 확정 명세서 생성 함수
export async function generateConfirmedStatement(data: ConfirmedStatementData): Promise<Buffer> {
  try {
    // 확정 명세서 데이터를 처리
    const processedItems = data.items.map(item => ({
      productName: item.product_name,
      color: item.color,
      size: item.size,
      quantity: item.shipped_quantity, // 출고 수량 사용
      unitPrice: item.unit_price,
      totalPrice: item.total_price,
      supplyAmount: item.total_price,
      taxAmount: Math.floor(item.total_price * 0.1)
    }))

    // 배송비 추가 (부가세 포함으로 분리)
    const itemsWithShipping = [...processedItems]
    if (data.shipping_fee > 0) {
      const shippingSupply = Math.round(data.shipping_fee / 1.1)
      const shippingTax = data.shipping_fee - shippingSupply
      
      itemsWithShipping.push({
        productName: '배송비',
        color: '-',
        size: '-',
        quantity: 1,
        unitPrice: data.shipping_fee,
        totalPrice: data.shipping_fee,
        supplyAmount: shippingSupply,
        taxAmount: shippingTax
      })
    }

    console.log('🔍 확정 명세서 생성 - 배송비 포함:', {
      orderNumber: data.order_number,
      originalItems: processedItems.length,
      finalItems: itemsWithShipping.length,
      shippingFee: data.shipping_fee,
      totalAmount: data.total_amount
    })
    
    return processTemplate(
      {
        companyName: data.company_name,
        customerGrade: '일반',
        date: data.order_date
      },
      '확정명세서(공급받는자)',
      itemsWithShipping,
      `확정 명세서 - 주문번호: ${data.order_number}`,
      false // 확정 명세서
    )
  } catch (error) {
    console.error('확정 명세서 생성 중 오류 발생:', error)
    throw error
  }
} 