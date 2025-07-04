import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx'

// 출고 명세서 생성 API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { orderIds, format = 'excel' } = body

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
          business_number
        ),
        order_items!order_items_order_id_fkey (
          id,
          product_name,
          product_code,
          quantity,
          unit_price,
          total_price,
          color,
          size,
          products!order_items_product_id_fkey (
            id,
            name,
            code,
            category
          )
        )
      `)
      .in('id', orderIds)
      .eq('status', 'confirmed') // 주문 확정된 것만

    if (orderError || !orders || orders.length === 0) {
      return NextResponse.json({
        success: false,
        error: '출고 가능한 주문이 없습니다.'
      }, { status: 404 })
    }

    // 출고 명세서 생성
    const statements = []
    
    for (const order of orders) {
      try {
        // 재고 확인 및 할당
        const stockAllocation = await checkAndAllocateStock(supabase, order)
        
        if (!stockAllocation.success) {
          statements.push({
            orderId: order.id,
            orderNumber: order.order_number,
            status: 'failed',
            error: stockAllocation.error
          })
          continue
        }

        // 출고 명세서 데이터 생성
        const statementData = {
          // 기본 정보
          statementNumber: `OUT-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${order.order_number}`,
          orderNumber: order.order_number,
          issueDate: new Date().toISOString().split('T')[0],
          
          // 고객 정보
          customer: {
            companyName: order.users.company_name,
            representativeName: order.users.representative_name,
            businessNumber: order.users.business_number,
            phone: order.users.phone,
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
          
          // 상품 정보
          items: stockAllocation.allocatedItems,
          
          // 금액 정보
          amounts: {
            subtotal: order.total_amount - order.shipping_fee,
            shippingFee: order.shipping_fee,
            total: order.total_amount
          }
        }

        // 출고 명세서 파일 생성
        let fileUrl = ''
        if (format === 'excel') {
          fileUrl = await generateShippingStatementExcel(statementData)
        } else {
          fileUrl = await generateShippingStatementPDF(statementData)
        }

        // 출고 명세서 정보 데이터베이스에 저장
        const { data: statement, error: statementError } = await supabase
          .from('shipping_statements')
          .insert({
            statement_number: statementData.statementNumber,
            order_id: order.id,
            order_number: order.order_number,
            customer_name: order.users.company_name,
            issue_date: statementData.issueDate,
            file_url: fileUrl,
            format: format,
            status: 'issued',
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (statementError) {
          console.error('Statement save error:', statementError)
        }

        // 주문 상태를 출고 준비로 변경
        await supabase
          .from('orders')
          .update({
            status: 'preparing',
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id)

        statements.push({
          orderId: order.id,
          orderNumber: order.order_number,
          statementNumber: statementData.statementNumber,
          fileUrl: fileUrl,
          status: 'success'
        })

      } catch (error) {
        console.error(`출고 명세서 생성 실패 (주문 ${order.order_number}):`, error)
        statements.push({
          orderId: order.id,
          orderNumber: order.order_number,
          status: 'failed',
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        statements: statements,
        summary: {
          total: orders.length,
          success: statements.filter(s => s.status === 'success').length,
          failed: statements.filter(s => s.status === 'failed').length
        }
      },
      message: `${statements.filter(s => s.status === 'success').length}개의 출고 명세서가 생성되었습니다.`
    })

  } catch (error) {
    console.error('Shipping statement API error:', error)
    return NextResponse.json({
      success: false,
      error: '출고 명세서 생성 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 재고 확인 및 할당
async function checkAndAllocateStock(supabase: any, order: any) {
  const allocatedItems = []
  
  for (const item of order.order_items) {
    // 재고 조회
    const { data: inventory, error: inventoryError } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', item.product_id)
      .eq('color', item.color)
      .eq('size', item.size)
      .single()

    if (inventoryError || !inventory) {
      return {
        success: false,
        error: `상품 재고를 찾을 수 없습니다: ${item.product_name} (${item.color}/${item.size})`
      }
    }

    if (inventory.quantity < item.quantity) {
      return {
        success: false,
        error: `재고 부족: ${item.product_name} (${item.color}/${item.size}) - 요청: ${item.quantity}, 재고: ${inventory.quantity}`
      }
    }

    // 재고 차감
    const { error: updateError } = await supabase
      .from('inventory')
      .update({
        quantity: inventory.quantity - item.quantity,
        updated_at: new Date().toISOString()
      })
      .eq('id', inventory.id)

    if (updateError) {
      return {
        success: false,
        error: `재고 업데이트 실패: ${item.product_name}`
      }
    }

    allocatedItems.push({
      ...item,
      allocatedQuantity: item.quantity,
      remainingStock: inventory.quantity - item.quantity
    })
  }

  return {
    success: true,
    allocatedItems
  }
}

// 엑셀 출고 명세서 생성
async function generateShippingStatementExcel(statementData: any): Promise<string> {
  const wb = XLSX.utils.book_new()
  
  // 출고 명세서 시트 생성
  const wsData = [
    ['출고 명세서'],
    [''],
    ['명세서 번호:', statementData.statementNumber],
    ['발행일:', statementData.issueDate],
    ['주문번호:', statementData.orderNumber],
    [''],
    ['고객 정보'],
    ['업체명:', statementData.customer.companyName],
    ['대표자명:', statementData.customer.representativeName],
    ['사업자번호:', statementData.customer.businessNumber],
    ['연락처:', statementData.customer.phone],
    ['주소:', statementData.customer.address],
    [''],
    ['배송 정보'],
    ['받는사람:', statementData.shipping.recipientName],
    ['연락처:', statementData.shipping.phone],
    ['배송주소:', statementData.shipping.address],
    ['우편번호:', statementData.shipping.postalCode],
    ['배송메모:', statementData.shipping.notes],
    [''],
    ['상품 정보'],
    ['번호', '상품명', '상품코드', '색상', '사이즈', '수량', '단가', '금액', '재고'],
  ]

  // 상품 목록 추가
  statementData.items.forEach((item: any, index: number) => {
    wsData.push([
      index + 1,
      item.product_name,
      item.product_code || '',
      item.color,
      item.size,
      item.quantity,
      item.unit_price,
      item.total_price,
      item.remainingStock
    ])
  })

  // 합계 정보 추가
  wsData.push(
    [''],
    ['', '', '', '', '', '', '상품금액:', statementData.amounts.subtotal],
    ['', '', '', '', '', '', '배송비:', statementData.amounts.shippingFee],
    ['', '', '', '', '', '', '총금액:', statementData.amounts.total]
  )

  const ws = XLSX.utils.aoa_to_sheet(wsData)
  
  // 열 너비 설정
  ws['!cols'] = [
    { wch: 6 },  // 번호
    { wch: 30 }, // 상품명
    { wch: 15 }, // 상품코드
    { wch: 10 }, // 색상
    { wch: 10 }, // 사이즈
    { wch: 8 },  // 수량
    { wch: 12 }, // 단가
    { wch: 12 }, // 금액
    { wch: 8 },  // 재고
  ]

  XLSX.utils.book_append_sheet(wb, ws, '출고명세서')
  
  // 파일 저장 (실제로는 클라우드 스토리지에 저장)
  const fileName = `shipping-statement-${statementData.statementNumber}.xlsx`
  // const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  // 실제 파일 업로드 로직 구현 필요
  
  return `/documents/shipping-statements/${fileName}`
}

// PDF 출고 명세서 생성 (추후 구현)
async function generateShippingStatementPDF(statementData: any): Promise<string> {
  // PDF 생성 로직 구현 필요
  const fileName = `shipping-statement-${statementData.statementNumber}.pdf`
  return `/documents/shipping-statements/${fileName}`
}

// GET - 출고 명세서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const customerName = searchParams.get('customerName')
    
    let query = supabase
      .from('shipping_statements')
      .select(`
        *,
        orders!shipping_statements_order_id_fkey (
          order_number,
          total_amount,
          users!orders_user_id_fkey (
            company_name
          )
        )
      `)

    // 필터 적용
    if (startDate && endDate) {
      query = query.gte('issue_date', startDate).lte('issue_date', endDate)
    }
    
    if (customerName) {
      query = query.ilike('customer_name', `%${customerName}%`)
    }

    // 페이지네이션
    const offset = (page - 1) * limit
    query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false })

    const { data: statements, error } = await query

    if (error) {
      throw error
    }

    // 전체 개수 조회
    let countQuery = supabase
      .from('shipping_statements')
      .select('*', { count: 'exact', head: true })

    if (startDate && endDate) {
      countQuery = countQuery.gte('issue_date', startDate).lte('issue_date', endDate)
    }
    
    if (customerName) {
      countQuery = countQuery.ilike('customer_name', `%${customerName}%`)
    }

    const { count } = await countQuery

    return NextResponse.json({
      success: true,
      data: {
        statements: statements || [],
        pagination: {
          currentPage: page,
          totalPages: Math.ceil((count || 0) / limit),
          totalItems: count || 0,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil((count || 0) / limit),
          hasPrevPage: page > 1
        }
      }
    })

  } catch (error) {
    console.error('Shipping statements list error:', error)
    return NextResponse.json({
      success: false,
      error: '출고 명세서 목록 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 