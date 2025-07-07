import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { generateReceipt } from '@/shared/lib/excel-utils'
import { 
  generateReturnStatement, 
  generateDeductionStatement, 
  ReturnStatementData, 
  DeductionStatementData 
} from '@/shared/lib/shipping-statement-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 명세서 조회
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
          business_number,
          customer_grade
        ),
        orders!statements_order_id_fkey (
          order_number
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
      .single()

    if (statementError || !statement) {
      return NextResponse.json({
        success: false,
        error: '명세서를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 명세서 타입에 따른 처리
    if (statement.statement_type === 'return') {
      // 반품 명세서
      const statementData: ReturnStatementData = {
        statementNumber: statement.statement_number,
        companyName: statement.users.company_name,
        businessLicenseNumber: statement.users.business_number,
        email: statement.users.email,
        phone: statement.users.phone,
        address: statement.users.address || '',
        postalCode: '',
        customerGrade: statement.users.customer_grade || 'BRONZE',
        returnDate: statement.created_at,
        returnReason: statement.reason || '반품 처리',
        items: statement.statement_items.map((item: any) => ({
          productName: item.product_name,
          color: item.color || '-',
          size: item.size || '-',
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_amount
        })),
        totalAmount: statement.total_amount
      }

      const excelBuffer = await generateReturnStatement(statementData)
      const fileName = `반품명세서_${statement.statement_number}.xlsx`

      return new NextResponse(excelBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-cache'
        }
      })

    } else if (statement.statement_type === 'deduction') {
      // 차감 명세서
      const statementData: DeductionStatementData = {
        statementNumber: statement.statement_number,
        companyName: statement.users.company_name,
        businessLicenseNumber: statement.users.business_number,
        email: statement.users.email,
        phone: statement.users.phone,
        address: statement.users.address || '',
        postalCode: '',
        customerGrade: statement.users.customer_grade || 'BRONZE',
        deductionDate: statement.created_at,
        deductionReason: statement.reason || '차감 처리',
        deductionType: statement.statement_type,
        items: statement.statement_items.map((item: any) => ({
          productName: item.product_name,
          color: item.color || '-',
          size: item.size || '-',
          quantity: item.quantity,
          unitPrice: item.unit_price,
          totalPrice: item.total_amount
        })),
        totalAmount: statement.total_amount
      }

      const excelBuffer = await generateDeductionStatement(statementData)
      const fileName = `차감명세서_${statement.statement_number}.xlsx`

      return new NextResponse(excelBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-cache'
        }
      })

    } else {
      // 기존 출고 명세서 (generateReceipt 사용)
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
          error: '명세서 다운로드에 실패했습니다.'
        }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: '명세서가 다운로드되었습니다.'
      })
    }

  } catch (error) {
    console.error('명세서 다운로드 오류:', error)
    return NextResponse.json({
      success: false,
      error: '명세서 다운로드 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 