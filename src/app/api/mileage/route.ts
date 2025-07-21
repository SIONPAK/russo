import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime } from '@/shared/lib/utils'

// GET - 사용자 마일리지 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const type = searchParams.get('type')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const limit = parseInt(searchParams.get('limit') || '20')

  console.log('🔍 마일리지 API 요청 파라미터:', {
    userId,
    type,
    startDate,
    endDate,
    limit
  })

  if (!userId) {
    return NextResponse.json({ 
      success: false, 
      error: 'userId 파라미터가 필요합니다' 
    }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    // 먼저 사용자 확인 (실제 컬럼명 사용)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, company_name, representative_name, mileage_balance')
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('사용자 조회 오류:', userError)
      return NextResponse.json({ 
        success: false, 
        error: '사용자를 찾을 수 없습니다' 
      }, { status: 404 })
    }

    console.log('🔍 조회된 사용자:', userData)

    // 마일리지 데이터 조회 쿼리 구성
    let query = supabase
      .from('mileage')
      .select(`
        id,
        user_id,
        amount,
        type,
        source,
        description,
        status,
        order_id,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // 타입 필터
    if (type && type !== 'all') {
      query = query.eq('type', type)
    }

    // 날짜 필터
    if (startDate && endDate) {
      query = query.gte('created_at', startDate).lte('created_at', endDate + 'T23:59:59')
    }

    // 제한
    if (limit) {
      query = query.limit(limit)
    }

    console.log('🔍 실행할 쿼리 파라미터:', { userId, type, startDate, endDate, limit })

    const { data: mileageData, error: mileageError } = await query

    if (mileageError) {
      console.error('마일리지 조회 오류:', mileageError)
      return NextResponse.json({ 
        success: false, 
        error: '마일리지 데이터 조회 실패' 
      }, { status: 500 })
    }

    console.log('🔍 조회된 마일리지 데이터:', mileageData)
    console.log('🔍 마일리지 데이터 수:', mileageData?.length || 0)

    // 전체 마일리지 데이터로 잔액 계산
    const { data: allMileageData, error: allMileageError } = await supabase
      .from('mileage')
      .select('amount, type, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (allMileageError) {
      console.error('전체 마일리지 조회 오류:', allMileageError)
    }

    console.log('🔍 전체 마일리지 데이터 수:', allMileageData?.length || 0)

    // 잔액 계산 - 항상 실제 마일리지 내역을 기반으로 계산
    let currentBalance = 0
    
    if (allMileageData) {
      currentBalance = allMileageData.reduce((sum: number, item: any) => {
        // amount 필드에 이미 정확한 부호가 들어있음 (earn: +, spend: -)
        return sum + item.amount
      }, 0)
    }

    console.log('🔍 실제 마일리지 내역 기반 계산된 잔액:', currentBalance)
    console.log('🔍 DB users 테이블의 mileage_balance:', userData.mileage_balance)
    console.log('🔍 잔액 차이:', currentBalance - (userData.mileage_balance || 0))

    // 이번 달 통계 계산
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const thisMonthData = allMileageData?.filter((item: any) => {
      const itemDate = new Date(item.created_at)
      return itemDate >= thisMonthStart && itemDate <= thisMonthEnd
    }) || []

    const thisMonthEarned = thisMonthData
      .filter((item: any) => item.type === 'earn')
      .reduce((sum: number, item: any) => sum + item.amount, 0)

    const thisMonthSpent = thisMonthData
      .filter((item: any) => item.type === 'spend')
      .reduce((sum: number, item: any) => sum + Math.abs(item.amount), 0)

    const summary = {
      currentBalance,
      thisMonthEarned,
      thisMonthSpent
    }

    console.log('🔍 계산된 요약:', summary)

    return NextResponse.json({
      success: true,
      data: {
        mileages: mileageData || [],
        summary,
        user: userData
      }
    })

  } catch (error) {
    console.error('마일리지 API 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다' 
    }, { status: 500 })
  }
}

// 마일리지 추가 (관리자용)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, amount, type, description, source = 'manual' } = body

    if (!userId || !amount || !type || !description) {
      return NextResponse.json({ 
        success: false, 
        error: '필수 파라미터가 누락되었습니다' 
      }, { status: 400 })
    }

    const supabase = await createClient()

    // 트랜잭션 시작 - 먼저 현재 사용자 정보 조회
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('id, mileage_balance')
      .eq('id', userId)
      .single()

    if (userError) {
      console.error('사용자 조회 오류:', userError)
      return NextResponse.json({ 
        success: false, 
        error: '사용자를 찾을 수 없습니다' 
      }, { status: 404 })
    }

    // 현재 잔액 계산
    const currentBalance = currentUser.mileage_balance || 0
    const amountValue = Math.abs(amount)
    const newBalance = type === 'earn' 
      ? currentBalance + amountValue 
      : currentBalance - amountValue

    // 차감 시 잔액 부족 체크 제거 - 음수 허용
    // if (type === 'spend' && newBalance < 0) {
    //   return NextResponse.json({ 
    //     success: false, 
    //     error: '마일리지 잔액이 부족합니다' 
    //   }, { status: 400 })
    // }

    console.log('🔍 마일리지 업데이트:', {
      userId,
      currentBalance,
      amountValue,
      type,
      newBalance
    })

    // 1. 마일리지 내역 추가
    const { data: mileageData, error: mileageError } = await supabase
      .from('mileage')
      .insert([
        {
          user_id: userId,
          amount: amountValue,
          type,
          description,
          source,
          status: 'completed',
          created_at: getKoreaTime(),
          updated_at: getKoreaTime()
        }
      ])
      .select()

    if (mileageError) {
      console.error('마일리지 내역 추가 오류:', mileageError)
      return NextResponse.json({ 
        success: false, 
        error: '마일리지 내역 추가 실패' 
      }, { status: 500 })
    }

    // 2. 사용자 마일리지 잔액 업데이트
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ 
        mileage_balance: newBalance,
        updated_at: getKoreaTime()
      })
      .eq('id', userId)
      .select('id, mileage_balance')

    if (updateError) {
      console.error('사용자 마일리지 잔액 업데이트 오류:', updateError)
      
      // 롤백: 방금 추가한 마일리지 내역 삭제
      await supabase
        .from('mileage')
        .delete()
        .eq('id', mileageData[0].id)
      
      return NextResponse.json({ 
        success: false, 
        error: '마일리지 잔액 업데이트 실패' 
      }, { status: 500 })
    }

    console.log('🔍 마일리지 업데이트 완료:', {
      mileageRecord: mileageData[0],
      updatedBalance: updatedUser?.[0]?.mileage_balance
    })

    return NextResponse.json({
      success: true,
      data: {
        mileage: mileageData[0],
        user: updatedUser?.[0],
        previousBalance: currentBalance,
        newBalance: newBalance
      }
    })

  } catch (error) {
    console.error('마일리지 추가 API 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '서버 오류가 발생했습니다' 
    }, { status: 500 })
  }
} 