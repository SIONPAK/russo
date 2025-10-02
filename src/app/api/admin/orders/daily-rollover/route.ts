import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime, getKoreaDate } from '@/shared/lib/utils'

// 한국 공휴일 확인 함수
const isKoreanHoliday = (date: Date) => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  
  // 고정 공휴일
  if (month === 1 && day === 1) return true // 신정
  if (month === 3 && day === 1) return true // 3·1절
  if (month === 5 && day === 5) return true // 어린이날
  if (month === 6 && day === 6) return true // 현충일
  if (month === 8 && day === 15) return true // 광복절
  if (month === 10 && day === 3) return true // 개천절
  if (month === 10 && day === 9) return true // 한글날
  if (month === 12 && day === 25) return true // 성탄절
  
  // 2025년 음력 공휴일 (양력 날짜로 변환)
  if (year === 2025) {
    // 설날 연휴 (음력 12월 29일, 1월 1일, 1월 2일) = 2025년 1월 28일, 29일, 30일
    if (month === 1 && (day === 28 || day === 29 || day === 30)) return true
    
    // 부처님오신날 (음력 4월 8일) = 2025년 5월 5일 (어린이날과 겹침)
    // if (month === 5 && day === 5) return true // 이미 어린이날로 처리됨
    
    // 추석 연휴 (음력 8월 14일, 15일, 16일) = 2025년 10월 5일, 6일, 7일
    if (month === 10 && (day === 5 || day === 6 || day === 7)) return true
  }
  
  // 2026년 음력 공휴일도 필요시 추가
  if (year === 2026) {
    // 설날 연휴 = 2026년 2월 16일, 17일, 18일
    if (month === 2 && (day === 16 || day === 17 || day === 18)) return true
    
    // 부처님오신날 = 2026년 5월 24일
    if (month === 5 && day === 24) return true
  }
  
  return false
}

// GET - 매일 한국시간 자정 5분 후에 pending 주문들을 다음날로 이월 (Vercel Cron Job: UTC 15:05 = KST 00:05)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    console.log('🔄 [주문 이월] 매일 한국시간 자정 이후 pending 주문 이월 처리 시작')
    console.log(`🕐 [실행시간] UTC: ${new Date().toISOString()}, 한국시간: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`)
    
    // 한국 시간 기준으로 날짜 계산
    const now = new Date()
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const yesterday = new Date(koreaTime)
    yesterday.setDate(yesterday.getDate() - 1)
    
    // 어제와 오늘 날짜 문자열 생성
    const yesterdayDate = yesterday.toISOString().split('T')[0]
    const todayDate = koreaTime.toISOString().split('T')[0]
    
    // 주말 및 공휴일 체크
    const yesterdayDayOfWeek = yesterday.getDay()
    const todayDayOfWeek = koreaTime.getDay()
    const isTodayHoliday = isKoreanHoliday(koreaTime)
    const isYesterdayHoliday = isKoreanHoliday(yesterday)
    
    // 토요일(6) 또는 일요일(0)이면 이월 처리 안함
    if (todayDayOfWeek === 0 || todayDayOfWeek === 6) {
      console.log('📅 [이월 처리] 주말은 이월 처리하지 않습니다.')
      return NextResponse.json({
        success: true,
        message: '주말은 이월 처리하지 않습니다.',
        data: {
          yesterdayDate,
          todayDate,
          rolledOverCount: 0,
          isWeekend: true
        }
      })
    }
    
    // 공휴일이면 이월 처리 안함
    if (isTodayHoliday) {
      console.log('📅 [이월 처리] 공휴일은 이월 처리하지 않습니다.')
      return NextResponse.json({
        success: true,
        message: '공휴일은 이월 처리하지 않습니다.',
        data: {
          yesterdayDate,
          todayDate,
          rolledOverCount: 0,
          isHoliday: true
        }
      })
    }
    
    console.log(`📅 [이월 처리] 어제: ${yesterdayDate} → 오늘: ${todayDate}`)
    
    // 금요일 주문은 제외 (월요일까지 유효)
    if (yesterdayDayOfWeek === 5) {
      console.log('📅 [이월 처리] 금요일 주문은 월요일까지 유효하므로 이월하지 않습니다.')
      return NextResponse.json({
        success: true,
        message: '금요일 주문은 월요일까지 유효하므로 이월하지 않습니다.',
        data: {
          yesterdayDate,
          todayDate,
          rolledOverCount: 0,
          isFriday: true
        }
      })
    }
    
    // 1. 어제 날짜의 미처리 주문들 조회 (pending, confirmed)
    const { data: pendingOrders, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        working_date,
        created_at,
        users!orders_user_id_fkey (
          company_name
        )
      `)
      .in('status', ['pending', 'confirmed'])
      .eq('working_date', yesterdayDate)
    
    if (fetchError) {
      console.error('❌ [이월 처리] pending 주문 조회 실패:', fetchError)
      return NextResponse.json({
        success: false,
        error: 'pending 주문 조회에 실패했습니다.'
      }, { status: 500 })
    }
    
    if (!pendingOrders || pendingOrders.length === 0) {
      console.log('📋 [이월 처리] 이월할 pending 주문이 없습니다.')
      return NextResponse.json({
        success: true,
        message: '이월할 pending 주문이 없습니다.',
        data: {
          yesterdayDate,
          todayDate,
          rolledOverCount: 0
        }
      })
    }
    
    console.log(`🔍 [이월 처리] ${pendingOrders.length}개 미처리 주문 발견`)
    
    // 2. 작업일을 오늘로 업데이트
    const orderIds = pendingOrders.map(order => order.id)
    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update({
        working_date: todayDate,
        updated_at: getKoreaTime()
      })
      .in('id', orderIds)
      .select('id, order_number, working_date')
    
    if (updateError) {
      console.error('❌ [이월 처리] 작업일 업데이트 실패:', updateError)
      return NextResponse.json({
        success: false,
        error: '작업일 업데이트에 실패했습니다.'
      }, { status: 500 })
    }
    
    // 3. 이월 로그 기록
    const rolloverLogs = pendingOrders.map(order => ({
      order_id: order.id,
      order_number: order.order_number,
      previous_working_date: yesterdayDate,
      new_working_date: todayDate,
      customer_name: (order.users as any)?.company_name,
      rollover_reason: 'pending 상태로 인한 자동 이월',
      created_at: getKoreaTime()
    }))
    
    const { error: logError } = await supabase
      .from('order_rollover_logs')
      .insert(rolloverLogs)
    
    if (logError) {
      console.error('⚠️ [이월 처리] 로그 기록 실패 (무시하고 계속):', logError)
    }
    
    console.log(`✅ [이월 처리] 완료 - ${updatedOrders?.length || 0}개 주문 이월됨`)
    
    return NextResponse.json({
      success: true,
      message: `${updatedOrders?.length || 0}개 pending 주문이 오늘로 이월되었습니다.`,
      data: {
        yesterdayDate,
        todayDate,
        rolledOverCount: updatedOrders?.length || 0,
        rolledOverOrders: updatedOrders?.map(order => ({
          orderNumber: order.order_number,
          newWorkingDate: order.working_date
        })) || []
      }
    })
    
  } catch (error) {
    console.error('❌ [주문 이월] 처리 중 오류:', error)
    return NextResponse.json({
      success: false,
      error: '주문 이월 처리 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 })
  }
}

// POST - 수동 이월 처리 (테스트용)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { targetDate } = body // YYYY-MM-DD 형식
    
    if (!targetDate) {
      return NextResponse.json({
        success: false,
        error: 'targetDate가 필요합니다.'
      }, { status: 400 })
    }
    
    console.log(`🔄 [수동 이월] ${targetDate} pending 주문 이월 처리 시작`)
    
    const supabase = await createClient()
    
    // 다음날 날짜 계산 (한국시간 기준)
    const nextDate = new Date(targetDate + 'T00:00:00+09:00')
    nextDate.setDate(nextDate.getDate() + 1)
    const nextDateYear = nextDate.getFullYear()
    const nextDateMonth = String(nextDate.getMonth() + 1).padStart(2, '0')
    const nextDateDay = String(nextDate.getDate()).padStart(2, '0')
    const nextDateStr = `${nextDateYear}-${nextDateMonth}-${nextDateDay}`
    
    // 해당 날짜의 pending 주문들 조회
    const { data: pendingOrders, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        working_date,
        created_at,
        users!orders_user_id_fkey (
          company_name
        )
      `)
      .eq('status', 'pending')
      .eq('working_date', targetDate)
    
    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: 'pending 주문 조회에 실패했습니다.'
      }, { status: 500 })
    }
    
    if (!pendingOrders || pendingOrders.length === 0) {
      return NextResponse.json({
        success: true,
        message: '이월할 pending 주문이 없습니다.',
        data: {
          targetDate,
          nextDate: nextDateStr,
          rolledOverCount: 0
        }
      })
    }
    
    // 작업일을 다음날로 업데이트
    const orderIds = pendingOrders.map(order => order.id)
    const { data: updatedOrders, error: updateError } = await supabase
      .from('orders')
      .update({
        working_date: nextDateStr,
        updated_at: getKoreaTime()
      })
      .in('id', orderIds)
      .select('id, order_number, working_date')
    
    if (updateError) {
      return NextResponse.json({
        success: false,
        error: '작업일 업데이트에 실패했습니다.'
      }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      message: `${updatedOrders?.length || 0}개 pending 주문이 ${nextDateStr}로 이월되었습니다.`,
      data: {
        targetDate,
        nextDate: nextDateStr,
        rolledOverCount: updatedOrders?.length || 0,
        rolledOverOrders: updatedOrders?.map(order => ({
          orderNumber: order.order_number,
          newWorkingDate: order.working_date
        })) || []
      }
    })
    
  } catch (error) {
    console.error('❌ [수동 이월] 처리 중 오류:', error)
    return NextResponse.json({
      success: false,
      error: '수동 이월 처리 중 오류가 발생했습니다.'
    }, { status: 500 })
  }
} 