import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    console.log('Debug API called with:', body)
    
    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    console.log('Auth result:', { user: user ? { id: user.id, email: user.email } : null, authError })
    
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: '인증이 필요합니다.',
        debug: { authError: authError?.message }
      }, { status: 401 })
    }

    // 관리자 권한 확인
    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select('*')
      .eq('email', user.email)
      .single()
    
    console.log('Admin check result:', { admin, adminError })

    if (adminError || !admin) {
      return NextResponse.json({
        success: false,
        error: '관리자 권한이 필요합니다.',
        debug: { adminError: adminError?.message }
      }, { status: 403 })
    }

    // 샘플 존재 확인
    const { sampleId } = body
    const { data: existingSample, error: sampleError } = await supabase
      .from('samples')
      .select('*')
      .eq('id', sampleId)
      .single()
    
    console.log('Sample check result:', { existingSample, sampleError })

    if (sampleError || !existingSample) {
      return NextResponse.json({
        success: false,
        error: '샘플을 찾을 수 없습니다.',
        debug: { sampleError: sampleError?.message }
      }, { status: 404 })
    }

    // 실제 업데이트 시도
    const { status } = body
    const { data: updateResult, error: updateError } = await supabase
      .from('samples')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', sampleId)
      .select()
    
    console.log('Update result:', { updateResult, updateError })

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: '업데이트 실패',
        debug: { updateError: updateError.message }
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '디버깅 완료',
      data: {
        user: { id: user.id, email: user.email },
        admin,
        existingSample,
        updateResult
      }
    })

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류',
      debug: { error: error.message }
    }, { status: 500 })
  }
} 