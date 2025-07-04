import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

// GET - 사용자 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const sortBy = searchParams.get('sortBy') || 'created_at'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    
    const offset = (page - 1) * limit

    // 기본 쿼리
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })

    // 검색 조건
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,representative_name.ilike.%${search}%,email.ilike.%${search}%,business_number.ilike.%${search}%`)
    }

    // 상태 필터
    if (status) {
      query = query.eq('approval_status', status)
    }

    // 정렬
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })

    // 페이지네이션
    query = query.range(offset, offset + limit - 1)

    const { data: users, error, count } = await query

    if (error) {
      console.error('Users fetch error:', error)
      return NextResponse.json(
        { success: false, error: '사용자 목록을 불러오는데 실패했습니다.' },
        { status: 500 }
      )
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: users || [],
      pagination: {
        currentPage: page,
        totalPages,
        totalCount: count || 0,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    })

  } catch (error) {
    console.error('Users API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// POST - 사용자 생성 (관리자가 직접 생성하는 경우)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      email,
      password,
      company_name,
      business_number,
      representative_name,
      phone,
      address,
      postal_code,
      recipient_name,
      recipient_phone,
      approval_status = 'approved' // 관리자가 생성하는 경우 바로 승인
    } = body

    // 필수 필드 검증
    if (!email || !password || !company_name || !business_number || !representative_name) {
      return NextResponse.json(
        { success: false, error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      )
    }

    // 비밀번호 해시 (실제로는 bcrypt 사용 권장)
    const password_hash = Buffer.from(password).toString('base64') // 임시 해시

    const { data: user, error } = await supabase
      .from('users')
      .insert([{
        email,
        password_hash,
        company_name,
        business_number,
        representative_name,
        phone,
        address,
        postal_code,
        recipient_name,
        recipient_phone,
        approval_status
      }])
      .select()
      .single()

    if (error) {
      console.error('User creation error:', error)
      
      // 중복 에러 처리
      if (error.code === '23505') {
        if (error.message.includes('email')) {
          return NextResponse.json(
            { success: false, error: '이미 등록된 이메일입니다.' },
            { status: 400 }
          )
        }
        if (error.message.includes('business_number')) {
          return NextResponse.json(
            { success: false, error: '이미 등록된 사업자번호입니다.' },
            { status: 400 }
          )
        }
      }

      return NextResponse.json(
        { success: false, error: '사용자 생성에 실패했습니다.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: user,
      message: '사용자가 성공적으로 생성되었습니다.'
    })

  } catch (error) {
    console.error('User creation API error:', error)
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 