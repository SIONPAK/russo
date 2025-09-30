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

    // 🚀 극한 최적화: 검색 최적화 (인덱스 활용)
    let userIds: any[] = []
    if (search) {
      // 🚀 검색 쿼리 최적화: LIMIT 추가로 성능 향상
      const { data: userSearchResult } = await supabase
        .from('users')
        .select('id')
        .ilike('company_name', `%${search}%`)
        .limit(100) // 🚀 검색 결과 제한으로 성능 향상
      
      userIds = userSearchResult || []
    }

    // 🚀 극한 성능 최적화: 한 번의 쿼리로 모든 데이터 조회
    console.log('🔍 관리자 마일리지 한 번에 모든 데이터 조회 시작...');
    
    let query = supabase
      .from('mileage')
      .select(`
        id,
        user_id,
        amount,
        type,
        status,
        source,
        description,
        created_at,
        final_balance
      `)
      .order('created_at', { ascending: false })

    // 🚀 필터 적용
    if (userId) query = query.eq('user_id', userId);
    if (type && type !== 'all') query = query.eq('type', type);
    if (status && status !== 'all') query = query.eq('status', status);
    if (source && source !== 'all') query = query.eq('source', source);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);
    if (userIds.length > 0) query = query.in('user_id', userIds.map(u => u.id));

    const { data: mileages, error } = await query;

    if (error) {
      console.error('관리자 마일리지 조회 오류:', error);
      return NextResponse.json({
        success: false,
        error: '마일리지 목록을 불러오는데 실패했습니다.'
      }, { status: 500 });
    }

    console.log(`🔍 마일리지 데이터 조회 완료: ${mileages?.length || 0}건`);

    // 🚀 3단계: 사용자 정보 별도 조회 (JOIN 대신)
    let userInfoMap = new Map();
    if (mileages && mileages.length > 0) {
      const userIds = [...new Set(mileages.map(m => m.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, company_name, representative_name, email')
          .in('id', userIds);
        
        users?.forEach(user => {
          userInfoMap.set(user.id, user);
        });
      }
    }

    // 🚀 4단계: 데이터 병합 (JOIN 없이)
    if (mileages && mileages.length > 0) {
      const optimizedMileages = mileages.map((mileage: any) => {
        const userInfo = userInfoMap.get(mileage.user_id) || {};
        return {
          ...mileage,
          cumulative_balance: mileage.final_balance || 0,
          users: {
            company_name: userInfo.company_name || '알 수 없음',
            representative_name: userInfo.representative_name || '',
            email: userInfo.email || ''
          }
        };
      });
      
      // 원본 배열 교체
      mileages.splice(0, mileages.length, ...optimizedMileages);
    }

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
    const { userId, user_id, type, amount, description, source = 'manual' } = body
    
    // userId 또는 user_id 둘 다 지원
    const actualUserId = userId || user_id

    if (!actualUserId || !type || !amount || !description) {
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
        user_id: actualUserId,
        type,
        amount: type === 'earn' ? Math.abs(amount) : -Math.abs(amount),
        status: 'completed',
        source,
        description,
        created_at: getKoreaTime()
      })
      .select('id')
      .single()

    if (error) {
      console.error('마일리지 추가 오류:', error)
      return NextResponse.json({
        success: false,
        error: '마일리지 추가에 실패했습니다.'
      }, { status: 500 })
    }

    // final_balance 수동 계산 및 업데이트
    try {
      // 사용자의 최종 마일리지 잔액 계산
      const { data: userMileages } = await supabase
        .from('mileage')
        .select('amount, type')
        .eq('user_id', actualUserId)
        .eq('status', 'completed');
      
      let finalBalance = 0;
      if (userMileages) {
        finalBalance = userMileages.reduce((sum, m) => {
          return m.type === 'earn' ? sum + m.amount : sum - Math.abs(m.amount);
        }, 0);
      }
      
      // final_balance 업데이트
      await supabase
        .from('mileage')
        .update({ final_balance: finalBalance })
        .eq('id', data.id);
    } catch (balanceError) {
      console.error('final_balance 업데이트 실패:', balanceError);
    }

    // 최종 데이터 조회
    const { data: finalData, error: fetchError } = await supabase
      .from('mileage')
      .select(`
        *,
        users!mileage_user_id_fkey (
          id,
          company_name,
          representative_name,
          email
        )
      `)
      .eq('id', data.id)
      .single()

    if (fetchError) {
      console.error('최종 데이터 조회 오류:', fetchError)
      return NextResponse.json({
        success: false,
        error: '마일리지 데이터 조회에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: finalData,
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