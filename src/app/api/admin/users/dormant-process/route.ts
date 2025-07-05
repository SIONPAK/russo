import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'
import { getCurrentKoreanDateTime } from '@/shared/lib/utils'

// POST - 휴면 계정 일괄 처리
export async function POST(request: NextRequest) {
  try {
    // 1년 전 날짜 계산
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

    // 1년 이상 로그인하지 않은 활성 사용자 조회
    const { data: dormantUsers, error: fetchError } = await supabase
      .from('users')
      .select('id, email, company_name, last_login_at')
      .eq('is_active', true)
      .eq('is_dormant', false)
      .or(`last_login_at.is.null,last_login_at.lt.${oneYearAgo.toISOString()}`)

    if (fetchError) {
      console.error('Dormant users fetch error:', fetchError)
      return NextResponse.json(
        { success: false, error: '휴면 대상 사용자 조회에 실패했습니다.' },
        { status: 500 }
      )
    }

    if (!dormantUsers || dormantUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: '휴면 처리할 사용자가 없습니다.',
        count: 0
      })
    }

    const userIds = dormantUsers.map(user => user.id)
    const currentTime = getCurrentKoreanDateTime()

    // 사용자들을 휴면 상태로 업데이트
    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_dormant: true,
        dormant_at: currentTime,
        is_active: false,
        updated_at: currentTime
      })
      .in('id', userIds)

    if (updateError) {
      console.error('Dormant users update error:', updateError)
      return NextResponse.json(
        { success: false, error: '휴면 처리에 실패했습니다.' },
        { status: 500 }
      )
    }

    // 상태 변경 이력 로깅
    const statusLogs = dormantUsers.map(user => ({
      user_id: user.id,
      previous_status: 'active',
      new_status: 'dormant',
      action_type: 'dormant',
      reason: '1년 이상 미사용으로 인한 자동 휴면 처리',
      changed_by: null
    }))

    const { error: logError } = await supabase
      .from('user_status_logs')
      .insert(statusLogs)

    if (logError) {
      console.error('Status logs error:', logError)
    }

    return NextResponse.json({
      success: true,
      message: `${dormantUsers.length}개의 계정이 휴면 처리되었습니다.`,
      count: dormantUsers.length,
      processedUsers: dormantUsers.map(user => ({
        id: user.id,
        email: user.email,
        company_name: user.company_name,
        last_login_at: user.last_login_at
      }))
    })

  } catch (error) {
    console.error('Dormant process API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 