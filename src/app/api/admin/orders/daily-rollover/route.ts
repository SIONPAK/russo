import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'
import { getKoreaTime, getKoreaDate } from '@/shared/lib/utils'

// GET - 매일 자정에 pending 주문들을 다음날로 이월 (Vercel Cron Job)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    console.log('🔄 [주문 이월] 매일 자정 pending 주문 이월 처리 시작')
    
    // 한국 시간 기준으로 어제 날짜 계산
    const now = new Date()
    const koreaTime = new Date(now.getTime() + (9 * 60 * 60 * 1000))
    const yesterday = new Date(koreaTime.getTime() - (24 * 60 * 60 * 1000))
    
    // 한국시간으로 날짜 문자열 직접 생성
    const yesterdayYear = yesterday.getFullYear()
    const yesterdayMonth = String(yesterday.getMonth() + 1).padStart(2, '0')
    const yesterdayDay = String(yesterday.getDate()).padStart(2, '0')
    const yesterdayDate = `${yesterdayYear}-${yesterdayMonth}-${yesterdayDay}`
    
    const todayYear = koreaTime.getFullYear()
    const todayMonth = String(koreaTime.getMonth() + 1).padStart(2, '0')
    const todayDay = String(koreaTime.getDate()).padStart(2, '0')
    const todayDate = `${todayYear}-${todayMonth}-${todayDay}`
    
    console.log(`📅 [이월 처리] 어제: ${yesterdayDate} → 오늘: ${todayDate}`)
    
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