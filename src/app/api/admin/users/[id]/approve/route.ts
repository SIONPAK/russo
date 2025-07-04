import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

// POST - 사용자 승인/반려
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { action, reason } = body // action: 'approve' | 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 액션입니다.' },
        { status: 400 }
      )
    }

    const approval_status = action === 'approve' ? 'approved' : 'rejected'

    const { data: user, error } = await supabase
      .from('users')
      .update({
        approval_status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('User approval error:', error)
      return NextResponse.json(
        { success: false, error: '사용자 승인 처리에 실패했습니다.' },
        { status: 500 }
      )
    }

    const message = action === 'approve' 
      ? '사용자가 승인되었습니다.' 
      : '사용자가 반려되었습니다.'

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