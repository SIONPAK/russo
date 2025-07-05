import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    console.log('Debug API called with:', body)
    
    // 권한 확인 제거 - 일반 클라이언트 사용

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
        existingSample,
        updateResult
      }
    })

  } catch (error) {
    console.error('Debug API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류',
      debug: { error: error instanceof Error ? error.message : String(error) }
    }, { status: 500 })
  }
} 