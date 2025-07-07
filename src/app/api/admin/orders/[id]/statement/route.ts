import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { generateShippingStatement } from '@/shared/lib/shipping-statement-utils'

// 거래명세서 조회 API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 주문 정보 조회
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
          business_number,
          customer_grade
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

    // 실제 출고된 아이템만 필터링
    const shippedItems = order.order_items.filter((item: any) => 
      item.shipped_quantity && item.shipped_quantity > 0
    )
    
    if (shippedItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: '아직 출고된 상품이 없습니다.'
      }, { status: 400 })
    }

    // 출고 명세서 데이터 구성
    const statementData = {
      orderNumber: order.order_number,
      companyName: order.users.company_name,
      businessLicenseNumber: order.users.business_number,
      email: order.users.email,
      phone: order.users.phone,
      address: order.users.address,
      postalCode: order.users.postal_code || '',
      customerGrade: order.users.customer_grade || 'normal',
      shippedAt: order.shipped_at || new Date().toISOString(),
      items: shippedItems.map((item: any) => ({
        productName: item.product_name,
        color: item.color,
        size: item.size,
        quantity: item.shipped_quantity,
        unitPrice: item.unit_price,
        totalPrice: item.shipped_quantity * item.unit_price
      })),
      totalAmount: shippedItems.reduce((sum: number, item: any) => 
        sum + (item.shipped_quantity * item.unit_price), 0
      )
    }

    // 엑셀 파일 생성
    const excelBuffer = await generateShippingStatement(statementData)

    // 엑셀 파일을 직접 반환
    const fileName = `shipping_statement_${order.order_number}_${new Date().toISOString().split('T')[0]}.xlsx`
    
    return new Response(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error: any) {
    console.error('Transaction statement API error:', error)
    return NextResponse.json({
      success: false,
      error: '거래명세서 생성 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 