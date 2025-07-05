import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx'
import { getCurrentKoreanDateTime } from '@/shared/lib/utils'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const grade = searchParams.get('grade') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''

    // 권한 확인 제거 - 일반 클라이언트 사용

    // 사용자 목록 조회
    let query = supabase
      .from('users')
      .select(`
        id,
        user_id,
        email,
        company_name,
        representative_name,
        phone,
        business_number,
        business_type,
        business_category,
        address,
        detailed_address,
        postal_code,
        customer_grade,
        approval_status,
        is_active,
        created_at,
        approved_at,
        rejected_at,
        last_login_at
      `)
      .eq('role', 'customer')
      .order('created_at', { ascending: false })

    // 검색 조건 적용
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,representative_name.ilike.%${search}%,email.ilike.%${search}%,business_number.ilike.%${search}%`)
    }

    // 상태 필터
    if (status) {
      query = query.eq('approval_status', status)
    }

    // 등급 필터
    if (grade) {
      query = query.eq('customer_grade', grade)
    }

    // 날짜 필터
    if (dateFrom) {
      query = query.gte('created_at', `${dateFrom}T00:00:00`)
    }
    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59`)
    }

    const { data: users, error } = await query

    if (error) {
      console.error('Users fetch error:', error)
      return NextResponse.json({ 
        success: false, 
        error: '사용자 목록을 조회할 수 없습니다.' 
      }, { status: 500 })
    }

    // 엑셀 데이터 생성
    const excelData = users.map((user, index) => ({
      '번호': index + 1,
      '아이디': user.user_id,
      '이메일': user.email,
      '업체명': user.company_name,
      '대표자명': user.representative_name,
      '연락처': user.phone,
      '사업자번호': user.business_number,
      '업태': user.business_type,
      '종목': user.business_category,
      '주소': `${user.address || ''} ${user.detailed_address || ''}`.trim(),
      '우편번호': user.postal_code,
      '고객등급': user.customer_grade === 'premium' ? '우수업체' : user.customer_grade === 'vip' ? 'VIP' : '일반',
      '승인상태': user.approval_status === 'approved' ? '승인완료' : 
                  user.approval_status === 'rejected' ? '반려' : '승인대기',
      '계정상태': user.is_active ? '활성' : '비활성',
      '가입일': user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '',
      '승인일': user.approved_at ? new Date(user.approved_at).toLocaleDateString('ko-KR') : '',
      '반려일': user.rejected_at ? new Date(user.rejected_at).toLocaleDateString('ko-KR') : '',
      '최종로그인': user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('ko-KR') : ''
    }))

    // 워크북 생성
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // 열 너비 설정
    const colWidths = [
      { wch: 6 },   // 번호
      { wch: 15 },  // 아이디
      { wch: 25 },  // 이메일
      { wch: 20 },  // 업체명
      { wch: 12 },  // 대표자명
      { wch: 15 },  // 연락처
      { wch: 15 },  // 사업자번호
      { wch: 12 },  // 업태
      { wch: 12 },  // 종목
      { wch: 30 },  // 주소
      { wch: 10 },  // 우편번호
      { wch: 10 },  // 고객등급
      { wch: 10 },  // 승인상태
      { wch: 10 },  // 계정상태
      { wch: 12 },  // 가입일
      { wch: 12 },  // 승인일
      { wch: 12 },  // 반려일
      { wch: 12 },  // 최종로그인
    ]
    ws['!cols'] = colWidths

    // 시트 추가
    XLSX.utils.book_append_sheet(wb, ws, '회원목록')

    // 엑셀 파일 생성
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const base64Data = Buffer.from(excelBuffer).toString('base64')

    // 파일명 생성
    const currentDate = new Date().toISOString().split('T')[0]
    const fileName = `회원목록_${currentDate}.xlsx`

    return NextResponse.json({
      success: true,
      data: {
        fileData: base64Data,
        fileName: fileName,
        totalCount: users.length
      },
      message: `${users.length}명의 회원 데이터가 준비되었습니다.`
    })

  } catch (error) {
    console.error('Excel export error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '엑셀 다운로드 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 