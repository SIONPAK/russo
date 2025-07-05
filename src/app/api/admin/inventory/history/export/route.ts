import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const productId = searchParams.get('productId') || ''

    // 권한 확인 제거 - 일반 클라이언트 사용

    // 재고 이력 조회
    let query = supabase
      .from('inventory_history')
      .select(`
        id,
        product_id,
        color,
        size,
        change_type,
        quantity_before,
        quantity_after,
        quantity_change,
        reason,
        created_at,
        products!inner(
          name,
          code
        )
      `)
      .order('created_at', { ascending: false })

    // 날짜 필터
    if (startDate) {
      query = query.gte('created_at', `${startDate}T00:00:00`)
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`)
    }

    // 상품 필터
    if (productId) {
      query = query.eq('product_id', productId)
    }

    const { data: historyData, error } = await query.limit(10000) // 최대 1만건

    if (error) {
      console.error('History fetch error:', error)
      return NextResponse.json({ 
        success: false, 
        error: '재고 이력을 조회할 수 없습니다.' 
      }, { status: 500 })
    }

    // 엑셀 데이터 생성
    const excelData = historyData.map((history, index) => {
      const changeTypeMap: { [key: string]: string } = {
        'inbound': '입고',
        'outbound': '출고',
        'adjustment': '조정',
        'audit': '실사',
        'return': '반품',
        'damage': '손상',
        'transfer': '이동'
      }
      const changeTypeText = changeTypeMap[history.change_type] || history.change_type

      return {
        '번호': index + 1,
        '상품코드': (history.products as any).code,
        '상품명': (history.products as any).name,
        '색상': history.color,
        '사이즈': history.size,
        '변경유형': changeTypeText,
        '변경전수량': history.quantity_before,
        '변경후수량': history.quantity_after,
        '변경수량': history.quantity_change > 0 ? `+${history.quantity_change}` : history.quantity_change.toString(),
        '사유': history.reason || '',
        '변경일시': new Date(history.created_at).toLocaleString('ko-KR')
      }
    })

    // 워크북 생성
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)

    // 열 너비 설정
    const colWidths = [
      { wch: 6 },   // 번호
      { wch: 15 },  // 상품코드
      { wch: 25 },  // 상품명
      { wch: 10 },  // 색상
      { wch: 10 },  // 사이즈
      { wch: 10 },  // 변경유형
      { wch: 10 },  // 변경전수량
      { wch: 10 },  // 변경후수량
      { wch: 10 },  // 변경수량
      { wch: 20 },  // 사유
      { wch: 18 },  // 변경일시
    ]
    ws['!cols'] = colWidths

    // 시트 추가
    XLSX.utils.book_append_sheet(wb, ws, '재고이력')

    // 엑셀 파일 생성
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const base64Data = Buffer.from(excelBuffer).toString('base64')

    // 파일명 생성
    const currentDate = new Date().toISOString().split('T')[0]
    const fileName = `재고이력_${currentDate}.xlsx`

    return NextResponse.json({
      success: true,
      data: {
        fileData: base64Data,
        fileName: fileName,
        totalCount: excelData.length
      },
      message: `${excelData.length}개의 재고 이력이 준비되었습니다.`
    })

  } catch (error) {
    console.error('History export error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '재고 이력 다운로드 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 