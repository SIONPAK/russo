import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { getCurrentKoreanDateTime } from '@/shared/lib/utils'

// POST - 사용자 승인/반려
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { action, reason, notes } = await request.json()

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: '올바른 액션을 지정해주세요.' },
        { status: 400 }
      )
    }

    // 현재 사용자 상태 조회
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('approval_status')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('User fetch error:', fetchError)
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const approval_status = action === 'approve' ? 'approved' : 'rejected'
    const is_active = action === 'approve'

    const currentTime = getCurrentKoreanDateTime()
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update({
        approval_status,
        is_active,
        rejected_reason: action === 'reject' ? reason : null,
        approved_at: action === 'approve' ? currentTime : null,
        rejected_at: action === 'reject' ? currentTime : null,
        approval_notes: notes || null,
        approved_by: action === 'approve' ? null : null,
        updated_at: currentTime
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('User approval error:', error)
      return NextResponse.json(
        { success: false, error: '사용자 승인/반려 처리에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 상태 변경 이력 로깅
    const { error: logError } = await supabase
      .from('user_status_logs')
      .insert({
        user_id: id,
        previous_status: currentUser.approval_status,
        new_status: approval_status,
        action_type: action,
        reason: action === 'reject' ? reason : notes,
        changed_by: 'system'
      })

    if (logError) {
      console.error('Status log error:', logError)
      // 이력 기록 실패는 전체 작업을 실패시키지 않음
    }

    const message = action === 'approve' ? 
      '사용자가 성공적으로 승인되었습니다.' : 
      '사용자가 반려되었습니다.'

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message
    })

  } catch (error) {
    console.error('User approval API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 