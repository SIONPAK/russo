import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime, getKoreaDate, getKoreaDateFormatted } from '@/shared/lib/utils'
import * as XLSX from 'xlsx'

// 유저용 거래명세서 조회 API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 권한 확인 제거 - 일반 클라이언트 사용

    // 주문 정보 조회 (본인 주문만)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          id,
          company_name,
          representative_name,
          email,
          phone,
          address,
          business_number
        ),
        order_items!order_items_order_id_fkey (
          id,
          product_id,
          product_name,
          quantity,
          shipped_quantity,
          unit_price,
          total_price,
          color,
          size,
          products!order_items_product_id_fkey (
            id,
            name,
            code
          )
        )
      `)
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({
        success: false,
        error: '주문을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 배송중이거나 배송완료 상태일 때만 거래명세서 제공
    if (order.status !== 'shipped' && order.status !== 'delivered') {
      return NextResponse.json({
        success: false,
        error: '거래명세서는 상품 출고 후 제공됩니다.'
      }, { status: 400 })
    }

    // 출고된 상품이 있는지 확인
    const hasShippedItems = order.order_items.some((item: any) => 
      item.shipped_quantity && item.shipped_quantity > 0
    )

    if (!hasShippedItems) {
      return NextResponse.json({
        success: false,
        error: '아직 출고된 상품이 없습니다.'
      }, { status: 400 })
    }

    // 거래명세서 데이터 생성
    const statementData = await generateUserStatementData(order)
    
    // 엑셀 파일 생성
    const excelBuffer = await generateUserStatementExcel(statementData)
    
    // 파일명 생성
    const fileName = `거래명세서_${order.order_number}_${getKoreaDate()}.xlsx`
    
    // 엑셀 파일을 Base64로 인코딩하여 직접 다운로드 제공
    const base64 = Buffer.from(excelBuffer).toString('base64')
    const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`

    return NextResponse.json({
      success: true,
      data: {
        order: {
          id: order.id,
          order_number: order.order_number,
          customer_name: order.users?.company_name,
          total_amount: statementData.amounts.finalTotal
        },
        statement: statementData,
        file_url: dataUrl,
        fileName: fileName
      },
      message: '거래명세서가 생성되었습니다.'
    })

  } catch (error) {
    console.error('User statement API error:', error)
    return NextResponse.json({
      success: false,
      error: '거래명세서 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 유저용 거래명세서 데이터 생성
async function generateUserStatementData(order: any) {
  // 실제 출고된 상품만 처리
  const shippedItems = order.order_items.filter((item: any) => 
    item.shipped_quantity && item.shipped_quantity > 0
  )

  // 미출고 상품 처리
  const unshippedItems = order.order_items.filter((item: any) => {
    const shipped = item.shipped_quantity || 0
    return shipped === 0 || shipped < item.quantity
  }).map((item: any) => ({
    productId: item.product_id,
    productName: item.product_name,
    productCode: item.products?.code || '',
    color: item.color,
    size: item.size,
    orderedQuantity: item.quantity,
    shippedQuantity: item.shipped_quantity || 0,
    unshippedQuantity: item.quantity - (item.shipped_quantity || 0),
    unitPrice: item.unit_price
  }))

  // 부분출고 여부 확인
  const hasPartialShipping = order.order_items.some((item: any) => {
    const shipped = item.shipped_quantity || 0
    return shipped > 0 && shipped < item.quantity
  })

  // 실제 출고 금액 계산
  const actualTotal = shippedItems.reduce((sum: number, item: any) => 
    sum + (item.unit_price * item.shipped_quantity), 0
  )

  // 원래 주문 금액
  const originalTotal = order.order_items.reduce((sum: number, item: any) => 
    sum + item.total_price, 0
  )

  return {
    // 기본 정보
    statementNumber: `TXN-${getKoreaDateFormatted()}-${order.order_number}`,
    orderNumber: order.order_number,
    issueDate: getKoreaDate(),
    statementType: 'user_transaction', // 유저 거래명세서
    
    // 고객 정보
    customer: {
      companyName: order.users.company_name,
      representativeName: order.users.representative_name,
      businessNumber: order.users.business_number,
      phone: order.users.phone,
      address: order.users.address,
      email: order.users.email
    },
    
    // 배송 정보
    shipping: {
      recipientName: order.shipping_name,
      phone: order.shipping_phone,
      address: order.shipping_address,
      postalCode: order.shipping_postal_code,
      notes: order.notes
    },
    
    // 실제 출고 상품 정보
    shippedItems: shippedItems.map((item: any) => ({
      productId: item.product_id,
      productName: item.product_name,
      productCode: item.products?.code || '',
      color: item.color,
      size: item.size,
      orderedQuantity: item.quantity,
      shippedQuantity: item.shipped_quantity,
      unitPrice: item.unit_price,
      totalPrice: item.unit_price * item.shipped_quantity
    })),
    
    // 미출고 상품 정보
    unshippedItems,
    
    // 출고 현황
    shippingStatus: {
      totalItemsOrdered: order.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0),
      totalItemsShipped: shippedItems.reduce((sum: number, item: any) => sum + item.shipped_quantity, 0),
      hasPartialShipping,
      hasUnshippedItems: unshippedItems.length > 0,
      completionRate: Math.round((shippedItems.reduce((sum: number, item: any) => sum + item.shipped_quantity, 0) / order.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0)) * 100)
    },
    
    // 금액 정보
    amounts: {
      originalSubtotal: originalTotal,
      actualSubtotal: actualTotal,
      shippingFee: order.shipping_fee || 0,
      finalTotal: actualTotal + (order.shipping_fee || 0),
      difference: originalTotal - actualTotal
    }
  }
}

// 유저용 거래명세서 엑셀 생성
async function generateUserStatementExcel(statementData: any): Promise<Buffer> {
  const wb = XLSX.utils.book_new()
  
  // 거래명세서 시트 생성
  const wsData = [
    ['🧾 거래명세서 (고객용)'],
    [''],
    ['📋 기본 정보'],
    ['명세서 번호', statementData.statementNumber],
    ['발행일', statementData.issueDate],
    ['주문번호', statementData.orderNumber],
    [''],
    ['🏢 고객 정보'],
    ['업체명', statementData.customer.companyName],
    ['대표자명', statementData.customer.representativeName],
    ['사업자번호', statementData.customer.businessNumber],
    ['연락처', statementData.customer.phone],
    ['이메일', statementData.customer.email],
    ['주소', statementData.customer.address],
    [''],
    ['📦 배송 정보'],
    ['받는사람', statementData.shipping.recipientName],
    ['연락처', statementData.shipping.phone],
    ['배송주소', statementData.shipping.address],
    ['우편번호', statementData.shipping.postalCode],
    ['배송메모', statementData.shipping.notes || '-'],
    ['']
  ]

  // 출고 현황 요약
  wsData.push(
    ['📊 출고 현황 요약'],
    ['전체 주문 수량', `${statementData.shippingStatus.totalItemsOrdered}개`],
    ['실제 출고 수량', `${statementData.shippingStatus.totalItemsShipped}개`],
    ['출고 완료율', `${statementData.shippingStatus.completionRate}%`],
    ['']
  )

  // 실제 출고 상품 목록
  if (statementData.shippedItems.length > 0) {
    wsData.push(
      ['✅ 출고 완료 상품 (고객님께서 받으신 상품)'],
      ['번호', '상품명', '상품코드', '색상', '사이즈', '주문수량', '출고수량', '단가', '출고금액']
    )

    statementData.shippedItems.forEach((item: any, index: number) => {
      wsData.push([
        index + 1,
        item.productName,
        item.productCode,
        item.color,
        item.size,
        item.orderedQuantity,
        item.shippedQuantity,
        item.unitPrice.toLocaleString(),
        item.totalPrice.toLocaleString()
      ])
    })
    wsData.push([''])
  }

  // 미출고 상품 목록
  if (statementData.unshippedItems.length > 0) {
    wsData.push(
      ['⏳ 추가 배송 예정 상품 (재고 확보 시 배송)'],
      ['번호', '상품명', '색상', '사이즈', '주문수량', '출고수량', '미출고수량', '단가', '예상금액']
    )

    statementData.unshippedItems.forEach((item: any, index: number) => {
      wsData.push([
        index + 1,
        item.productName,
        item.color,
        item.size,
        item.orderedQuantity,
        item.shippedQuantity,
        item.unshippedQuantity,
        item.unitPrice.toLocaleString(),
        (item.unitPrice * item.unshippedQuantity).toLocaleString()
      ])
    })
    wsData.push([''])
  }

  // 금액 정보
  wsData.push(
    ['💰 금액 정보'],
    ['원래 주문금액', statementData.amounts.originalSubtotal.toLocaleString() + '원'],
    ['실제 출고금액', statementData.amounts.actualSubtotal.toLocaleString() + '원'],
    ['배송비', statementData.amounts.shippingFee.toLocaleString() + '원'],
    ['최종 결제금액', statementData.amounts.finalTotal.toLocaleString() + '원'],
    ['']
  )

  if (statementData.amounts.difference > 0) {
    wsData.push(
      ['📝 미출고 상품 안내'],
      ['미출고 상품 금액', statementData.amounts.difference.toLocaleString() + '원'],
      ['처리 방법', '재고 확보 시 추가 배송 또는 환불'],
      ['문의 방법', '고객센터: 010-2131-7540'],
      ['']
    )
  }

  // 안내사항
  wsData.push(
    ['📌 중요 안내사항'],
    ['1. 본 거래명세서는 실제 출고된 상품만을 기준으로 작성되었습니다.'],
    ['2. 문의사항은 고객센터(010-2131-7540)로 연락 주시기 바랍니다.'],
    [''],
    ['발행일시', getKoreaTime()],
    ['발행업체', '(주) 루소 | 010-2131-7540 | bsion5185@gmail.com']
  )

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  
  // 열 너비 설정
  ws['!cols'] = [
    { wch: 8 },  // 번호
    { wch: 25 }, // 상품명
    { wch: 12 }, // 상품코드
    { wch: 10 }, // 색상
    { wch: 10 }, // 사이즈
    { wch: 10 }, // 주문수량
    { wch: 10 }, // 출고수량
    { wch: 12 }, // 단가
    { wch: 12 }, // 금액
  ]

  XLSX.utils.book_append_sheet(wb, ws, '거래명세서')
  
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
} 