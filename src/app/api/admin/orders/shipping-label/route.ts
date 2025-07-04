import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx'

// CJ대한통운 송장 출력 양식 생성 API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { orderIds, shippingCompany = 'CJ대한통운' } = body

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
          zip_code
        ),
        order_items!order_items_order_id_fkey (
          id,
          product_name,
          quantity,
          unit_price,
          total_price,
          color,
          size
        )
      `)
      .in('id', orderIds)

    if (orderError || !orders) {
      return NextResponse.json({
        success: false,
        error: '주문 정보를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 엑셀 송장 양식 생성
    const excelBuffer = await generateShippingExcel(orders, shippingCompany)
    
    // 파일 저장 (실제로는 클라우드 스토리지에 저장)
    const fileName = `shipping-labels-${shippingCompany}-${new Date().toISOString().split('T')[0]}.xlsx`
    const fileUrl = `/documents/shipping-labels/${fileName}`

    return NextResponse.json({
      success: true,
      data: {
        fileName,
        fileUrl,
        totalOrders: orders.length,
        shippingCompany,
        orders: orders.map(order => ({
          orderId: order.id,
          orderNumber: order.order_number,
          customerName: order.users.company_name,
          totalAmount: order.total_amount
        }))
      },
      message: `${orders.length}개 주문의 송장 양식이 생성되었습니다.`
    })

  } catch (error) {
    console.error('Shipping label API error:', error)
    return NextResponse.json({
      success: false,
      error: '송장 양식 생성 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 엑셀 송장 양식 생성
async function generateShippingExcel(orders: any[], shippingCompany: string): Promise<Buffer> {
  const wb = XLSX.utils.book_new()
  
  // CJ대한통운 송장 양식 시트 생성
  const wsData = [
    ['배송업체:', shippingCompany],
    ['생성일:', new Date().toISOString().split('T')[0]],
    ['총 주문 수:', orders.length],
    [''],
    ['주문번호', '고객사명', '대표자명', '연락처', '주소', '우편번호', '상품명', '수량', '총중량(kg)', '배송비', '특이사항'],
  ]

  // 주문별 송장 정보 추가
  orders.forEach((order: any) => {
    // 상품명 목록
    const productNames = order.order_items.map((item: any) => 
      `${item.product_name} ${item.color ? `(${item.color})` : ''} ${item.size ? `[${item.size}]` : ''} (${item.quantity}개)`
    ).join(', ')

    // 총 수량
    const totalQuantity = order.order_items.reduce((sum: number, item: any) => 
      sum + item.quantity, 0
    )

    // 기본 중량 계산 (실제로는 상품별 중량 설정 필요)
    const estimatedWeight = totalQuantity * 0.5 // 개당 0.5kg 추정

    wsData.push([
      order.order_number,
      order.users.company_name,
      order.users.representative_name,
      order.users.phone,
      order.users.address,
      order.users.zip_code || '',
      productNames,
      totalQuantity,
      estimatedWeight.toFixed(2),
      order.shipping_fee || 0,
      order.delivery_notes || ''
    ])
  })

  // 송장 업로드 양식 시트 추가
  wsData.push(
    [''],
    ['※ 송장번호 입력 후 업로드하세요'],
    ['주문번호', '송장번호', '배송상태', '비고'],
  )

  // 송장번호 입력용 빈 행 추가
  orders.forEach((order: any) => {
    wsData.push([
      order.order_number,
      '', // 송장번호 입력란
      '배송준비중', // 기본 상태
      '' // 비고
    ])
  })

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  
  // 열 너비 설정
  ws['!cols'] = [
    { wch: 15 }, // 주문번호
    { wch: 20 }, // 고객사명
    { wch: 12 }, // 대표자명
    { wch: 15 }, // 연락처
    { wch: 40 }, // 주소
    { wch: 10 }, // 우편번호
    { wch: 50 }, // 상품명
    { wch: 8 },  // 수량
    { wch: 12 }, // 총중량
    { wch: 10 }, // 배송비
    { wch: 20 }, // 특이사항
  ]

  XLSX.utils.book_append_sheet(wb, ws, '송장양식')
  
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

// GET - 송장 양식 템플릿 다운로드
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shippingCompany = searchParams.get('company') || 'CJ대한통운'
    
    // 빈 송장 양식 템플릿 생성
    const templateData = await generateShippingTemplate(shippingCompany)
    
    return NextResponse.json({
      success: true,
      data: {
        templateUrl: `/templates/shipping-template-${shippingCompany}.xlsx`,
        shippingCompany,
        columns: [
          '주문번호',
          '고객사명', 
          '대표자명',
          '연락처',
          '주소',
          '우편번호',
          '상품명',
          '수량',
          '총중량(kg)',
          '배송비',
          '특이사항'
        ],
        uploadColumns: [
          '주문번호',
          '송장번호',
          '배송상태',
          '비고'
        ]
      },
      message: '송장 양식 템플릿이 생성되었습니다.'
    })

  } catch (error) {
    console.error('Shipping template error:', error)
    return NextResponse.json({
      success: false,
      error: '송장 양식 템플릿 생성 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 송장 양식 템플릿 생성
async function generateShippingTemplate(shippingCompany: string) {
  const wb = XLSX.utils.book_new()
  
  const wsData = [
    ['배송업체 송장 양식'],
    ['배송업체:', shippingCompany],
    [''],
    ['주문번호', '고객사명', '대표자명', '연락처', '주소', '우편번호', '상품명', '수량', '총중량(kg)', '배송비', '특이사항'],
    ['예시) ORD-20240101-001', '(주)테스트', '홍길동', '010-1234-5678', '서울시 강남구 테헤란로 123', '06234', '상품A (2개)', '2', '1.5', '3000', '문 앞 배송'],
    [''],
    ['※ 송장번호 업로드 양식'],
    ['주문번호', '송장번호', '배송상태', '비고'],
    ['예시) ORD-20240101-001', '1234567890123', '배송중', '']
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  
  // 열 너비 설정
  ws['!cols'] = [
    { wch: 15 }, // 주문번호
    { wch: 20 }, // 고객사명
    { wch: 12 }, // 대표자명
    { wch: 15 }, // 연락처
    { wch: 40 }, // 주소
    { wch: 10 }, // 우편번호
    { wch: 50 }, // 상품명
    { wch: 8 },  // 수량
    { wch: 12 }, // 총중량
    { wch: 10 }, // 배송비
    { wch: 20 }, // 특이사항
  ]

  XLSX.utils.book_append_sheet(wb, ws, '송장템플릿')
  
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
} 