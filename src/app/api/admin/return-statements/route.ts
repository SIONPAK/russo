import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime, getKoreaDate } from '@/shared/lib/utils'

// 반품명세서 조회 API
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const yearMonth = searchParams.get('yearMonth') || getKoreaDate().slice(0, 7)
    const companyName = searchParams.get('companyName')
    const returnType = searchParams.get('returnType')
    const status = searchParams.get('status')

    // 월단위 조회를 위한 시작일/종료일 계산
    const [year, month] = yearMonth.split('-').map(Number)
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

    let query = supabase
      .from('return_statements')
      .select(`
        *,
        orders!left (
          order_number,
          users!left (
            company_name,
            customer_grade
          )
        )
      `)
      .order('created_at', { ascending: false })

    // 날짜 필터 (DB에 이미 한국 시간으로 저장되어 있음)
    if (startDate) {
      const startDateObj = new Date(startDate)
      const startTimeStr = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')} 00:00:00`
      query = query.gte('created_at', startTimeStr)
    }
    if (endDate) {
      const endDateObj = new Date(endDate)
      const endTimeStr = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')} 23:59:59`
      query = query.lte('created_at', endTimeStr)
    }

    // 회사명 필터 (반품명세서 직접 저장된 회사명과 주문 연결된 회사명 모두 검색)
    if (companyName) {
      query = query.or(`company_name.ilike.%${companyName}%,orders.users.company_name.ilike.%${companyName}%`)
    }

    // 반품 유형 필터
    if (returnType && returnType !== 'all') {
      query = query.eq('return_type', returnType)
    }

    // 상태 필터
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Return statements fetch error:', error)
      return NextResponse.json({
        success: false,
        error: '반품명세서 조회 중 오류가 발생했습니다.'
      }, { status: 500 })
    }

    // 데이터 변환
    const statements = data?.map(statement => ({
      id: statement.id,
      statement_number: statement.statement_number,
      order_id: statement.order_id,
      order_number: statement.orders?.order_number || '',
      company_name: statement.company_name || statement.orders?.users?.company_name || statement.orders?.shipping_address || '',
      customer_grade: statement.orders?.users?.customer_grade || 'BRONZE',
      return_reason: statement.return_reason,
      return_type: statement.return_type,
      created_at: statement.created_at,
      processed_at: statement.processed_at,
      refunded: statement.refunded,
      refund_amount: statement.refund_amount,
      refund_method: statement.refund_method,
      status: statement.status,
      items: statement.items || [],
      total_amount: statement.total_amount,
      email_sent: statement.email_sent,
      email_sent_at: statement.email_sent_at
    })) || []

    return NextResponse.json({
      success: true,
      data: statements
    })

  } catch (error) {
    console.error('Return statements API error:', error)
    return NextResponse.json({
      success: false,
      error: '반품명세서 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 반품명세서 생성 API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const {
      company_name,
      return_reason,
      return_type,
      items,
      refund_method = 'mileage'
    } = body

    // 필수 정보 검증
    if (!company_name || !return_reason || !items || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 })
    }

    // 아이템 검증 및 total_price 계산 (부가세 포함)
    const validItems = items.map((item: any) => {
      if (!item.product_name || !item.return_quantity || !item.unit_price) {
        throw new Error('상품 정보가 올바르지 않습니다.')
      }
      
      const supplyAmount = item.return_quantity * item.unit_price
      const vat = Math.floor(supplyAmount * 0.1)
      const total_price = supplyAmount + vat
      
      return {
        ...item,
        total_price
      }
    })

    // 총 금액 계산 (부가세 포함)
    const total_amount = validItems.reduce((sum: number, item: any) => sum + item.total_price, 0)
    const refund_amount = total_amount

    // 한국 시간 생성
    const koreaTime = new Date(Date.now() + (9 * 60 * 60 * 1000))

    // 반품명세서 번호 생성
    const statementNumber = `RO-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // 관리자가 직접 생성하는 경우를 위한 임시 주문 생성
    const tempOrderNumber = `RO${Date.now()}`
    const { data: tempOrder, error: tempOrderError } = await supabase
      .from('orders')
      .insert({
        user_id: null, // 관리자 생성이므로 null
        order_number: tempOrderNumber,
        total_amount: 0,
        shipping_fee: 0,
        status: 'pending',
        order_type: 'return_only',
        shipping_name: company_name, // 업체명을 이름 필드에 저장
        shipping_phone: '',
        shipping_address: company_name, // 업체명을 주소 필드에도 저장
        shipping_postal_code: '',
        created_at: koreaTime.toISOString()
      })
      .select()
      .single()

    if (tempOrderError) {
      console.error('Temp order creation error:', tempOrderError)
      return NextResponse.json({
        success: false,
        error: '임시 주문 생성에 실패했습니다.'
      }, { status: 500 })
    }

    // 반품명세서 생성
    const { data: statement, error: statementError } = await supabase
      .from('return_statements')
      .insert({
        statement_number: statementNumber,
        order_id: tempOrder.id, // 임시 주문 ID 연결
        return_reason,
        return_type,
        items: validItems,
        total_amount,
        refund_amount,
        refund_method,
        status: 'pending',
        refunded: false,
        email_sent: false,
        company_name, // 반품명세서에 직접 회사명 저장
        created_at: koreaTime.toISOString()
      })
      .select()
      .single()

    if (statementError) {
      console.error('Return statement creation error:', statementError)
      return NextResponse.json({
        success: false,
        error: '반품명세서 생성 중 오류가 발생했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: statement
    })

  } catch (error) {
    console.error('Return statement creation API error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '반품명세서 생성 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 반품명세서 일괄 처리 API
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { statementIds } = body

    if (!statementIds || statementIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '처리할 반품명세서를 선택해주세요.'
      }, { status: 400 })
    }

    // 반품명세서 승인 처리
    const { data, error } = await supabase
      .from('return_statements')
      .update({
        status: 'approved',
        processed_at: getKoreaTime()
      })
      .in('id', statementIds)
      .select('id, order_id')

    if (error) {
      console.error('Return statement processing error:', error)
      return NextResponse.json({
        success: false,
        error: '반품명세서 처리 중 오류가 발생했습니다.'
      }, { status: 500 })
    }

    // 관련 주문들 상태 업데이트 (선택사항)
    if (data && data.length > 0) {
      const orderIds = data.map(stmt => stmt.order_id).filter(Boolean)
      if (orderIds.length > 0) {
        await supabase
          .from('orders')
          .update({
            updated_at: getKoreaTime()
          })
          .in('id', orderIds)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: data?.length || 0
      }
    })

  } catch (error) {
    console.error('Return statement processing API error:', error)
    return NextResponse.json({
      success: false,
      error: '반품명세서 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 