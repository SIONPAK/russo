import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx-js-style'

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
          order_number,
          users!orders_user_id_fkey (
            company_name,
            representative_name,
            phone,
            email,
            business_number,
            address
          )
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

    // 새 워크북 생성
    const workbook = XLSX.utils.book_new()
    
    // 워크시트 데이터 생성
    const worksheetData = [
      ['차감명세서'],
      [''],
      ['명세서 번호:', statement.statement_number],
      ['주문번호:', statement.orders.order_number],
      ['회사명:', statement.orders.users.company_name],
      ['대표자명:', statement.orders.users.representative_name],
      ['연락처:', statement.orders.users.phone],
      ['이메일:', statement.orders.users.email],
      ['사업자번호:', statement.orders.users.business_number],
      ['주소:', statement.orders.users.address],
      [''],
      ['차감 유형:', getDeductionTypeText(statement.deduction_type)],
      ['차감 사유:', statement.deduction_reason],
      ['생성일:', new Date(statement.created_at).toLocaleDateString('ko-KR')],
      [''],
      ['상품 목록'],
      ['품목명', '색상', '사이즈', '차감수량', '단가', '금액'],
      ...(statement.items || []).map((item: any) => [
        item.product_name || '-',
        item.color || '-',
        item.size || '-',
        item.deduction_quantity || 0,
        (item.unit_price || 0).toLocaleString(),
        ((item.unit_price || 0) * (item.deduction_quantity || 0)).toLocaleString()
      ]),
      [''],
      ['총 차감 금액:', `${(statement.total_amount || 0).toLocaleString()}원`],
      [''],
      ['마일리지 차감:', statement.mileage_deducted ? '완료' : '미완료'],
      ['차감 마일리지:', `${(statement.mileage_amount || 0).toLocaleString()}P`],
      [''],
      ['처리 상태:', getStatusText(statement.status)],
      ['처리일:', statement.processed_at ? new Date(statement.processed_at).toLocaleDateString('ko-KR') : '미처리']
    ]

    // 워크시트 생성
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

    // 스타일 적용
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    
    // 제목 스타일
    worksheet['A1'] = {
      ...worksheet['A1'],
      s: {
        font: { bold: true, sz: 16 },
        alignment: { horizontal: 'center' }
      }
    }

    // 헤더 스타일 (상품 목록)
    for (let col = 0; col < 6; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: 16, c: col })
      if (worksheet[cellRef]) {
        worksheet[cellRef].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'E5E7EB' } },
          alignment: { horizontal: 'center' }
        }
      }
    }

    // 열 너비 설정
    worksheet['!cols'] = [
      { width: 20 }, // 품목명
      { width: 15 }, // 색상
      { width: 10 }, // 사이즈
      { width: 10 }, // 차감수량
      { width: 12 }, // 단가
      { width: 15 }  // 금액
    ]

    // 워크시트를 워크북에 추가
    XLSX.utils.book_append_sheet(workbook, worksheet, '차감명세서')

    // 엑셀 파일 생성
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' })

    // 파일명 생성
    const fileName = `deduction_statement_${statement.statement_number}.xlsx`

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
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