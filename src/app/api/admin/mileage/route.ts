import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'
import { getKoreaTime } from '@/shared/lib/utils'
import { executeBatchQuery } from '@/shared/lib/batch-utils'

// GET - 마일리지 목록 조회 (성능 최적화)
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
    
    const offset = (requestPage - 1) * requestLimit
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

    // 🚀 성능 최적화: 페이지네이션으로 모든 데이터 조회
    let mileages: any[] = [];
    let fetchPage = 0;
    const fetchLimit = 1000; // Supabase 기본 limit
    let hasMore = true;

    console.log('🔍 관리자 마일리지 데이터 페이지네이션으로 조회 시작...');

    while (hasMore) {
      let query = supabase
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

      // 필터 적용
      if (userId) {
        query = query.eq('user_id', userId)
      }
      
      if (type && type !== 'all') {
        query = query.eq('type', type)
      }
      
      if (status && status !== 'all') {
        query = query.eq('status', status)
      }
      
      if (source && source !== 'all') {
        query = query.eq('source', source)
      }
      
      // 🚀 개선된 검색 로직 (안전한 방식)
      if (search) {
        // 검색어에서 특수문자 이스케이프 처리
        const escapedSearch = search.replace(/[%_]/g, '\\$&')
        
        // 회사명으로 검색된 사용자 ID가 있는 경우
        if (userIds.length > 0) {
          const userIdList = userIds.map(user => user.id)
          
          // description 검색과 user_id 검색을 OR 조건으로 결합
          query = query.or(`description.ilike.%${escapedSearch}%,user_id.in.(${userIdList.join(',')})`)
        } else {
          // description만 검색
          query = query.ilike('description', `%${escapedSearch}%`)
        }
      }
      
      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }
      
      if (dateTo) {
        query = query.lte('created_at', dateTo + 'T23:59:59')
      }

      // 정렬 및 페이지네이션
      query = query
        .order('created_at', { ascending: false })
        .range(fetchPage * fetchLimit, (fetchPage + 1) * fetchLimit - 1)

      const { data: pageData, error } = await query

      if (error) {
        console.error(`관리자 마일리지 페이지 ${fetchPage} 조회 오류:`, error);
        return NextResponse.json({
          success: false,
          error: '마일리지 목록을 불러오는데 실패했습니다.'
        }, { status: 500 });
      }

      if (pageData && pageData.length > 0) {
        mileages = mileages.concat(pageData);
        console.log(`🔍 관리자 마일리지 페이지 ${fetchPage + 1}: ${pageData.length}건 조회 (총 ${mileages.length}건)`);
        fetchPage++;
        
        // 1000건 미만이면 마지막 페이지
        if (pageData.length < fetchLimit) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    console.log(`🔍 관리자 마일리지 전체 데이터 조회 완료: ${mileages.length}건`);

    // 실제 데이터 수를 사용 (카운트 쿼리 제거)
    const count = mileages?.length || 0
    console.log(`🔍 관리자 마일리지 API - 조회된 데이터 수: ${count}건`)

    // 에러 체크는 위에서 이미 처리됨

    // 누적 잔액 계산을 위한 로직 추가
    const calculateCumulativeBalances = (mileageData: any[]) => {
      // 사용자별로 그룹핑
      const userGroups = new Map<string, any[]>()
      
      mileageData.forEach(mileage => {
        const userId = mileage.user_id
        if (!userGroups.has(userId)) {
          userGroups.set(userId, [])
        }
        userGroups.get(userId)!.push(mileage)
      })

      // 각 사용자별로 시간순 정렬 후 누적 잔액 계산
      const userBalances = new Map<string, number>()
      
      userGroups.forEach((userMileages, userId) => {
        // 시간순 정렬 (오래된 것부터)
        const sortedMileages = userMileages.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        
        let runningBalance = 0
        sortedMileages.forEach(mileage => {
          if (mileage.status === 'completed') {
            const absoluteAmount = Math.abs(mileage.amount)
            if (mileage.type === 'earn') {
              runningBalance += absoluteAmount
            } else if (mileage.type === 'spend') {
              runningBalance -= absoluteAmount
            }
          }
          // 각 마일리지에 누적 잔액 저장
          mileage.cumulative_balance = runningBalance
        })
        
        userBalances.set(userId, runningBalance)
      })

      return { userBalances, mileageData }
    }

    // 누적 잔액 계산
    const { userBalances, mileageData } = calculateCumulativeBalances(mileages || [])

    // 미스터제이슨 회사의 경우 디버깅 로그
    if (search && search.includes('미스터제이슨')) {
      console.log('🔍 관리자 마일리지 API - 미스터제이슨 디버깅:')
      console.log(`  - 조회된 마일리지 수: ${mileageData.length}`)
      userBalances.forEach((balance, userId) => {
        console.log(`  - 사용자 ${userId} 최종 잔액: ${balance.toLocaleString()}원`)
      })
      
      // 최근 5개 마일리지 내역 상세 출력
      if (mileageData.length > 0) {
        console.log('  - 최근 5개 마일리지 내역:')
        mileageData.slice(0, 5).forEach((item, index) => {
          console.log(`    ${index + 1}. ${item.type === 'earn' ? '적립' : '차감'}: ${item.amount}원 (${item.created_at}) - 누적잔액: ${item.cumulative_balance?.toLocaleString()}원`)
        })
      }
    }

    // 모든 데이터를 가져오므로 페이지네이션 정보 단순화
    return NextResponse.json({
      success: true,
      data: mileageData || [],
      pagination: {
        page: 1,
        limit: count,
        total: count,
        totalPages: 1
      },
      userBalances: Object.fromEntries(userBalances) // 사용자별 잔액 정보 포함
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
    const supabase = createClient()
    const body = await request.json()
    
    const { 
      user_id,
      amount,
      type, // 'earn' or 'spend'
      description,
      source = 'manual',
      order_id = null
    } = body

    // 필수 필드 검증
    if (!user_id || !amount || !type || !description) {
      return NextResponse.json({
        success: false,
        error: '필수 정보가 누락되었습니다.'
      }, { status: 400 })
    }

    // 사용자 존재 확인
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, company_name, representative_name')
      .eq('id', user_id)
      .single()

    if (userError || !user) {
      return NextResponse.json({
        success: false,
        error: '존재하지 않는 사용자입니다.'
      }, { status: 400 })
    }

    // 마일리지 거래 생성
    const { data: mileage, error } = await supabase
      .from('mileage')
      .insert({
        user_id,
        amount,
        type,
        source,
        description,
        status: 'completed', // 수동 처리는 즉시 완료
        order_id,
        created_at: getKoreaTime(),
        updated_at: getKoreaTime()
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
      console.error('Mileage creation error:', error)
      return NextResponse.json({
        success: false,
        error: '마일리지 처리에 실패했습니다.'
      }, { status: 500 })
    }

    // 로그 기록
    await supabase
      .from('mileage_logs')
      .insert({
        user_id,
        type: 'manual_process',
        amount,
        reason: `수동 ${type === 'earn' ? '적립' : '차감'}`,
        reference_id: mileage.id,
        reference_type: 'mileage',
        description: `관리자 수동 처리: ${description}`,
        created_at: getKoreaTime()
      })

    return NextResponse.json({
      success: true,
      data: mileage,
      message: `마일리지가 성공적으로 ${type === 'earn' ? '적립' : '차감'}되었습니다.`
    })

  } catch (error) {
    console.error('Mileage creation API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}

// PUT - 마일리지 상태 업데이트
export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient()
    const body = await request.json()
    
    const { mileageIds, status } = body

    if (!mileageIds || !Array.isArray(mileageIds) || mileageIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: '마일리지 ID가 필요합니다.'
      }, { status: 400 })
    }

    if (!status || !['pending', 'completed', 'cancelled'].includes(status)) {
      return NextResponse.json({
        success: false,
        error: '유효하지 않은 상태입니다.'
      }, { status: 400 })
    }

    // 상태 업데이트
    const { error } = await supabase
      .from('mileage')
      .update({ 
        status,
        updated_at: getKoreaTime()
      })
      .in('id', mileageIds)

    if (error) {
      console.error('Mileage status update error:', error)
      return NextResponse.json({
        success: false,
        error: '마일리지 상태 업데이트에 실패했습니다.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: '마일리지 상태가 성공적으로 업데이트되었습니다.'
    })

  } catch (error) {
    console.error('Mileage status update API error:', error)
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 })
  }
}