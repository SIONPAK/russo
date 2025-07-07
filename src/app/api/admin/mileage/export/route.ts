import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'
import * as XLSX from 'xlsx'
import { getKoreaDate } from '@/shared/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    const { 
      search = '', 
      status = '', 
      type = '', 
      source = '', 
      dateFrom = '', 
      dateTo = '' 
    } = body

    // 마일리지 데이터 조회
    let query = supabase
      .from('mileage')
      .select(`
        *,
        users!mileage_user_id_fkey (
          id,
          company_name,
          representative_name,
          business_number,
          email,
          phone
        )
      `)

    // 필터 적용
    if (search) {
      query = query.or(`description.ilike.%${search}%,users.company_name.ilike.%${search}%`)
    }
    
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    
    if (type && type !== 'all') {
      query = query.eq('type', type)
    }
    
    if (source && source !== 'all') {
      query = query.eq('source', source)
    }
    
    if (dateFrom) {
      query = query.gte('created_at', dateFrom)
    }
    
    if (dateTo) {
      query = query.lte('created_at', dateTo + 'T23:59:59')
    }

    // 정렬
    query = query.order('created_at', { ascending: false })

    const { data: mileages, error } = await query

    if (error) {
      console.error('Mileage export error:', error)
      return NextResponse.json({
        success: false,
        error: '마일리지 데이터를 불러오는데 실패했습니다.'
      }, { status: 500 })
    }

    // 엑셀 데이터 변환
    const excelData = mileages?.map((mileage, index) => ({
      '번호': index + 1,
      '날짜': new Date(mileage.created_at).toLocaleDateString('ko-KR'),
      '업체명': mileage.users?.company_name || '알 수 없음',
      '대표자명': mileage.users?.representative_name || '',
      '사업자번호': mileage.users?.business_number || '',
      '이메일': mileage.users?.email || '',
      '연락처': mileage.users?.phone || '',
      '유형': mileage.type === 'earn' ? '적립' : '차감',
      '금액': mileage.amount,
      '소스': getSourceText(mileage.source),
      '설명': mileage.description,
      '상태': getStatusText(mileage.status),
      '주문ID': mileage.order_id || '',
      '처리자': mileage.processed_by || '',
      '생성일시': new Date(mileage.created_at).toLocaleString('ko-KR'),
      '수정일시': new Date(mileage.updated_at).toLocaleString('ko-KR')
    })) || []

    // 엑셀 워크북 생성
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)
    
    // 컬럼 너비 설정
    const colWidths = [
      { wch: 8 },   // 번호
      { wch: 12 },  // 날짜
      { wch: 20 },  // 업체명
      { wch: 10 },  // 대표자명
      { wch: 15 },  // 사업자번호
      { wch: 20 },  // 이메일
      { wch: 15 },  // 연락처
      { wch: 8 },   // 유형
      { wch: 12 },  // 금액
      { wch: 8 },   // 소스
      { wch: 30 },  // 설명
      { wch: 8 },   // 상태
      { wch: 15 },  // 주문ID
      { wch: 10 },  // 처리자
      { wch: 20 },  // 생성일시
      { wch: 20 }   // 수정일시
    ]
    ws['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, '마일리지 내역')

    // 엑셀 파일 생성
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="mileage_${getKoreaDate()}.xlsx"`
      }
    })

  } catch (error) {
    console.error('Mileage export API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

function getSourceText(source: string) {
  switch (source) {
    case 'manual': return '수동'
    case 'auto': return '자동'
    case 'order': return '주문'
    case 'refund': return '환불'
    default: return '기타'
  }
}

function getStatusText(status: string) {
  switch (status) {
    case 'completed': return '완료'
    case 'cancelled': return '취소'
    case 'pending': return '대기'
    default: return '알 수 없음'
  }
} 