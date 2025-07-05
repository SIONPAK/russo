import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { getCurrentKoreanDateTime } from '@/shared/lib/utils'

// POST - 사용자 비활성화
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { reason } = await request.json()

    // 현재 사용자 상태 조회
    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('is_active, approval_status')
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 사용자 비활성화
    const currentTime = getCurrentKoreanDateTime()
    const { data: user, error } = await supabase
      .from('users')
      .update({
        is_active: false,
        updated_at: currentTime
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('User deactivation error:', error)
      return NextResponse.json(
        { success: false, error: '사용자 비활성화에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 상태 변경 이력 로깅
    const { error: logError } = await supabase
      .from('user_status_logs')
      .insert({
        user_id: id,
        previous_status: currentUser.is_active ? 'active' : 'inactive',
        new_status: 'inactive',
        action_type: 'deactivate',
        reason: reason || '관리자에 의한 비활성화',
        changed_by: null // TODO: 관리자 ID 설정
      })

    if (logError) {
      console.error('Status log error:', logError)
    }

    return NextResponse.json({
      success: true,
      data: user,
      message: '사용자가 비활성화되었습니다.'
    })

  } catch (error) {
    console.error('User deactivation API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 