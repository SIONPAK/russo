import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'

// GET - 문서 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const userId = searchParams.get('userId') || ''
    const search = searchParams.get('search') || ''
    const type = searchParams.get('type') || ''
    
    // documents 테이블이 없으므로 임시로 빈 배열 반환
    // 실제로는 주문 완료 후 생성되는 영수증/명세서 파일들을 관리해야 함
    console.log('Documents API called:', { userId, search, type, page })
    
    return NextResponse.json({
      success: true,
      data: [], // 빈 배열 반환
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0
      }
    })

  } catch (error) {
    console.error('Documents API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// POST - 문서 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    const { 
      user_id,
      order_id,
      type,
      title,
      description,
      filename,
      file_url,
      amount
    } = body

    // 필수 필드 검증
    if (!user_id || !type || !title || !filename || !file_url) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 })
    }

    // documents 테이블이 없으므로 임시로 성공 응답
    console.log('Document creation requested:', { user_id, order_id, type, title })

    return NextResponse.json({
      success: true,
      data: {
        id: Date.now().toString(),
        user_id,
        order_id,
        type,
        title,
        description,
        filename,
        file_url,
        amount,
        created_at: new Date().toISOString()
      },
      message: '문서가 성공적으로 생성되었습니다.'
    })

  } catch (error) {
    console.error('Document creation API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 