import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { formatCurrency, getKoreaDate } from './utils'
import { CartItem } from '../types'

export interface OrderItem {
  id: string
  productName: string
  color: string
  size: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface OrderData {
  orderNumber: string
  orderDate: string
  customerName: string
  customerPhone: string
  items: CartItem[]
  totalAmount: number
  shippingFee: number
  finalAmount: number
  totalTax: number
}

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
    options?: any
  }>
  subtotal: number
  shippingFee: number
  totalAmount: number
  notes?: string
}

// 숫자를 한글로 변환하는 함수
function numberToKorean(num: number): string {
  const units = ['', '십', '백', '천', '만', '십만', '백만', '천만', '억']
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
  
  if (num === 0) return '영'
  
  let result = ''
  let unitIndex = 0
  
  while (num > 0) {
    const digit = num % 10
    if (digit !== 0) {
      result = digits[digit] + units[unitIndex] + result
    }
    num = Math.floor(num / 10)
    unitIndex++
  }
  
  return result + '원정'
}

export function generateOrderExcel(orderData: OrderData) {
  // 워크북 생성
  const wb = XLSX.utils.book_new()
  
  // 빈 워크시트 생성 (A1부터 J30까지)
  const ws: XLSX.WorkSheet = {}
  
  // 셀 범위 설정
  ws['!ref'] = 'A1:J30'
  
  // 행 높이 설정
  ws['!rows'] = [
    { hpx: 25 }, // 1행
    { hpx: 25 }, // 2행
    { hpx: 25 }, // 3행
    { hpx: 25 }, // 4행
    { hpx: 30 }, // 5행 (영수증 제목)
    { hpx: 25 }, // 6행
    { hpx: 25 }, // 7행
    { hpx: 25 }, // 8행
    { hpx: 25 }, // 9행
    { hpx: 25 }, // 10행
    { hpx: 30 }, // 11행 (합계금액)
    { hpx: 25 }, // 12행
    { hpx: 25 }, // 13행
    { hpx: 25 }, // 14행
    { hpx: 30 }, // 15행 (테이블 헤더)
  ]
  
  // 열 너비 설정
  ws['!cols'] = [
    { wch: 8 },  // A열 (No.)
    { wch: 20 }, // B열 (품명)
    { wch: 12 }, // C열 (규격)
    { wch: 8 },  // D열 (수량)
    { wch: 8 },  // E열 (단가)
    { wch: 12 }, // F열 (공급가액)
    { wch: 12 }, // G열 (세액)
    { wch: 12 }, // H열 (비고)
    { wch: 5 },  // I열 (여백)
    { wch: 15 }, // J열 (영수증 정보)
  ]

  // 상단 정보 (오른쪽 상단)
  ws['H1'] = { v: '영 수 증(공급받는자)', t: 's' }
  ws['J1'] = { v: `(W${orderData.totalAmount.toLocaleString()})`, t: 's' }
  
  // 날짜 및 업체 정보
  ws['A3'] = { v: '날짜:', t: 's' }
  ws['B3'] = { v: orderData.orderDate, t: 's' }
  ws['H3'] = { v: '상호 : 주식회사 루소', t: 's' }
  
  ws['A4'] = { v: '주 소:', t: 's' }
  ws['B4'] = { v: '미케드로', t: 's' }
  
  ws['A5'] = { v: '월 차:', t: 's' }
  ws['H5'] = { v: `전화번호 : ${orderData.customerPhone}`, t: 's' }
  
  // 메시지
  ws['A7'] = { v: '마케팅 같이 영수 드립니다', t: 's' }
  
  // 합계금액 섹션
  ws['A9'] = { v: '합계금액', t: 's' }
  ws['B10'] = { v: '일십만원정구천원정', t: 's' }
  
  // 테이블 헤더
  const headerRow = 12
  ws[`A${headerRow}`] = { v: 'No.', t: 's' }
  ws[`B${headerRow}`] = { v: '품명', t: 's' }
  ws[`C${headerRow}`] = { v: '규격', t: 's' }
  ws[`D${headerRow}`] = { v: '수량', t: 's' }
  ws[`E${headerRow}`] = { v: '단가', t: 's' }
  ws[`F${headerRow}`] = { v: '공급가액', t: 's' }
  ws[`G${headerRow}`] = { v: '세액', t: 's' }
  ws[`H${headerRow}`] = { v: '비고', t: 's' }
  
  // 상품 데이터
  let currentRow = headerRow + 1
  orderData.items.forEach((item, index) => {
    const itemTotal = item.totalPrice
    const itemTax = Math.floor(itemTotal * 0.1)
    
    ws[`A${currentRow}`] = { v: index + 1, t: 'n' }
    ws[`B${currentRow}`] = { v: `[${item.productId}] ${item.productName}`, t: 's' }
    ws[`C${currentRow}`] = { v: `${item.color}/${item.size}`, t: 's' }
    ws[`D${currentRow}`] = { v: item.quantity, t: 'n' }
    ws[`E${currentRow}`] = { v: item.unitPrice, t: 'n' }
    ws[`F${currentRow}`] = { v: itemTotal, t: 'n' }
    ws[`G${currentRow}`] = { v: itemTax, t: 'n' }
    ws[`H${currentRow}`] = { v: '', t: 's' }
    
    currentRow++
  })
  
  // 배송비 행 추가 (배송비가 0이 아닐 때만)
  if (orderData.shippingFee > 0) {
    ws[`A${currentRow}`] = { v: orderData.items.length + 1, t: 'n' }
    ws[`B${currentRow}`] = { v: '배송비', t: 's' }
    ws[`C${currentRow}`] = { v: '', t: 's' }
    ws[`D${currentRow}`] = { v: 1, t: 'n' }
    ws[`E${currentRow}`] = { v: orderData.shippingFee, t: 'n' }
    ws[`F${currentRow}`] = { v: orderData.shippingFee, t: 'n' }
    ws[`G${currentRow}`] = { v: 0, t: 'n' }
    ws[`H${currentRow}`] = { v: '', t: 's' }
    currentRow++
  }
  
  // 빈 행들 추가 (최대 10개 상품 + 배송비까지)
  for (let i = currentRow; i < headerRow + 11; i++) {
    ws[`A${i}`] = { v: '', t: 's' }
    ws[`B${i}`] = { v: '', t: 's' }
    ws[`C${i}`] = { v: '', t: 's' }
    ws[`D${i}`] = { v: '', t: 's' }
    ws[`E${i}`] = { v: '', t: 's' }
    ws[`F${i}`] = { v: '', t: 's' }
    ws[`G${i}`] = { v: '', t: 's' }
    ws[`H${i}`] = { v: '', t: 's' }
  }
  
  // 합계 행
  const totalRow = headerRow + 11
  ws[`A${totalRow}`] = { v: '합', t: 's' }
  
  // 🔧 합계는 수식으로 계산 (F13:F23 범위의 합)
  const supplyStartRow = headerRow + 1 // 첫 번째 상품 행
  const supplyEndRow = headerRow + 10  // 마지막 상품 행 (10개 상품 지원)
  ws[`F${totalRow}`] = { f: `SUM(F${supplyStartRow}:F${supplyEndRow})`, t: 'n' }
  ws[`G${totalRow}`] = { f: `SUM(G${supplyStartRow}:G${supplyEndRow})`, t: 'n' }
  
  // 하단 정보
  ws['A25'] = { v: '국민은행 573701-04-214209 주식회사 루소', t: 's' }
  ws['A26'] = { v: '부가세 포함 입금, 계산서는 자동발행됩니다.', t: 's' }
  ws['A27'] = { v: '감사합니다', t: 's' }
  
  // 셀 병합 설정
  ws['!merges'] = [
    // 영수증 제목
    { s: { r: 0, c: 7 }, e: { r: 0, c: 8 } }, // H1:I1
    // 상호 정보
    { s: { r: 2, c: 7 }, e: { r: 2, c: 9 } }, // H3:J3
    { s: { r: 4, c: 7 }, e: { r: 4, c: 9 } }, // H5:J5
    // 메시지
    { s: { r: 6, c: 0 }, e: { r: 6, c: 7 } }, // A7:H7
    // 합계금액
    { s: { r: 8, c: 0 }, e: { r: 8, c: 7 } }, // A9:H9
    { s: { r: 9, c: 1 }, e: { r: 9, c: 7 } }, // B10:H10
    // 하단 정보
    { s: { r: 24, c: 0 }, e: { r: 24, c: 7 } }, // A25:H25
    { s: { r: 25, c: 0 }, e: { r: 25, c: 7 } }, // A26:H26
    { s: { r: 26, c: 0 }, e: { r: 26, c: 7 } }, // A27:H27
  ]
  
  // 스타일 적용
  const centerStyle = { alignment: { horizontal: 'center', vertical: 'center' } }
  const boldStyle = { font: { bold: true, size: 12 } }
  const titleStyle = { font: { bold: true, size: 14 }, alignment: { horizontal: 'center' } }
  const borderStyle = { border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } }
  
  // 제목 스타일
  if (ws['H1']) ws['H1'].s = { ...titleStyle, ...centerStyle }
  if (ws['J1']) ws['J1'].s = { ...boldStyle, ...centerStyle }
  
  // 테이블 헤더 스타일
  for (let col = 0; col < 8; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRow - 1, c: col })
    if (ws[cellRef]) {
      ws[cellRef].s = { ...boldStyle, ...centerStyle, ...borderStyle }
    }
  }
  
  // 테이블 데이터 스타일
  for (let row = headerRow; row < headerRow + 12; row++) {
    for (let col = 0; col < 8; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: col })
      if (ws[cellRef]) {
        ws[cellRef].s = { ...borderStyle, alignment: { horizontal: col === 1 ? 'left' : 'center' } }
      }
    }
  }
  
  // 합계 행 스타일
  if (ws[`A${totalRow}`]) ws[`A${totalRow}`].s = { ...boldStyle, ...centerStyle, ...borderStyle }
  if (ws[`F${totalRow}`]) ws[`F${totalRow}`].s = { ...boldStyle, ...centerStyle, ...borderStyle }
  if (ws[`G${totalRow}`]) ws[`G${totalRow}`].s = { ...boldStyle, ...centerStyle, ...borderStyle }
  
  // 워크시트를 워크북에 추가
  XLSX.utils.book_append_sheet(wb, ws, '영수증')
  
  // 엑셀 파일 생성 및 다운로드
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(data, `영수증_${orderData.orderNumber}.xlsx`)
}

// 장바구니 데이터를 주문 데이터로 변환하는 헬퍼 함수
export function convertCartToOrderData(
  cartItems: CartItem[], 
  customerInfo?: { companyName: string; phone: string },
  shippingFee: number = 3000
): OrderData {
  const totalAmount = cartItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0)
  const totalTax = Math.floor(totalAmount * 0.1)
  
  return {
    orderNumber: `ORD-${Date.now()}`,
    customerName: customerInfo?.companyName || '미케드로',
    customerPhone: customerInfo?.phone || '010-2131-7540',
    orderDate: new Date().toLocaleDateString('ko-KR'),
    items: cartItems,
    totalAmount,
    shippingFee,
    finalAmount: totalAmount + shippingFee,
    totalTax
  }
}

export const generateReceipt = async (receiptData: ReceiptData) => {
  try {
    // 템플릿 파일 로드
    const templateResponse = await fetch('/templates/루소_영수증.xlsx')
    if (!templateResponse.ok) {
      throw new Error('템플릿 파일을 불러올 수 없습니다.')
    }
    
    const templateBuffer = await templateResponse.arrayBuffer()
    const workbook = XLSX.read(templateBuffer, { type: 'array' })
    
    // 첫 번째 워크시트 가져오기
    const worksheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[worksheetName]
    
    // 기본 정보 입력
    worksheet['B2'] = { t: 's', v: receiptData.orderNumber } // 주문번호
    worksheet['B3'] = { t: 's', v: receiptData.orderDate } // 주문일자
    worksheet['B4'] = { t: 's', v: receiptData.customerName } // 주문자명
    worksheet['B5'] = { t: 's', v: receiptData.customerPhone } // 주문자 연락처
    
    // 배송지 정보
    worksheet['B7'] = { t: 's', v: receiptData.shippingName } // 받는사람
    worksheet['B8'] = { t: 's', v: receiptData.shippingPhone } // 받는사람 연락처
    worksheet['B9'] = { t: 's', v: `(${receiptData.shippingPostalCode}) ${receiptData.shippingAddress}` } // 배송주소
    
    // 상품 정보 입력 (A12부터 시작한다고 가정)
    let currentRow = 12
    receiptData.items.forEach((item, index) => {
      worksheet[`A${currentRow + index}`] = { t: 's', v: item.productName }
      worksheet[`B${currentRow + index}`] = { t: 's', v: item.productCode }
      worksheet[`C${currentRow + index}`] = { t: 'n', v: item.quantity }
      worksheet[`D${currentRow + index}`] = { t: 'n', v: item.unitPrice }
      worksheet[`E${currentRow + index}`] = { t: 'n', v: item.totalPrice }
      
      if (item.options) {
        const optionText = Object.entries(item.options)
          .filter(([_, value]) => value)
          .map(([key, value]) => `${key}: ${value}`)
          .join(', ')
        worksheet[`F${currentRow + index}`] = { t: 's', v: optionText }
      }
    })
    
    // 합계 정보 (상품 목록 아래)
    const summaryRow = currentRow + receiptData.items.length + 2
    worksheet[`D${summaryRow}`] = { t: 's', v: '상품금액' }
    worksheet[`E${summaryRow}`] = { t: 'n', v: receiptData.subtotal }
    
    worksheet[`D${summaryRow + 1}`] = { t: 's', v: '배송비' }
    worksheet[`E${summaryRow + 1}`] = { t: 'n', v: receiptData.shippingFee }
    
    worksheet[`D${summaryRow + 2}`] = { t: 's', v: '총 결제금액' }
    worksheet[`E${summaryRow + 2}`] = { t: 'n', v: receiptData.totalAmount }
    
    // 배송 메모
    if (receiptData.notes) {
      worksheet[`B${summaryRow + 4}`] = { t: 's', v: receiptData.notes }
    }
    
    // 워크시트 범위 업데이트
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:F20')
    range.e.r = Math.max(range.e.r, summaryRow + 5)
    worksheet['!ref'] = XLSX.utils.encode_range(range)
    
    // 엑셀 파일 생성
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    
    // 파일 다운로드
    const fileName = `루소_영수증_${receiptData.orderNumber}.xlsx`
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

// 주문 관리용 타입 정의
export interface AdminOrderItem {
  id: string
  order_number: string
  user: {
    company_name: string
    representative_name: string
    phone: string
    address: string
  }
  total_amount: number
  shipping_fee: number
  status: string
  tracking_number?: string
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  notes?: string
  created_at: string
  order_items: Array<{
    product_name: string
    color: string
    size: string
    quantity: number
    shipped_quantity?: number
    unit_price: number
    total_price: number
  }>
}

export interface TrackingUploadData {
  orderNumber: string
  trackingNumber: string
  courier?: string
  notes?: string
  receiverName?: string
  receiverPhone?: string
  receiverAddress?: string
  companyName?: string
  itemName?: string
  itemQuantity?: string
}

// 주문 내역을 엑셀로 다운로드
export function downloadOrdersExcel(orders: AdminOrderItem[], filename?: string) {
  // 워크북 생성
  const wb = XLSX.utils.book_new()
  
  // 주문 목록 시트 데이터 준비
  const orderListData = orders.map((order, index) => ({
    '번호': index + 1,
    '주문번호': order.order_number,
    '업체명': order.user.company_name,
    '대표자명': order.user.representative_name,
    '연락처': order.user.phone,
    '주문금액': order.total_amount,
    '배송비': order.shipping_fee,
    '총금액': order.total_amount + order.shipping_fee,
    '주문상태': getStatusTextForExcel(order.status),
    '운송장번호': order.tracking_number || '',
    '받는사람': order.shipping_name,
    '받는사람연락처': order.shipping_phone,
    '배송주소': order.shipping_address,
    '배송메모': order.notes || '',
    '주문일시': formatDate(new Date(order.created_at)),
    '상품개수': order.order_items.length,
    '상품목록': order.order_items.map(item => 
      `${item.product_name} (${item.color}/${item.size}) x${item.quantity}`
    ).join(', ')
  }))
  
  // 주문 목록 시트 생성
  const orderListWS = XLSX.utils.json_to_sheet(orderListData)
  
  // 열 너비 설정
  orderListWS['!cols'] = [
    { wch: 6 },  // 번호
    { wch: 20 }, // 주문번호
    { wch: 20 }, // 업체명
    { wch: 12 }, // 대표자명
    { wch: 15 }, // 연락처
    { wch: 12 }, // 주문금액
    { wch: 8 },  // 배송비
    { wch: 12 }, // 총금액
    { wch: 10 }, // 주문상태
    { wch: 20 }, // 운송장번호
    { wch: 12 }, // 받는사람
    { wch: 15 }, // 받는사람연락처
    { wch: 30 }, // 배송주소
    { wch: 20 }, // 배송메모
    { wch: 15 }, // 주문일시
    { wch: 8 },  // 상품개수
    { wch: 50 }, // 상품목록
  ]
  
  XLSX.utils.book_append_sheet(wb, orderListWS, '주문목록')
  
  // 상세 주문 내역 시트 데이터 준비
  const detailData: any[] = []
  orders.forEach(order => {
    order.order_items.forEach((item, itemIndex) => {
      detailData.push({
        '주문번호': order.order_number,
        '업체명': order.user.company_name,
        '주문상태': getStatusTextForExcel(order.status),
        '상품순번': itemIndex + 1,
        '상품명': item.product_name,
        '색상': item.color,
        '사이즈': item.size,
        '수량': item.quantity,
        '단가': item.unit_price,
        '금액': item.total_price,
        '운송장번호': order.tracking_number || '',
        '받는사람': order.shipping_name,
        '받는사람연락처': order.shipping_phone,
        '배송주소': order.shipping_address,
        '주문일시': formatDate(new Date(order.created_at))
      })
    })
  })
  
  const detailWS = XLSX.utils.json_to_sheet(detailData)
  detailWS['!cols'] = [
    { wch: 20 }, // 주문번호
    { wch: 20 }, // 업체명
    { wch: 10 }, // 주문상태
    { wch: 8 },  // 상품순번
    { wch: 30 }, // 상품명
    { wch: 15 }, // 색상
    { wch: 10 }, // 사이즈
    { wch: 8 },  // 수량
    { wch: 12 }, // 단가
    { wch: 12 }, // 금액
    { wch: 20 }, // 운송장번호
    { wch: 12 }, // 받는사람
    { wch: 15 }, // 받는사람연락처
    { wch: 30 }, // 배송주소
    { wch: 15 }, // 주문일시
  ]
  
  XLSX.utils.book_append_sheet(wb, detailWS, '상품별상세')
  
  // 운송장 업로드 템플릿 시트 생성
  const trackingTemplateData = [
    {
      '주문번호': '예) 20250702-080341-7MPS',
      '운송장번호': '예) 1234567890123',
      '택배사': '예) CJ대한통운, 로젠택배, 한진택배 등',
      '비고': '예) 부분배송, 특이사항 등'
    }
  ]
  
  const trackingTemplateWS = XLSX.utils.json_to_sheet(trackingTemplateData)
  trackingTemplateWS['!cols'] = [
    { wch: 25 }, // 주문번호
    { wch: 20 }, // 운송장번호
    { wch: 15 }, // 택배사
    { wch: 30 }, // 비고
  ]
  
  XLSX.utils.book_append_sheet(wb, trackingTemplateWS, '운송장업로드템플릿')
  
  // 파일 다운로드
  const fileName = filename || `주문내역_${formatDate(new Date()).replace(/\./g, '')}.xlsx`
  XLSX.writeFile(wb, fileName)
}

// 운송장 업로드용 엑셀 템플릿 다운로드
export function downloadTrackingTemplate(orders: AdminOrderItem[]) {
  const wb = XLSX.utils.book_new()
  
  // 운송장 등록 대상 주문들만 필터링 (confirmed 상태)
  const confirmedOrders = orders.filter(order => order.status === 'confirmed')
  
  const templateData = confirmedOrders.map(order => ({
    '주문번호': order.order_number,
    '업체명': order.user.company_name,
    '받는사람': order.shipping_name,
    '배송주소': order.shipping_address,
    '운송장번호': '', // 입력할 부분
    '택배사': '', // 입력할 부분
    '비고': ''
  }))
  
  // 빈 템플릿이면 예시 데이터 추가
  if (templateData.length === 0) {
    templateData.push({
      '주문번호': '예) 20250702-080341-7MPS',
      '업체명': '예) 주식회사 샘플',
      '받는사람': '예) 홍길동',
      '배송주소': '예) 서울시 강남구 테헤란로 123',
      '운송장번호': '1234567890123',
      '택배사': 'CJ대한통운',
      '비고': '부분배송'
    })
  }
  
  const ws = XLSX.utils.json_to_sheet(templateData)
  ws['!cols'] = [
    { wch: 25 }, // 주문번호
    { wch: 20 }, // 업체명
    { wch: 12 }, // 받는사람
    { wch: 30 }, // 배송주소
    { wch: 20 }, // 운송장번호 (입력)
    { wch: 15 }, // 택배사 (입력)
    { wch: 30 }, // 비고 (입력)
  ]
  
  XLSX.utils.book_append_sheet(wb, ws, '운송장등록')
  
  const fileName = `운송장등록템플릿_${formatDate(new Date()).replace(/\./g, '')}.xlsx`
  XLSX.writeFile(wb, fileName)
}

// 업로드된 운송장 엑셀 파싱
export function parseTrackingExcel(file: File): Promise<TrackingUploadData[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // 첫 번째 시트 읽기
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        
        // JSON으로 변환
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        // 데이터 검증 및 변환
        const trackingData: TrackingUploadData[] = []
        
        jsonData.forEach((row: any, index) => {
          // 간단한 형식의 엑셀 파싱 (발주번호/주문번호, 상호명, 운송장번호)
          const orderNumber = (row['발주번호'] || row['주문번호'])?.toString().trim()
          const companyName = row['상호명']?.toString().trim()
          const trackingNumber = row['운송장번호']?.toString().trim()
          
          if (!orderNumber || !trackingNumber) {
            console.warn(`행 ${index + 2}: 발주번호(주문번호) 또는 운송장번호가 누락되었습니다.`)
            return
          }
          
          trackingData.push({
            orderNumber,
            trackingNumber,
            companyName,
            courier: 'CJ대한통운', // 기본값
            notes: '',
            receiverName: '',
            receiverPhone: '',
            receiverAddress: '',
            itemName: '',
            itemQuantity: ''
          })
        })
        
        resolve(trackingData)
      } catch (error) {
        reject(new Error('엑셀 파일 파싱 중 오류가 발생했습니다.'))
      }
    }
    
    reader.onerror = () => {
      reject(new Error('파일 읽기 중 오류가 발생했습니다.'))
    }
    
    reader.readAsArrayBuffer(file)
  })
}

// 상태 텍스트 변환 (엑셀용)
function getStatusTextForExcel(status: string): string {
  const statusMap: { [key: string]: string } = {
    pending: '주문접수',
    confirmed: '주문확정',
    shipped: '배송중',
    delivered: '배송완료',
    cancelled: '주문취소'
  }
  return statusMap[status] || status
}

// 엑셀 파일을 JSON 데이터로 변환
export const parseExcelFile = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        
        // 첫 번째 행을 헤더로 사용하고, 나머지를 데이터로 변환
        const headers = jsonData[0] as string[]
        const rows = jsonData.slice(1) as any[][]
        
        const result = rows.map(row => {
          const obj: any = {}
          headers.forEach((header, index) => {
            obj[header] = row[index] || ''
          })
          return obj
        })
        
        resolve(result)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => reject(new Error('파일 읽기 실패'))
    reader.readAsBinaryString(file)
  })
}

// JSON 데이터를 엑셀 파일로 다운로드
export const downloadExcel = (data: any[], filename: string, sheetName = 'Sheet1') => {
  try {
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    
    // 파일 다운로드
    XLSX.writeFile(workbook, `${filename}.xlsx`)
  } catch (error) {
    console.error('엑셀 다운로드 실패:', error)
    throw new Error('엑셀 파일 생성에 실패했습니다.')
  }
}

// 운송장 번호 일괄 업로드용 템플릿 생성
export const generateTrackingTemplate = (orders: any[]) => {
  const templateData = orders.map(order => ({
    '주문번호': order.order_number,
    '고객명': order.users?.company_name || '',
    '상품명': order.order_items?.map((item: any) => item.product_name).join(', ') || '',
    '운송장번호': '',
    '택배사': ''
  }))
  
  return templateData
}

// 사용자 목록 엑셀 다운로드용 데이터 변환
export const formatUsersForExcel = (users: any[]) => {
  return users.map(user => ({
    '회사명': user.company_name,
    '대표자명': user.representative_name,
    '이메일': user.email,
    '전화번호': user.phone,
    '사업자등록번호': user.business_number,
    '주소': user.address,
    '우편번호': user.postal_code,
    '승인상태': user.approval_status === 'approved' ? '승인' : 
                user.approval_status === 'pending' ? '대기' : '반려',
    '활성상태': user.is_active ? '활성' : '비활성',
    '가입일': new Date(user.created_at).toLocaleDateString('ko-KR')
  }))
}

// 주문 목록 엑셀 다운로드용 데이터 변환
export const formatOrdersForExcel = (orders: any[]) => {
  return orders.map(order => ({
    '주문번호': order.order_number,
    '고객명': order.users?.company_name || '',
    '대표자명': order.users?.representative_name || '',
    '총금액': order.total_amount?.toLocaleString() + '원',
    '배송비': order.shipping_fee?.toLocaleString() + '원',
    '주문상태': getOrderStatusText(order.status),
    '배송지명': order.shipping_name,
    '배송지주소': order.shipping_address,
    '운송장번호': order.tracking_number || '',
    '택배사': order.courier || '',
    '주문일': new Date(order.created_at).toLocaleDateString('ko-KR'),
    '배송일': order.shipped_at ? new Date(order.shipped_at).toLocaleDateString('ko-KR') : '',
    '상품목록': order.order_items?.map((item: any) => 
      `${item.product_name}(${item.color}/${item.size}) x${item.quantity}`
    ).join(', ') || ''
  }))
}

// 상품 목록 엑셀 다운로드용 데이터 변환
export const formatProductsForExcel = (products: any[]) => {
  return products.map(product => ({
    '상품코드': product.code,
    '상품명': product.name,
    '카테고리': product.category?.name || '',
    '판매가': product.price?.toLocaleString() + '원',
    '세일가': product.sale_price ? product.sale_price.toLocaleString() + '원' : '',
    '재고수량': product.stock_quantity,
    '활성상태': product.is_active ? '활성' : '비활성',
    '인기상품': product.is_featured ? 'Y' : 'N',
    '세일여부': product.is_on_sale ? 'Y' : 'N',
    '등록일': new Date(product.created_at).toLocaleDateString('ko-KR'),
    '수정일': new Date(product.updated_at).toLocaleDateString('ko-KR')
  }))
}

// 마일리지 내역 엑셀 다운로드용 데이터 변환
export const formatMileageForExcel = (mileages: any[]) => {
  return mileages.map(mileage => ({
    '고객명': mileage.users?.company_name || '',
    '대표자명': mileage.users?.representative_name || '',
    '이메일': mileage.users?.email || '',
    '유형': mileage.type === 'earn' ? '적립' : '차감',
    '금액': mileage.amount?.toLocaleString() + '원',
    '설명': mileage.description,
    '소스': getMileageSourceText(mileage.source),
    '상태': getMileageStatusText(mileage.status),
    '주문번호': mileage.order_id || '',
    '처리일': new Date(mileage.created_at).toLocaleDateString('ko-KR')
  }))
}

// 샘플 목록 엑셀 다운로드용 데이터 변환
export const formatSamplesForExcel = (samples: any[]) => {
  return samples.map(sample => ({
    '샘플번호': sample.sample_number,
    '고객명': sample.customer_name,
    '상품명': sample.product_name,
    '옵션': sample.product_options,
    '수량': sample.quantity,
    '출고일': new Date(sample.outgoing_date).toLocaleDateString('ko-KR'),
    '상태': getSampleStatusText(sample.status),
    '청구금액': sample.charge_amount?.toLocaleString() + '원',
    '청구방법': sample.charge_method || '',
    '메모': sample.notes || ''
  }))
}

// 헬퍼 함수들
const getOrderStatusText = (status: string) => {
  const statusMap: { [key: string]: string } = {
    pending: '주문접수',
    confirmed: '주문확인',
    shipped: '배송중',
    delivered: '배송완료',
    cancelled: '주문취소'
  }
  return statusMap[status] || status
}

const getMileageSourceText = (source: string) => {
  const sourceMap: { [key: string]: string } = {
    manual: '수동',
    auto: '자동',
    order: '주문',
    refund: '환불'
  }
  return sourceMap[source] || source
}

const getMileageStatusText = (status: string) => {
  const statusMap: { [key: string]: string } = {
    pending: '대기',
    completed: '완료',
    cancelled: '취소'
  }
  return statusMap[status] || status
}

const getSampleStatusText = (status: string) => {
  const statusMap: { [key: string]: string } = {
    pending: '대기',
    recovered: '회수',
    overdue: '연체',
    charged: '청구'
  }
  return statusMap[status] || status
}

// 주문 배송 정보 엑셀 다운로드 (사용자 요청 형식)
export function downloadOrderShippingExcel(orders: AdminOrderItem[], filename?: string) {
  const wb = XLSX.utils.book_new()
  
  // 배송 정보 데이터 준비
  const shippingData: any[] = []
  
  orders.forEach(order => {
    order.order_items.forEach(item => {
      shippingData.push({
        '받는분 성명': order.shipping_name,
        '받는분 전화번호': order.shipping_phone,
        '받는분 주소': order.shipping_address,
        '품목명': '의류',
        '내품명': `${item.product_name} (${item.color}/${item.size})`,
        '내품수량': item.shipped_quantity || 0,
        '배송 메세지': order.notes || '',
        '상호명': order.user.company_name
      })
    })
  })
  
  const ws = XLSX.utils.json_to_sheet(shippingData)
  
  // 열 너비 설정
  ws['!cols'] = [
    { wch: 15 }, // 받는분 성명
    { wch: 15 }, // 받는분 전화번호
    { wch: 40 }, // 받는분 주소
    { wch: 10 }, // 품목명
    { wch: 35 }, // 내품명
    { wch: 10 }, // 내품수량
    { wch: 30 }, // 배송 메세지
    { wch: 20 }, // 상호명
  ]
  
  XLSX.utils.book_append_sheet(wb, ws, '배송정보')
  
  // 파일 다운로드
  const fileName = filename || `주문배송정보_${formatDate(new Date()).replace(/\./g, '')}.xlsx`
  
  // 엑셀 파일 생성
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  
  // 파일 다운로드
  saveAs(blob, fileName)
}

// 샘플 배송 정보 엑셀 다운로드 (사용자 요청 형식)
export function downloadSampleShippingExcel(samples: any[], filename?: string) {
  const wb = XLSX.utils.book_new()
  
  // 배송 정보 데이터 준비
  const shippingData = samples.map(sample => {
    // 옵션 정보 파싱 (product_options에서 색상, 사이즈 추출)
    let color = '기본'
    let size = '기본'
    
    if (sample.product_options) {
      try {
        // "색상: 블랙, 사이즈: M" 또는 "블랙/M" 형식 모두 처리
        if (sample.product_options.includes('색상:') && sample.product_options.includes('사이즈:')) {
          const options = sample.product_options.split(',').map((opt: string) => opt.trim())
          options.forEach((opt: string) => {
            if (opt.includes('색상:')) {
              color = opt.replace('색상:', '').trim()
            } else if (opt.includes('사이즈:')) {
              size = opt.replace('사이즈:', '').trim()
            }
          })
        } else if (sample.product_options.includes('/')) {
          // "블랙/M" 형식
          const parts = sample.product_options.split('/')
          if (parts.length >= 2) {
            color = parts[0].trim()
            size = parts[1].trim()
          }
        } else {
          // 단일 옵션인 경우 그대로 사용
          color = sample.product_options
        }
      } catch (e) {
        console.warn('옵션 파싱 오류:', e)
        color = sample.product_options
      }
    }
    
    // 내품명 생성 (상품명 (색상/사이즈) 형식)
    const itemName = `${sample.product_name} (${color}/${size})`

    return {
      '받는분 성명': sample.users?.representative_name || sample.customer_name || '',
      '받는분 전화번호': sample.users?.phone || '',
      '받는분 주소': sample.delivery_address || '',
      '품목명': '의류',
      '내품명': itemName,
      '내품수량': sample.quantity || 1,
      '배송 메세지': '',
      '상호명': sample.users?.company_name || sample.customer_name || ''
    }
  })
  
  const ws = XLSX.utils.json_to_sheet(shippingData)
  
  // 열 너비 설정
  ws['!cols'] = [
    { wch: 15 }, // 받는분 성명
    { wch: 15 }, // 받는분 전화번호
    { wch: 40 }, // 받는분 주소
    { wch: 10 }, // 품목명
    { wch: 35 }, // 내품명
    { wch: 10 }, // 내품수량
    { wch: 30 }, // 배송 메세지
    { wch: 20 }, // 상호명
  ]
  
  XLSX.utils.book_append_sheet(wb, ws, '샘플배송정보')
  
  // 파일 다운로드
  const fileName = filename || `샘플배송정보_${formatDate(new Date()).replace(/\./g, '')}.xlsx`
  
  // 엑셀 파일 생성
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  
  // 파일 다운로드
  saveAs(blob, fileName)
} 

// 운송장 템플릿 다운로드 (발주번호|상호명|운송장번호 형식)
export function downloadTrackingNumberTemplate(orders: AdminOrderItem[], filename?: string) {
  const wb = XLSX.utils.book_new()
  
  // 운송장 등록 템플릿 데이터 생성
  const templateData = orders.map(order => ({
    '발주번호': order.order_number,
    '상호명': order.user.company_name,
    '운송장번호': '' // 비워둠
  }))
  
  // 데이터가 없을 경우 예시 데이터 추가
  if (templateData.length === 0) {
    templateData.push({
      '발주번호': 'PO0000000000000',
      '상호명': '샘플 업체명',
      '운송장번호': ''
    })
  }
  
  const ws = XLSX.utils.json_to_sheet(templateData)
  
  // 워크시트 범위를 명시적으로 3개 열로 제한
  const rowCount = templateData.length + 1 // 헤더 포함
  ws['!ref'] = `A1:C${rowCount}`
  
  // 열 너비 설정 (3개 열만)
  ws['!cols'] = [
    { wch: 25 }, // A열: 발주번호
    { wch: 20 }, // B열: 상호명
    { wch: 20 }, // C열: 운송장번호
  ]
  
  // 헤더 스타일 설정
  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { rgb: '4F81BD' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  }
  
  // 헤더에 스타일 적용 (A1, B1, C1만)
  if (ws['A1']) ws['A1'].s = headerStyle
  if (ws['B1']) ws['B1'].s = headerStyle
  if (ws['C1']) ws['C1'].s = headerStyle
  
  // 데이터 셀에 테두리 추가 (A, B, C 열만)
  for (let i = 2; i <= templateData.length + 1; i++) {
    const borderStyle = {
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
    }
    if (ws[`A${i}`]) ws[`A${i}`].s = borderStyle
    if (ws[`B${i}`]) ws[`B${i}`].s = borderStyle
    if (ws[`C${i}`]) ws[`C${i}`].s = borderStyle
  }
  
  XLSX.utils.book_append_sheet(wb, ws, '운송장템플릿')
  
  // 파일명 생성
  const fileName = filename || `운송장템플릿_${getKoreaDate()}.xlsx`
  
  // 엑셀 파일 생성 및 다운로드 (saveAs 사용)
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, fileName)
}

 