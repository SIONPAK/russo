import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { generateUnshippedStatement, UnshippedStatementData } from '@/shared/lib/shipping-statement-utils'

// 미출고 명세서 다운로드 API
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    // 미출고 명세서 조회 (외래키 관계를 명시적으로 지정하지 않음)
    const { data: statement, error } = await supabase
      .from('unshipped_statements')
      .select(`
        *,
        users (
          company_name,
          phone,
          address,
          customer_grade
        ),
        orders (
          order_number
        ),
        unshipped_statement_items (
          product_name,
          color,
          size,
          ordered_quantity,
          shipped_quantity,
          unshipped_quantity,
          unit_price,
          total_amount
        )
      `)
      .eq('id', id)
      .single()

    if (error || !statement) {
      console.error('미출고 명세서 조회 실패:', error)
      console.error('요청된 ID:', id)
      return NextResponse.json({ error: '명세서를 찾을 수 없습니다.' }, { status: 404 })
    }

    console.log('미출고 명세서 조회 성공:', statement)

    // 미출고 명세서 데이터 준비 (모든 수량과 금액을 0으로 처리)
    const statementData: UnshippedStatementData = {
      statementNumber: statement.statement_number,
      companyName: statement.users.company_name,
      email: '',
      phone: statement.users.phone || '',
      address: statement.users.address || '',
      postalCode: '',
      customerGrade: statement.users.customer_grade || 'BRONZE',
      unshippedDate: statement.created_at,
      unshippedReason: statement.reason || '재고 부족',
      items: statement.unshipped_statement_items.map((item: any) => ({
        productName: item.product_name,
        color: item.color || '기본',
        size: item.size || '',
        quantity: 0,        // 수량 0으로 처리
        unitPrice: 0,       // 단가 0으로 처리
        totalPrice: 0       // 총액 0으로 처리
      })),
      totalAmount: 0  // 총 금액 0으로 처리
    }

    // 미출고 명세서 엑셀 생성
    const excelBuffer = await generateUnshippedStatement(statementData)
    
    // 파일명 생성
    const fileName = `unshipped_statement_${statement.statement_number}.xlsx`
    
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=${fileName}`
      }
    })
    
  } catch (error) {
    console.error('미출고 명세서 다운로드 중 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
} 