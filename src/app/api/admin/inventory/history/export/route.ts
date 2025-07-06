import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const productId = searchParams.get('productId') || ''

    // 권한 확인 제거 - 일반 클라이언트 사용

    // 주문 정보 먼저 조회 (날짜 필터링을 위해)
    let orderQuery = supabase
      .from('orders')
      .select('id, order_number, status, created_at, user_id')

    // 날짜 필터
    if (startDate) {
      orderQuery = orderQuery.gte('created_at', `${startDate}T00:00:00`)
    }
    if (endDate) {
      orderQuery = orderQuery.lte('created_at', `${endDate}T23:59:59`)
    }

    const { data: orders, error: orderError } = await orderQuery.order('created_at', { ascending: false }).limit(10000)

    if (orderError) {
      console.error('Order fetch error:', orderError)
      return NextResponse.json({ 
        success: false, 
        error: '주문 데이터를 조회할 수 없습니다.' 
      }, { status: 500 })
    }

    if (!orders || orders.length === 0) {
      // 빈 엑셀 파일 생성
      const emptyData = [{
        '번호': '',
        '상품코드': '',
        '상품명': '',
        '색상': '',
        '사이즈': '',
        '변경유형': '',
        '주문수량': '',
        '출고수량': '',
        '변경수량': '',
        '주문번호': '',
        '고객사': '',
        '주문상태': '',
        '변경일시': ''
      }]
      
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(emptyData)
      
      // 열 너비 설정
      const colWidths = [
        { wch: 6 }, { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
        { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 18 }
      ]
      ws['!cols'] = colWidths
      
      XLSX.utils.book_append_sheet(wb, ws, '재고이력')
      
      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
      const base64Data = Buffer.from(excelBuffer).toString('base64')
      
      return NextResponse.json({
        success: true,
        data: {
          fileData: base64Data,
          fileName: `재고이력_${new Date().toISOString().split('T')[0]}.xlsx`,
          totalCount: 0
        },
        message: '조회된 재고 이력이 없습니다.'
      })
    }

    const orderIds = orders.map(order => order.id)

    // 주문 아이템을 기반으로 재고 이력 조회
    let query = supabase
      .from('order_items')
      .select(`
        id,
        product_id,
        quantity,
        shipped_quantity,
        color,
        size,
        order_id,
        products!inner(
          name,
          code
        )
      `)
      .in('order_id', orderIds)

    // 상품 필터
    if (productId) {
      query = query.eq('product_id', productId)
    }

    const { data: historyData, error } = await query

    if (error) {
      console.error('History fetch error:', error)
      return NextResponse.json({ 
        success: false, 
        error: '재고 이력을 조회할 수 없습니다.' 
      }, { status: 500 })
    }

    // 사용자 정보 조회
    const userIds = [...new Set(orders.map(order => order.user_id))]
    const { data: users } = await supabase
      .from('users')
      .select('id, company_name')
      .in('id', userIds)

    // 주문 정보 매핑
    const orderMap = new Map(orders.map(order => [order.id, order]))
    const userMap = new Map((users || []).map(user => [user.id, user]))

    // 엑셀 데이터 생성
    const excelData = (historyData || []).map((history, index) => {
      const product = Array.isArray(history.products) ? history.products[0] : history.products
      const order = orderMap.get(history.order_id)
      const user = order ? userMap.get(order.user_id) : null
      
      const shippedQuantity = history.shipped_quantity || 0
      const changeType = shippedQuantity > 0 ? '출고' : '주문'
      const quantityChange = shippedQuantity > 0 ? -shippedQuantity : 0

      return {
        '번호': index + 1,
        '상품코드': product?.code || '',
        '상품명': product?.name || '',
        '색상': history.color || '-',
        '사이즈': history.size || '-',
        '변경유형': changeType,
        '주문수량': history.quantity,
        '출고수량': shippedQuantity,
        '변경수량': quantityChange === 0 ? '-' : quantityChange.toString(),
        '주문번호': order?.order_number || '',
        '고객사': user?.company_name || '',
        '주문상태': order?.status || '',
        '변경일시': order?.created_at ? new Date(order.created_at).toLocaleString('ko-KR') : ''
      }
    })

    // 워크북 생성
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // 열 너비 설정
    const colWidths = [
      { wch: 6 },   // 번호
      { wch: 15 },  // 상품코드
      { wch: 25 },  // 상품명
      { wch: 10 },  // 색상
      { wch: 10 },  // 사이즈
      { wch: 10 },  // 변경유형
      { wch: 10 },  // 주문수량
      { wch: 10 },  // 출고수량
      { wch: 10 },  // 변경수량
      { wch: 15 },  // 주문번호
      { wch: 20 },  // 고객사
      { wch: 10 },  // 주문상태
      { wch: 18 },  // 변경일시
    ]
    ws['!cols'] = colWidths

    // 시트 추가
    XLSX.utils.book_append_sheet(wb, ws, '재고이력')

    // 엑셀 파일 생성
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const base64Data = Buffer.from(excelBuffer).toString('base64')

    // 파일명 생성
    const currentDate = new Date().toISOString().split('T')[0]
    const fileName = `재고이력_${currentDate}.xlsx`

    return NextResponse.json({
      success: true,
      data: {
        fileData: base64Data,
        fileName: fileName,
        totalCount: excelData.length
      },
      message: `${excelData.length}개의 재고 이력이 준비되었습니다.`
    })

  } catch (error) {
    console.error('History export error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '재고 이력 다운로드 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 