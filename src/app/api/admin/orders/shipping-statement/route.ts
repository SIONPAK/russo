import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx'
import { getCurrentKoreanDateTime } from '@/shared/lib/utils'

// 최종 명세서 엑셀 다운로드 API (거래명세서 형식)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { orderIds } = body

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '주문 ID가 필요합니다.'
      }, { status: 400 })
    }

    // 주문 정보 조회
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        users!orders_user_id_fkey (
          id,
          company_name,
          representative_name,
          phone,
          address,
          business_number,
          email
        ),
        order_items!order_items_order_id_fkey (
          id,
          product_name,
          product_code,
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
      .in('id', orderIds)

    if (orderError || !orders || orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: '주문을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 모든 주문의 거래명세서를 하나의 엑셀 파일로 생성
    const excelBuffer = await generateMultipleStatementsExcel(orders)
    const fileName = `최종명세서_${new Date().toISOString().split('T')[0]}.xlsx`

    // 엑셀 파일을 직접 반환
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': excelBuffer.length.toString()
      }
    })

  } catch (error) {
    console.error('Final statement API error:', error)
    return NextResponse.json({
      success: false,
      error: '최종 명세서 생성 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 출고 명세서 목록 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const companyName = searchParams.get('companyName')
    const emailSent = searchParams.get('emailSent')

    // 출고 명세서 조회 (실제 출고가 완료된 주문들)
    let query = supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total_amount,
        shipped_at,
        created_at,
        users!inner(
          company_name,
          customer_grade,
          email
        ),
        order_items!inner(
          product_name,
          color,
          size,
          quantity,
          shipped_quantity,
          unit_price
        )
      `)
      .not('shipped_at', 'is', null)
      .gt('order_items.shipped_quantity', 0)

    // 날짜 필터
    if (startDate && endDate) {
      query = query
        .gte('shipped_at', `${startDate}T00:00:00`)
        .lte('shipped_at', `${endDate}T23:59:59`)
    }

    // 업체명 필터
    if (companyName) {
      query = query.ilike('users.company_name', `%${companyName}%`)
    }

    const { data: orders, error: ordersError } = await query
      .order('shipped_at', { ascending: false })

    if (ordersError) {
      console.error('Orders fetch error:', ordersError)
      return NextResponse.json({ 
        success: false, 
        error: '출고 명세서를 조회할 수 없습니다.' 
      }, { status: 500 })
    }

    // 명세서 데이터 구성
    const statements = []
    
    for (const order of orders) {
      const shippedItems = order.order_items.filter((item: any) => 
        item.shipped_quantity && item.shipped_quantity > 0
      )

      const totalAmount = shippedItems.reduce((sum: number, item: any) => 
        sum + (item.shipped_quantity * item.unit_price), 0
      )

      // 실제 이메일 발송 기록 확인
      const { data: emailLog } = await supabase
        .from('email_logs')
        .select('*')
        .eq('order_id', order.id)
        .eq('email_type', 'shipping_statement')
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(1)
        .single()

      const emailSentStatus = !!emailLog
      const emailSentAt = emailLog?.sent_at || null

      statements.push({
        id: order.id,
        order_id: order.id,
        order_number: order.order_number,
        company_name: (order.users as any).company_name,
        customer_grade: (order.users as any).customer_grade,
        created_at: order.created_at,
        shipped_at: order.shipped_at,
        email_sent: emailSentStatus,
        email_sent_at: emailSentAt,
        total_amount: totalAmount,
        items: shippedItems.map((item: any) => ({
          product_name: item.product_name,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          shipped_quantity: item.shipped_quantity,
          unit_price: item.unit_price,
          total_price: item.shipped_quantity * item.unit_price
        }))
      })
    }

    // 이메일 발송 필터 적용
    let filteredStatements = statements
    if (emailSent === 'sent') {
      filteredStatements = statements.filter(s => s.email_sent)
    } else if (emailSent === 'not_sent') {
      filteredStatements = statements.filter(s => !s.email_sent)
    }

    return NextResponse.json({
      success: true,
      data: filteredStatements
    })

  } catch (error) {
    console.error('Shipping statements fetch error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '출고 명세서 조회 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
}

// 여러 주문의 거래명세서를 하나의 엑셀 파일로 생성
async function generateMultipleStatementsExcel(orders: any[]): Promise<Buffer> {
  const wb = XLSX.utils.book_new()
  
  for (const order of orders) {
    // 실제 출고된 상품만 필터링
    const shippedItems = order.order_items.filter((item: any) => 
      item.shipped_quantity && item.shipped_quantity > 0
    )
    
    if (shippedItems.length === 0) {
      continue // 출고된 상품이 없으면 스킵
    }
    
    // 거래명세서 데이터 생성
    const statementData = {
      statementNumber: `STMT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${order.order_number}`,
      orderNumber: order.order_number,
      issueDate: new Date().toISOString().split('T')[0],
      
      // 고객 정보
      customer: {
        companyName: order.users.company_name,
        representativeName: order.users.representative_name,
        businessNumber: order.users.business_number,
        phone: order.users.phone,
        email: order.users.email,
        address: order.users.address
      },
      
      // 배송 정보
      shipping: {
        recipientName: order.shipping_name,
        phone: order.shipping_phone,
        address: order.shipping_address,
        postalCode: order.shipping_postal_code,
        notes: order.notes
      },
      
      // 출고 상품 정보
      items: shippedItems,
      
      // 출고 현황 계산
      shippingStatus: {
        totalItemsOrdered: order.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0),
        totalItemsShipped: shippedItems.reduce((sum: number, item: any) => sum + item.shipped_quantity, 0),
        completionRate: Math.round((shippedItems.reduce((sum: number, item: any) => sum + item.shipped_quantity, 0) / order.order_items.reduce((sum: number, item: any) => sum + item.quantity, 0)) * 100)
      },
      
      // 금액 정보
      amounts: {
        originalTotal: order.total_amount,
        shippedTotal: shippedItems.reduce((sum: number, item: any) => sum + (item.unit_price * item.shipped_quantity), 0),
        difference: order.total_amount - shippedItems.reduce((sum: number, item: any) => sum + (item.unit_price * item.shipped_quantity), 0),
        finalTotal: shippedItems.reduce((sum: number, item: any) => sum + (item.unit_price * item.shipped_quantity), 0)
      }
    }
    
    // 각 주문별로 시트 생성
    const wsData = [
      ['🧾 거래명세서 (배송 동봉용)'],
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

    // 출고 상품 목록 헤더
    wsData.push(
      ['📋 출고 상품 목록'],
      ['번호', '상품명', '상품코드', '색상', '사이즈', '주문수량', '출고수량', '단가', '금액']
    )

    // 출고 상품 목록
    shippedItems.forEach((item: any, index: number) => {
      wsData.push([
        index + 1,
        item.product_name,
        item.product_code || item.products?.code || '',
        item.color || '-',
        item.size || '-',
        item.quantity,
        item.shipped_quantity,
        item.unit_price.toLocaleString() + '원',
        (item.unit_price * item.shipped_quantity).toLocaleString() + '원'
      ])
    })

    // 합계 정보
    wsData.push(
      [''],
      ['💰 금액 정보'],
      ['원 주문 금액', statementData.amounts.originalTotal.toLocaleString() + '원'],
      ['실제 출고 금액', statementData.amounts.shippedTotal.toLocaleString() + '원'],
      ['최종 결제 금액', statementData.amounts.finalTotal.toLocaleString() + '원']
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
      ['발행일시', getCurrentKoreanDateTime()],
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

    // 시트 이름을 업체명으로 설정 (최대 31자)
    const sheetName = statementData.customer.companyName.length > 31 
      ? statementData.customer.companyName.substring(0, 31)
      : statementData.customer.companyName
    
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }
  
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
} 