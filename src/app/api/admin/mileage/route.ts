import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase'
import { getKoreaTime } from '@/shared/lib/utils'
import { executeBatchQuery } from '@/shared/lib/batch-utils'

// GET - 마일리지 목록 조회 (성능 최적화)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const userId = searchParams.get('userId') || ''
    const type = searchParams.get('type') || '' // 'earn' or 'spend'
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const source = searchParams.get('source') || ''
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    
    const offset = (page - 1) * limit
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

    // 🚀 성능 최적화: 단일 쿼리로 검색 및 조회
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
    
    // 🚀 개선된 검색 로직
    if (search) {
      // description 검색과 회사명 검색을 OR 조건으로 결합
      const searchConditions = [`description.ilike.%${search}%`]
      
      if (userIds.length > 0) {
        const userIdList = userIds.map(user => user.id)
        searchConditions.push(`user_id.in.(${userIdList.join(',')})`)
      }
      
      query = query.or(searchConditions.join(','))
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
      .range(offset, offset + limit - 1)

    const { data: mileages, error } = await query

    // 🚀 성능 최적화: 카운트 쿼리 간소화
    let countQuery = supabase
      .from('mileage')
      .select('id', { count: 'exact', head: true })

    // 동일한 필터 적용
    if (userId) countQuery = countQuery.eq('user_id', userId)
    if (type && type !== 'all') countQuery = countQuery.eq('type', type)
    if (status && status !== 'all') countQuery = countQuery.eq('status', status)
    if (source && source !== 'all') countQuery = countQuery.eq('source', source)
    
    // 검색 필터 적용
    if (search) {
      const searchConditions = [`description.ilike.%${search}%`]
      
      if (userIds.length > 0) {
        const userIdList = userIds.map(user => user.id)
        searchConditions.push(`user_id.in.(${userIdList.join(',')})`)
      }
      
      countQuery = countQuery.or(searchConditions.join(','))
    }
    
    if (dateFrom) countQuery = countQuery.gte('created_at', dateFrom)
    if (dateTo) countQuery = countQuery.lte('created_at', dateTo + 'T23:59:59')

    const { count } = await countQuery

    if (error) {
      console.error('Mileage fetch error:', error)
      return NextResponse.json({
        success: false,
        error: '마일리지 목록을 불러오는데 실패했습니다.'
      }, { status: 500 })
    }

    const totalPages = Math.ceil((count || 0) / limit)

    return NextResponse.json({
      success: true,
      data: mileages || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages
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