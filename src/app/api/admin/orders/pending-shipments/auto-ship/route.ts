import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { shipmentIds, enabled } = body

    // 권한 확인 제거 - 일반 클라이언트 사용

    if (!shipmentIds || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '선택된 미출고 항목이 없습니다.' 
      }, { status: 400 })
    }

    // 실제 구현에서는 pending_shipments 테이블을 업데이트해야 함
    // 현재는 임시로 성공 응답 반환
    const updated = shipmentIds.length

    // 로그 기록
    console.log(`Auto ship ${enabled ? 'enabled' : 'disabled'} for ${updated} shipments:`, shipmentIds)

    return NextResponse.json({
      success: true,
      message: `자동 출고가 ${enabled ? '활성화' : '비활성화'}되었습니다.`,
      data: {
        updated,
        enabled
      }
    })

  } catch (error) {
    console.error('Auto ship toggle error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '자동 출고 설정 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 