import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'

// GET - 문서 미리보기
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const { id } = params

    // 문서 정보 조회
    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !document) {
      return NextResponse.json({
        success: false,
        error: '문서를 찾을 수 없습니다.'
      }, { status: 404 })
    }

    // 파일 URL이 있는 경우 미리보기 페이지로 리다이렉트
    if (document.file_url) {
      // PDF 파일인 경우 브라우저에서 직접 열기
      if (document.filename.toLowerCase().endsWith('.pdf')) {
        return NextResponse.redirect(document.file_url)
      }
      
      // 다른 파일 타입은 다운로드로 처리
      return NextResponse.redirect(document.file_url)
    }

    // 파일 URL이 없는 경우 오류 반환
    return NextResponse.json({
      success: false,
      error: '파일을 찾을 수 없습니다.'
    }, { status: 404 })

  } catch (error) {
    console.error('Document preview error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 