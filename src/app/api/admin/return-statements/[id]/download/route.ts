import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { generateReturnStatement, ReturnStatementData } from '@/shared/lib/shipping-statement-utils'

// 반품명세서 다운로드 API
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 반품명세서 정보 조회
    const { data: statement, error: statementError } = await supabase
      .from('return_statements')
      .select(`
        *,
        orders!return_statements_order_id_fkey (
          order_number
        )
      `)
      .eq('id', id)
      .single()

    if (statementError || !statement) {
      return NextResponse.json({
        success: false,
        error: '반품명세서를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // company_name으로 사용자 정보 조회
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        company_name,
        representative_name,
        email,
        phone,
        address,
        business_number,
        customer_grade
      `)
      .eq('company_name', statement.company_name)
      .single()

    if (userError || !userData) {
      console.error('User data fetch error:', userError)
      return NextResponse.json({
        success: false,
        error: '회사 정보를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 반품 명세서 데이터 구성
    const statementData: ReturnStatementData = {
      statementNumber: statement.statement_number,
      companyName: userData.company_name,
      businessLicenseNumber: userData.business_number,
      email: userData.email,
      phone: userData.phone,
      address: userData.address,
      postalCode: '',
      customerGrade: userData.customer_grade || 'BRONZE',
      returnDate: statement.created_at,
      returnReason: statement.return_reason,
      items: (statement.items || []).map((item: any) => ({
        productName: item.product_name,
        color: item.color || '-',
        size: item.size || '-',
        quantity: item.return_quantity || item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.unit_price * (item.return_quantity || item.quantity)
      })),
      totalAmount: statement.refund_amount || statement.total_amount
    }

    // 엑셀 파일 생성
    const excelBuffer = await generateReturnStatement(statementData)
    
    // 파일명 생성 (한글 파일명 인코딩 문제 해결)
    const fileName = encodeURIComponent(`반품명세서_${statement.statement_number}.xlsx`)

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Return statement download API error:', error)
    return NextResponse.json({
      success: false,
      error: '반품명세서 다운로드 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 