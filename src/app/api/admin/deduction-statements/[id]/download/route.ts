import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { generateDeductionStatement, DeductionStatementData } from '@/shared/lib/shipping-statement-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // 차감명세서 조회
    const { data: statement, error } = await supabase
      .from('deduction_statements')
      .select(`
        *,
        orders!deduction_statements_order_id_fkey (
          order_number
        )
      `)
      .eq('id', id)
      .single()

    if (error || !statement) {
      return NextResponse.json({
        success: false,
        error: '차감명세서를 찾을 수 없습니다.'
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

    // 차감 명세서 데이터 구성
    const statementData: DeductionStatementData = {
      statementNumber: statement.statement_number,
      companyName: userData.company_name,
      businessLicenseNumber: userData.business_number,
      email: userData.email,
      phone: userData.phone,
      address: userData.address,
      postalCode: '',
      customerGrade: userData.customer_grade || 'BRONZE',
      deductionDate: statement.created_at,
      deductionReason: statement.deduction_reason,
      deductionType: statement.deduction_type,
      items: (statement.items || []).map((item: any) => ({
        productName: item.product_name,
        color: item.color || '-',
        size: item.size || '-',
        quantity: item.deduction_quantity || item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.unit_price * (item.deduction_quantity || item.quantity)
      })),
      totalAmount: statement.total_amount
    }

    // 엑셀 파일 생성
    const excelBuffer = await generateDeductionStatement(statementData)

    // 파일명 생성 (한글 파일명 인코딩 문제 해결)
    const fileName = encodeURIComponent(`차감명세서_${statement.statement_number}.xlsx`)

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Deduction statement download error:', error)
    return NextResponse.json({
      success: false,
      error: '차감명세서 다운로드 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

function getDeductionTypeText(type: string) {
  const types = {
    'return': '반품',
    'defect': '불량',
    'shortage': '부족',
    'damage': '파손',
    'other': '기타'
  }
  return types[type as keyof typeof types] || type
}

function getStatusText(status: string) {
  const statuses = {
    'pending': '대기중',
    'completed': '완료',
    'cancelled': '취소됨'
  }
  return statuses[status as keyof typeof statuses] || status
} 