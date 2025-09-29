import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'
import { getKoreaTime } from '@/shared/lib/utils'

// GET - 마일리지 목록 조회 (RPC 함수로 최적화)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requestPage = parseInt(searchParams.get('page') || '1')
    const requestLimit = parseInt(searchParams.get('limit') || '20')
    const userId = searchParams.get('userId') || ''
    const type = searchParams.get('type') || '' // 'earn' or 'spend'
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const source = searchParams.get('source') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    
    const supabase = createClient()

    // 회사명 검색을 위한 user_id 목록 조회
    let userIds: any[] = []
    if (search) {
      const { data: userSearchResult } = await supabase
        .from('users')
        .select('id')
        .ilike('company_name', `%${search}%`)
      
      userIds = userSearchResult || []
    }

    // 🚀 성능 최적화: RPC 함수로 빠른 조회
    console.log('🔍 관리자 마일리지 RPC 함수로 조회 시작...');
    
    const { data: mileages, error } = await supabase.rpc('get_mileage_with_balance', {
      p_user_id: userId || null,
      p_type: type && type !== 'all' ? type : null,
      p_status: status && status !== 'all' ? status : null,
      p_source: source && source !== 'all' ? source : null,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null,
      p_user_ids: userIds.length > 0 ? userIds.map(u => u.id) : null,
      p_limit: requestLimit,
      p_offset: (requestPage - 1) * requestLimit
    });

    if (error) {
      console.error('관리자 마일리지 RPC 조회 오류:', error);
      return NextResponse.json({
        success: false,
        error: '마일리지 목록을 불러오는데 실패했습니다.'
      }, { status: 500 });
    }

    console.log(`✅ 마일리지 RPC 조회 완료: ${mileages?.length || 0}건`);

    // 미스터제이슨 회사의 경우 디버깅 로그
    if (search && search.includes('미스터제이슨')) {
      console.log('🔍 관리자 마일리지 API - 미스터제이슨 디버깅:')
      console.log(`  - 조회된 마일리지 수: ${mileages?.length || 0}`)
      
      // 최근 5개 마일리지 내역 상세 출력
      if (mileages && mileages.length > 0) {
        console.log('  - 최근 5개 마일리지 내역:')
        mileages.slice(0, 5).forEach((item: any, index: number) => {
          console.log(`    ${index + 1}. ${item.type === 'earn' ? '적립' : '차감'}: ${item.amount}원 (${item.created_at}) - 누적잔액: ${item.cumulative_balance?.toLocaleString()}원`)
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: mileages || [],
      pagination: {
        page: requestPage,
        limit: requestLimit,
        total: mileages?.length || 0,
        totalPages: Math.ceil((mileages?.length || 0) / requestLimit)
      }
    })

  } catch (error) {
    console.error('Mileage API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// POST - 마일리지 수동 추가/차감
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, type, amount, description, source = 'manual' } = body

    if (!userId || !type || !amount || !description) {
      return NextResponse.json({
        success: false,
        error: '필수 필드가 누락되었습니다.'
      }, { status: 400 })
    }

    const supabase = createClient()

    // 마일리지 추가
    const { data, error } = await supabase
      .from('mileage')
      .insert({
        user_id: userId,
        type,
        amount: type === 'earn' ? Math.abs(amount) : -Math.abs(amount),
        status: 'completed',
        source,
        description,
        created_at: getKoreaTime()
      })
      .select(`
        *,
        users!mileage_user_id_fkey (
          id,
          company_name,
          representative_name,
          email
        )
      `)
      .single()

    if (error) {
      console.error('마일리지 추가 오류:', error)
      return NextResponse.json({
        success: false,
        error: '마일리지 추가에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data,
      message: '마일리지가 성공적으로 추가되었습니다.'
    })

  } catch (error) {
    console.error('Mileage POST error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}