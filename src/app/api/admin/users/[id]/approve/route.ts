import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

// POST - 사용자 승인/반려
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { action, reason } = await request.json()

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: '올바른 액션을 지정해주세요.' },
        { status: 400 }
      )
    }

    const approval_status = action === 'approve' ? 'approved' : 'rejected'
    const is_active = action === 'approve'

    const { data: user, error } = await supabase
      .from('users')
      .update({
        approval_status,
        is_active,
        rejection_reason: action === 'reject' ? reason : null,
        approved_at: action === 'approve' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
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

    const message = action === 'approve' ? 
      '사용자가 성공적으로 승인되었습니다.' : 
      '사용자가 반려되었습니다.'

    return NextResponse.json({
      success: true,
      data: user,
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