import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { generateReceipt } from '@/shared/lib/receipt-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 차감명세서 조회
    const { data: statement, error: statementError } = await supabase
      .from('statements')
      .select(`
        *,
        users!statements_user_id_fkey (
          company_name,
          representative_name,
          email,
          phone,
          address,
          business_number
        ),
        statement_items (
          id,
          product_name,
          color,
          size,
          quantity,
          unit_price,
          total_amount
        )
      `)
      .eq('id', id)
      .eq('statement_type', 'deduction')
      .single()

    if (statementError || !statement) {
      return NextResponse.json({
        success: false,
        error: '차감명세서를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 기존 generateReceipt 함수 사용
    const receiptData = {
      orderNumber: statement.statement_number,
      orderDate: new Date(statement.created_at).toLocaleDateString('ko-KR'),
      customerName: statement.users.company_name,
      customerPhone: statement.users.phone,
      customerEmail: statement.users.email,
      shippingName: statement.users.representative_name,
      shippingPhone: statement.users.phone,
      shippingAddress: statement.users.address || '',
      shippingPostalCode: '',
      items: statement.statement_items.map((item: any) => ({
        productName: item.product_name,
        productCode: '',
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.total_amount,
        color: item.color,
        size: item.size
      })),
      subtotal: statement.total_amount,
      shippingFee: 0,
      totalAmount: statement.total_amount,
      notes: statement.notes || ''
    }

    const success = await generateReceipt(receiptData)
    
    if (!success) {
      return NextResponse.json({
        success: false,
        error: '차감명세서 다운로드에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '차감명세서가 다운로드되었습니다.'
    })

  } catch (error) {
    console.error('차감명세서 다운로드 오류:', error)
    return NextResponse.json({
      success: false,
      error: '차감명세서 다운로드 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 