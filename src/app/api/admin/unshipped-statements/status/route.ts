import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { statementIds, status } = await request.json()
    
    if (!statementIds || !Array.isArray(statementIds) || statementIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '명세서 ID가 필요합니다.'
      }, { status: 400 })
    }

    if (!status || !['pending', 'notified', 'resolved', 'cancelled'].includes(status)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 상태값입니다.'
      }, { status: 400 })
    }

    // 상태 업데이트
    const { data, error } = await supabase
      .from('unshipped_statements')
      .update({
        status: status,
        updated_at: getKoreaTime()
      })
      .in('id', statementIds)
      .select('id, statement_number, status')

    if (error) {
      console.error('상태 업데이트 오류:', error)
      return NextResponse.json({
        success: false,
        error: '상태 업데이트 중 오류가 발생했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: data?.length || 0,
        updatedStatements: data || []
      }
    })

  } catch (error) {
    console.error('미출고 명세서 상태 업데이트 오류:', error)
    return NextResponse.json({
      success: false,
      error: '상태 업데이트 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 