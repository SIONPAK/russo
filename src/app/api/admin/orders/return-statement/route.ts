import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx'
import { getCurrentKoreanDateTime, getKoreaDate, getKoreaDateFormatted } from '@/shared/lib/utils'

// 반품 명세서 생성 API
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { 
      orderNumber, 
      customerId,
      items, // [{ productId, productName, quantity, reason, unitPrice }]
      returnReason, 
      returnType = 'exchange', // 'exchange' | 'refund' | 'defect'
      mileageCompensation = 0,
      notes 
    } = body

    if (!orderNumber || !customerId || !items || items.length === 0) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 })
    }

    // 원주문 조회
    const { data: originalOrder, error: orderError } = await supabase
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
        )
      `)
      .eq('order_number', orderNumber)
      .single()

    if (orderError || !originalOrder) {
      return NextResponse.json({
        success: false,
        error: '원주문을 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 반품 명세서 번호 생성
    const returnNumber = `RO-${getKoreaDateFormatted()}-${Date.now().toString().slice(-6)}`
    
    // 반품 총액 계산
    const totalReturnAmount = items.reduce((sum: number, item: any) => 
      sum + (item.unitPrice * item.quantity), 0
    )

    // 반품 명세서 데이터 생성
    const returnStatementData = {
      returnNumber,
      orderNumber,
      issueDate: getKoreaDate(),
      returnType,
      returnReason,
      
      // 고객 정보
      customer: {
        id: originalOrder.users.id,
        companyName: originalOrder.users.company_name,
        representativeName: originalOrder.users.representative_name,
        businessNumber: originalOrder.users.business_number,
        phone: originalOrder.users.phone,
        address: originalOrder.users.address
      },
      
      // 반품 상품 정보
      returnItems: items.map((item: any) => ({
        ...item,
        totalPrice: item.unitPrice * item.quantity
      })),
      
      // 금액 정보
      amounts: {
        totalReturnAmount,
        mileageCompensation,
        finalAmount: totalReturnAmount + mileageCompensation
      },
      
      notes
    }

    // 반품 명세서 파일 생성
    const fileUrl = await generateReturnStatementExcel(returnStatementData)

    // 마일리지 보상이 있는 경우 자동 적립
    if (mileageCompensation > 0) {
      await processReturnMileageCompensation(supabase, {
        customerId,
        customerName: originalOrder.users.company_name,
        amount: mileageCompensation,
        returnNumber,
        orderNumber
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        returnNumber,
        fileUrl,
        totalReturnAmount,
        mileageCompensation
      },
      message: '반품 명세서가 성공적으로 생성되었습니다.'
    })

  } catch (error) {
    console.error('Return statement API error:', error)
    return NextResponse.json({
      success: false,
      error: '반품 명세서 생성 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 반품 마일리지 보상 처리
async function processReturnMileageCompensation(supabase: any, compensationData: any) {
  try {
    // 현재 마일리지 조회
    const { data: currentMileage } = await supabase
      .from('lusso_milege_info')
      .select('milege, milege_gb, milege_fnal')
      .eq('business_name', compensationData.customerName)
      .order('milege_idx', { ascending: false })
      .limit(1)
      .single()

    let currentTotal = 0
    if (currentMileage) {
      if (currentMileage.milege_fnal) {
        currentTotal = parseInt(currentMileage.milege_fnal) || 0
      } else {
        // 전체 마일리지 계산
        const { data: allMileage } = await supabase
          .from('lusso_milege_info')
          .select('milege, milege_gb')
          .eq('business_name', compensationData.customerName)

        if (allMileage) {
          currentTotal = allMileage.reduce((sum: number, record: any) => {
            const amount = parseInt(record.milege) || 0
            return record.milege_gb === 1 ? sum + amount : sum - amount
          }, 0)
        }
      }
    }

    const newTotal = currentTotal + compensationData.amount

    // 다음 milege_idx 계산
    const { data: lastRecord } = await supabase
      .from('lusso_milege_info')
      .select('milege_idx')
      .order('milege_idx', { ascending: false })
      .limit(1)
      .single()

    let nextIdx = 1
    if (lastRecord && lastRecord.milege_idx) {
      nextIdx = parseInt(lastRecord.milege_idx) + 1
    }

    // 마일리지 적립
    const now = new Date()
    const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
    const currentTime = koreanTime.toISOString()
    const receiveDate = koreanTime.toISOString().split('T')[0]

    const { error } = await supabase
      .from('lusso_milege_info')
      .insert({
        milege_idx: nextIdx,
        business_name: compensationData.customerName,
        milege: compensationData.amount.toString(),
        milege_gb: 1, // 적립
        milege_fnal: newTotal,
        milege_description: `반품보상: ${compensationData.returnNumber} (주문: ${compensationData.orderNumber})`,
        milege_c_gb: 'RETURN',
        receiver_date: receiveDate,
        created_at: currentTime,
        updated_at: currentTime,
        writer: 'SYSTEM_AUTO'
      })

    if (error) {
      console.error('Return mileage compensation error:', error)
    } else {
      console.log(`✅ 반품 마일리지 보상 완료: ${compensationData.customerName} (+${compensationData.amount})`)
    }

  } catch (error) {
    console.error('Return mileage compensation error:', error)
  }
}

// 반품 명세서 Excel 파일 생성
async function generateReturnStatementExcel(returnData: any): Promise<string> {
  try {
    const wb = XLSX.utils.book_new()
    
    // 헤더 정보
    const headerData = [
      ['반품 명세서'],
      [''],
      ['반품번호', returnData.returnNumber],
      ['원주문번호', returnData.orderNumber],
      ['발행일', returnData.issueDate],
      ['반품유형', getReturnTypeText(returnData.returnType)],
      ['반품사유', returnData.returnReason],
      [''],
      ['고객정보'],
      ['회사명', returnData.customer.companyName],
      ['대표자명', returnData.customer.representativeName],
      ['사업자번호', returnData.customer.businessNumber],
      ['연락처', returnData.customer.phone],
      ['주소', returnData.customer.address],
      [''],
      ['반품상품 목록'],
      ['상품명', '수량', '단가', '금액', '반품사유']
    ]

    // 상품 데이터 추가
    returnData.returnItems.forEach((item: any) => {
      headerData.push([
        item.productName,
        item.quantity,
        item.unitPrice.toLocaleString(),
        item.totalPrice.toLocaleString(),
        item.reason
      ])
    })

    // 합계 정보
    headerData.push([''])
    headerData.push(['반품 총액', returnData.amounts.totalReturnAmount.toLocaleString()])
    headerData.push(['마일리지 보상', returnData.amounts.mileageCompensation.toLocaleString()])
    headerData.push(['최종 금액', returnData.amounts.finalAmount.toLocaleString()])
    
    if (returnData.notes) {
      headerData.push([''])
      headerData.push(['비고', returnData.notes])
    }

    const ws = XLSX.utils.aoa_to_sheet(headerData)
    XLSX.utils.book_append_sheet(wb, ws, '반품명세서')

    // 파일 저장 (실제로는 스토리지에 저장해야 함)
    const fileName = `return-statement-${returnData.returnNumber}.xlsx`
    const fileUrl = `/files/return-statements/${fileName}`
    
    return fileUrl

  } catch (error) {
    console.error('Return statement Excel generation error:', error)
    throw error
  }
}

function getReturnTypeText(type: string): string {
  switch (type) {
    case 'exchange': return '교환'
    case 'refund': return '환불'
    case 'defect': return '불량'
    default: return type
  }
}

// 반품 명세서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'all'
    const type = searchParams.get('type') || 'all'
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    const supabase = await createClient()
    
    // 기본 쿼리
    let query = supabase
      .from('return_statements')
      .select(`
        *,
        orders!return_statements_order_id_fkey (
          order_number,
          users!orders_user_id_fkey (
            company_name
          )
        )
      `)

    // 검색 조건
    if (search) {
      query = query.or(`return_number.ilike.%${search}%,order_number.ilike.%${search}%,customer_name.ilike.%${search}%`)
    }

    // 상태 필터
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    // 유형 필터
    if (type !== 'all') {
      query = query.eq('return_type', type)
    }

    // 날짜 필터
    if (startDate) {
      query = query.gte('created_at', startDate + 'T00:00:00.000Z')
    }
    if (endDate) {
      query = query.lte('created_at', endDate + 'T23:59:59.999Z')
    }

    // 총 개수 조회
    const { count } = await query

    // 페이지네이션 적용
    const offset = (page - 1) * limit
    const { data: statements, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Return statements list error:', error)
      return NextResponse.json({
        success: false,
        error: '반품 명세서 목록을 조회할 수 없습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        statements,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil((count || 0) / limit),
          totalItems: count || 0,
          itemsPerPage: limit
        }
      }
    })

  } catch (error) {
    console.error('Return statements API error:', error)
    return NextResponse.json({
      success: false,
      error: '반품 명세서 조회 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// 반품 상태 업데이트
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    
    const { returnNumber, status, processNotes } = body

    if (!returnNumber || !status) {
      return NextResponse.json({
        success: false,
        error: '반품번호와 상태가 필요합니다.'
      }, { status: 400 })
    }

    // 반품 명세서 업데이트
    const updateData: any = {
      status,
      updated_at: getCurrentKoreanDateTime()
    }

    if (status === 'completed' || status === 'rejected') {
      updateData.processed_at = getCurrentKoreanDateTime()
    }

    if (processNotes) {
      updateData.process_notes = processNotes
    }

    const { data: statement, error } = await supabase
      .from('return_statements')
      .update(updateData)
      .eq('return_number', returnNumber)
      .select()
      .single()

    if (error) {
      console.error('Return statement update error:', error)
      return NextResponse.json({
        success: false,
        error: '반품 상태 업데이트에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: statement,
      message: '반품 상태가 업데이트되었습니다.'
    })

  } catch (error) {
    console.error('Return statement update error:', error)
    return NextResponse.json({
      success: false,
      error: '반품 상태 업데이트 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 