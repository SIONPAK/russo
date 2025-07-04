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
    
    const offset = (page - 1) * limit
    const supabase = createClient()

    let query = supabase
      .from('documents')
      .select(`
        *,
        orders!documents_order_id_fkey (
          order_number
        )
      `, { count: 'exact' })

    // 사용자 필터
    if (userId) {
      query = query.eq('user_id', userId)
    }

    // 검색 조건 적용
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }

    // 문서 타입 필터
    if (type && type !== 'all') {
      query = query.eq('type', type)
    }

    // 정렬 및 페이지네이션
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: documents, error, count } = await query

    if (error) {
      console.error('Documents fetch error:', error)
      return NextResponse.json({
        success: false,
        error: '문서 목록을 불러오는데 실패했습니다.'
      }, { status: 500 })
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: documents || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
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

    const { data: document, error } = await supabase
      .from('documents')
      .insert({
        user_id,
        order_id,
        type,
        title,
        description,
        filename,
        file_url,
        amount
      })
      .select()
      .single()

    if (error) {
      console.error('Document creation error:', error)
      return NextResponse.json({
        success: false,
        error: '문서 생성에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: document,
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