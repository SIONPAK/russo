import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { generateReceipt } from '@/shared/lib/receipt-utils'

// GET - 문서 다운로드
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 현재 사용자 확인
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: '로그인이 필요합니다.'
      }, { status: 401 })
    }

    // ID 파싱 (order_123, return_456, deduction_789 형태)
    const [type, actualId] = id.split('_')
    
    let receiptData: any = null
    let fileName = ''

    if (type === 'order') {
      // 거래명세서 (주문 기반)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          users!orders_user_id_fkey (
            company_name,
            representative_name,
            email,
            phone,
            address,
            business_number
          ),
          order_items (
            id,
            product_name,
            color,
            size,
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('id', actualId)
        .eq('user_id', user.id)
        .single()

      if (orderError || !order) {
        return NextResponse.json({
          success: false,
          error: '주문을 찾을 수 없습니다.'
        }, { status: 404 })
      }

      receiptData = {
        orderNumber: order.order_number,
        orderDate: new Date(order.created_at).toLocaleDateString('ko-KR'),
        customerName: order.users.company_name,
        customerPhone: order.users.phone,
        customerEmail: order.users.email,
        shippingName: order.shipping_name,
        shippingPhone: order.shipping_phone,
        shippingAddress: order.shipping_address,
        shippingPostalCode: order.shipping_postal_code,
        items: order.order_items.map((item: any) => ({
          productName: item.product_name,
          productCode: '',
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
          color: item.color,
          size: item.size
        })),
        subtotal: order.total_amount,
        shippingFee: order.shipping_fee || 0,
        totalAmount: order.total_amount + (order.shipping_fee || 0),
        notes: ''
      }
      fileName = `거래명세서_${order.order_number}.xlsx`

    } else if (type === 'return') {
      // 반품명세서
      const { data: returnStatement, error: returnError } = await supabase
        .from('return_statements')
        .select(`
          *,
          orders!return_statements_order_id_fkey (
            order_number,
            users!orders_user_id_fkey (
              company_name,
              representative_name,
              email,
              phone,
              address,
              business_number
            )
          )
        `)
        .eq('id', actualId)
        .single()

      if (returnError || !returnStatement) {
        return NextResponse.json({
          success: false,
          error: '반품명세서를 찾을 수 없습니다.'
        }, { status: 404 })
      }

      // 사용자 권한 확인
      const order = Array.isArray(returnStatement.orders) ? returnStatement.orders[0] : returnStatement.orders
      const orderUser = Array.isArray(order?.users) ? order.users[0] : order?.users
      
      if (!orderUser || orderUser.id !== user.id) {
        return NextResponse.json({
          success: false,
          error: '접근 권한이 없습니다.'
        }, { status: 403 })
      }

      receiptData = {
        orderNumber: returnStatement.statement_number,
        orderDate: new Date(returnStatement.created_at).toLocaleDateString('ko-KR'),
        customerName: orderUser.company_name,
        customerPhone: orderUser.phone,
        customerEmail: orderUser.email,
        shippingName: orderUser.representative_name,
        shippingPhone: orderUser.phone,
        shippingAddress: orderUser.address || '',
        shippingPostalCode: '',
        items: (returnStatement.items || []).map((item: any) => ({
          productName: item.product_name,
          productCode: '',
          quantity: item.return_quantity || item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
          color: item.color,
          size: item.size
        })),
        subtotal: returnStatement.total_amount,
        shippingFee: 0,
        totalAmount: returnStatement.total_amount,
        notes: `반품 사유: ${returnStatement.return_reason}`
      }
      fileName = `반품명세서_${returnStatement.statement_number}.xlsx`

    } else if (type === 'deduction') {
      // 차감명세서
      const { data: deductionStatement, error: deductionError } = await supabase
        .from('deduction_statements')
        .select(`
          *,
          orders!deduction_statements_order_id_fkey (
            order_number,
            users!orders_user_id_fkey (
              company_name,
              representative_name,
              email,
              phone,
              address,
              business_number
            )
          )
        `)
        .eq('id', actualId)
        .single()

      if (deductionError || !deductionStatement) {
        return NextResponse.json({
          success: false,
          error: '차감명세서를 찾을 수 없습니다.'
        }, { status: 404 })
      }

      // 사용자 권한 확인
      const order = Array.isArray(deductionStatement.orders) ? deductionStatement.orders[0] : deductionStatement.orders
      const orderUser = Array.isArray(order?.users) ? order.users[0] : order?.users
      
      if (!orderUser || orderUser.id !== user.id) {
        return NextResponse.json({
          success: false,
          error: '접근 권한이 없습니다.'
        }, { status: 403 })
      }

      receiptData = {
        orderNumber: deductionStatement.statement_number,
        orderDate: new Date(deductionStatement.created_at).toLocaleDateString('ko-KR'),
        customerName: orderUser.company_name,
        customerPhone: orderUser.phone,
        customerEmail: orderUser.email,
        shippingName: orderUser.representative_name,
        shippingPhone: orderUser.phone,
        shippingAddress: orderUser.address || '',
        shippingPostalCode: '',
        items: (deductionStatement.items || []).map((item: any) => ({
          productName: item.product_name,
          productCode: '',
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_price,
          color: item.color,
          size: item.size
        })),
        subtotal: deductionStatement.total_amount,
        shippingFee: 0,
        totalAmount: deductionStatement.total_amount,
        notes: `차감 사유: ${deductionStatement.deduction_reason}`
      }
      fileName = `차감명세서_${deductionStatement.statement_number}.xlsx`

    } else {
      return NextResponse.json({
        success: false,
        error: '잘못된 문서 타입입니다.'
      }, { status: 400 })
    }

    // 엑셀 파일 생성 및 다운로드
    const success = await generateReceipt(receiptData)
    
    if (!success) {
      return NextResponse.json({
        success: false,
        error: '명세서 다운로드에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '명세서가 다운로드되었습니다.',
      fileName
    })

  } catch (error) {
    console.error('명세서 다운로드 오류:', error)
    return NextResponse.json({
      success: false,
      error: '명세서 다운로드 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 