import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { generateShippingStatement } from '@/shared/lib/shipping-statement-utils'
import { getKoreaDate } from '@/shared/lib/utils'

// 거래명세서 조회 API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('🔍 개별 명세서 조회 시작:', { orderId: id, timestamp: new Date().toISOString() })
    
    const supabase = await createClient()

    // 모든 주문 조회해서 디버깅
    const { data: allOrders, error: allOrdersError } = await supabase
      .from('orders')
      .select('id, order_number, status')
      .limit(10)

    console.log('🔍 전체 주문 샘플 (최근 10개):', {
      count: allOrders?.length || 0,
      orders: allOrders?.map(o => ({ id: o.id, order_number: o.order_number, status: o.status })) || [],
      error: allOrdersError?.message || null
    })

    // 특정 주문 조회
    const { data: orderExists, error: existsError } = await supabase
      .from('orders')
      .select('id, order_number, status')
      .eq('id', id)
      .single()

    console.log('🔍 주문 존재 여부 확인:', { 
      orderId: id,
      exists: !!orderExists,
      error: existsError?.message || null,
      errorCode: existsError?.code || null,
      orderBasicInfo: orderExists ? { 
        id: orderExists.id, 
        order_number: orderExists.order_number,
        status: orderExists.status
      } : null
    })

    if (existsError || !orderExists) {
      console.error('❌ 주문이 존재하지 않음:', { orderId: id, error: existsError })
      return NextResponse.json({ 
        error: '주문을 찾을 수 없습니다.',
        details: `주문 ID: ${id}가 데이터베이스에 존재하지 않습니다.`,
        errorCode: existsError?.code || 'NOT_FOUND',
        errorMessage: existsError?.message || 'No matching record found'
      }, { status: 404 })
    }

    // 주문 정보 조회 (상세 정보 포함)
    console.log('🔍 주문 상세 정보 조회 중...')
    
    let order: any = null
    
    try {
      const { data: orderData, error: orderError } = await supabase
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
            *,
            products!order_items_product_id_fkey (
              id,
              code,
              name,
              price
            )
          )
        `)
        .eq('id', id)
        .single()

      order = orderData

      console.log('🔍 주문 상세 정보 조회 결과:', {
        orderId: id,
        success: !!order,
        error: orderError?.message || null,
        errorCode: orderError?.code || null,
        orderInfo: order ? {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          user_id: order.user_id,
          items_count: order.order_items?.length || 0,
          has_user_info: !!order.users
        } : null
      })

      if (orderError || !order) {
        console.error('❌ 주문 상세 정보 조회 실패:', { orderId: id, error: orderError })
        return NextResponse.json({ 
          error: '주문 상세 정보를 가져올 수 없습니다.',
          details: orderError?.message || 'Failed to fetch order details',
          errorCode: orderError?.code || 'FETCH_ERROR'
        }, { status: 500 })
      }

      // 개별 다운로드 시에도 주문 상태를 "작업중"으로 변경
      console.log('🔄 개별 명세서 다운로드 - 주문 상태 업데이트 시작:', { orderId: id, status: 'confirmed' })
      const { data: updateData, error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
      
      if (updateError) {
        console.error('❌ 주문 상태 업데이트 실패:', updateError)
      } else {
        console.log('✅ 주문 상태 업데이트 성공:', updateData)
      }

    } catch (error) {
      console.error('❌ 주문 상세 정보 조회 중 예외 발생:', error)
      return NextResponse.json({ 
        error: '주문 정보 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

    // 모든 상품 포함 (미출고 상품도 품명과 규격 표시)
    const allItems = order.order_items

    // 🔧 총 출고 수량 계산 (배송비 계산용)
    const totalShippedQuantity = allItems.reduce((sum: number, item: any) => {
      const actualQuantity = item.shipped_quantity || 0
      return sum + actualQuantity
    }, 0)

    // 🔧 공급가액 계산 (출고된 상품 기준)
    const supplyAmount = allItems.reduce((sum: number, item: any) => {
      const actualQuantity = item.shipped_quantity || 0
      return sum + (actualQuantity * item.unit_price)
    }, 0)

    // 🔧 부가세액 계산 (공급가액의 10%, 소수점 절사)
    const taxAmount = Math.floor(supplyAmount * 0.1)

    // 🔧 배송비 계산 (20장 미만일 때 3,000원)
    const shippingFee = totalShippedQuantity < 20 ? 3000 : 0

    // 🔧 총 금액 계산 (공급가액 + 부가세액 + 배송비)
    const totalAmount = supplyAmount + taxAmount + shippingFee

    console.log('🔍 개별 영수증 다운로드 - 금액 계산:', {
      totalShippedQuantity,
      supplyAmount,
      taxAmount,
      shippingFee,
      totalAmount
    })

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
      shippedAt: order.shipped_at || new Date(Date.now() + (9 * 60 * 60 * 1000)).toISOString(),
      items: allItems.map((item: any) => {
        const actualQuantity = item.shipped_quantity || 0
        const isUnshipped = actualQuantity === 0
        const itemTotalPrice = isUnshipped ? 0 : actualQuantity * item.unit_price
        const itemSupplyAmount = itemTotalPrice
        const itemTaxAmount = Math.floor(itemSupplyAmount * 0.1)
        
        console.log('🔍 아이템 수량 확인:', {
          productName: item.product_name,
          shipped_quantity: item.shipped_quantity,
          quantity: item.quantity,
          actualQuantity,
          isUnshipped,
          itemSupplyAmount,
          itemTaxAmount
        })
        
        return {
          productName: item.product_name,
          color: item.color || '기본',
          size: item.size || '',
          quantity: isUnshipped ? 0 : actualQuantity,
          unitPrice: isUnshipped ? 0 : item.unit_price,
          totalPrice: itemTotalPrice,
          supplyAmount: itemSupplyAmount,
          taxAmount: itemTaxAmount
        }
      }),
      // 🔧 수정: 배송비 포함된 총 금액 전달
      totalAmount: totalAmount,
      supplyAmount: supplyAmount,
      taxAmount: taxAmount,
      shippingFee: shippingFee
    }

    // 생성될 엑셀 데이터 상세 로깅
    console.log('🔍 generateShippingStatement에 전달되는 데이터:', {
      orderNumber: statementData.orderNumber,
      companyName: statementData.companyName,
      itemsCount: statementData.items.length,
      itemsDetail: statementData.items.map((item: any) => ({
        productName: item.productName,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice
      }))
    })

    // 엑셀 파일 생성
    const excelBuffer = await generateShippingStatement(statementData)

    // 엑셀 파일을 직접 반환
            const koreaDate = getKoreaDate()
    const fileName = `shipping_statement_${order.order_number}_${koreaDate}.xlsx`
    
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