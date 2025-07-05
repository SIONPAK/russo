import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { getCurrentKoreanDateTime } from '@/shared/lib/utils'

// POST - 사용자 휴면 상태 토글
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // 현재 사용자 상태 조회
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('is_active, is_dormant, dormant_at')
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const newDormantStatus = !currentUser.is_dormant
    
    // 사용자 휴면 상태 토글
    const currentTime = getCurrentKoreanDateTime()
    const { data: user, error } = await supabase
      .from('users')
      .update({
        is_dormant: newDormantStatus,
        dormant_at: newDormantStatus ? currentTime : null,
        is_active: newDormantStatus ? false : true, // 휴면 상태면 비활성화, 휴면 해제면 활성화
        updated_at: currentTime
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('User dormant toggle error:', error)
      return NextResponse.json(
        { success: false, error: '휴면 상태 변경에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 상태 변경 이력 로깅
    const { error: logError } = await supabase
      .from('user_status_logs')
      .insert({
        user_id: id,
        previous_status: currentUser.is_dormant ? 'dormant' : 'active',
        new_status: newDormantStatus ? 'dormant' : 'active',
        action_type: 'dormant',
        reason: newDormantStatus ? '관리자에 의한 휴면 처리' : '관리자에 의한 휴면 해제',
        changed_by: null // TODO: 관리자 ID 설정
      })

    if (logError) {
      console.error('Status log error:', logError)
    }

    return NextResponse.json({
      success: true,
      data: user,
      message: newDormantStatus ? '사용자가 휴면 처리되었습니다.' : '사용자 휴면이 해제되었습니다.'
    })

  } catch (error) {
    console.error('User dormant API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 