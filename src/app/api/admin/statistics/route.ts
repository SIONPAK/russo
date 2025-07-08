import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({ 
        success: false, 
        error: '시작 날짜와 종료 날짜가 필요합니다.' 
      }, { status: 400 })
    }

    // DB에 이미 한국 시간으로 저장되어 있음
    const startDateObj = new Date(startDate)
    const endDateObj = new Date(endDate)
    
    const startTimeStr = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')} 00:00:00`
    const endTimeStr = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')} 23:59:59`
    
    console.log(`통계 날짜 필터: ${startDate} ~ ${endDate}`)
    console.log(`시간 범위: ${startTimeStr} ~ ${endTimeStr}`)

    // 1. 주문 통계
    const { data: orders } = await supabase
      .from('orders')
      .select('status, total_amount, created_at')
      .gte('created_at', startTimeStr)
      .lte('created_at', endTimeStr)

    // 2. 사용자 통계 (신규 가입)
    const { data: newUsers } = await supabase
      .from('users')
      .select('id, created_at')
      .gte('created_at', startTimeStr)
      .lte('created_at', endTimeStr)

    // 3. 상품별 판매 통계
    const { data: productSales } = await supabase
      .from('order_items')
      .select(`
        product_name,
        quantity,
        unit_price,
        total_price,
        orders!inner(
          created_at,
          status
        )
      `)
      .gte('orders.created_at', startTimeStr)
      .lte('orders.created_at', endTimeStr)
      .eq('orders.status', 'completed')

    // 4. 업체별 주문 통계
    const { data: companyOrders } = await supabase
      .from('orders')
      .select(`
        total_amount,
        created_at,
        users!inner(
          company_name,
          customer_grade
        )
      `)
      .gte('created_at', startTimeStr)
      .lte('created_at', endTimeStr)

    // 5. 마일리지 통계
    const { data: mileageStats } = await supabase
      .from('mileage')
      .select('type, amount, created_at')
      .gte('created_at', startTimeStr)
      .lte('created_at', endTimeStr)

    // 기본 통계 조회 (이미 위에서 조회한 데이터 활용)
    const [
      totalCustomersResult,
      totalProductsResult,
      pendingShipmentsResult,
      returnStatementsResult
    ] = await Promise.all([
      // 총 고객수
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer'),
      
      // 총 상품수
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true }),
      
      // 미출고 수 (임시 계산)
      supabase
        .from('order_items')
        .select('quantity, shipped_quantity')
        .lt('shipped_quantity', 'quantity'),
      
      // 반품 수 (임시 계산 - 실제로는 return_statements 테이블 필요)
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'returned')
        .gte('created_at', startTimeStr)
        .lte('created_at', endTimeStr)
    ])

    // 일별 통계 생성 (최근 30일)
    const dailyStats = []
    const currentDate = new Date(endDate)
    const dailyStartDateObj = new Date(startDate)
    
    for (let d = new Date(dailyStartDateObj); d <= currentDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      
      // 임시 데이터 생성 (실제로는 DB에서 조회)
      dailyStats.push({
        date: dateStr,
        orders: Math.floor(Math.random() * 50) + 10,
        revenue: Math.floor(Math.random() * 5000000) + 1000000,
        newCustomers: Math.floor(Math.random() * 10) + 1
      })
    }

    // 인기 상품 TOP 10 (임시 데이터)
    const topProducts = Array.from({ length: 10 }, (_, i) => ({
      id: `product_${i + 1}`,
      name: `인기상품 ${i + 1}`,
      orders: Math.floor(Math.random() * 100) + 50,
      revenue: Math.floor(Math.random() * 10000000) + 5000000,
      stock: Math.floor(Math.random() * 500) + 100
    })).sort((a, b) => b.orders - a.orders)

    // 주요 고객 TOP 10 (임시 데이터)
    const topCustomers = Array.from({ length: 10 }, (_, i) => {
      const grades = ['premium', 'vip', 'general']
      const grade = grades[Math.floor(Math.random() * grades.length)]
      
      return {
        id: `customer_${i + 1}`,
        companyName: `주요업체 ${i + 1}`,
        grade,
        orders: Math.floor(Math.random() * 200) + 100,
        revenue: Math.floor(Math.random() * 50000000) + 20000000,
        lastOrderDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    }).sort((a, b) => b.revenue - a.revenue)

    // 결과 데이터 구성
    const totalRevenue = orders?.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0) || 0

    // 주문 상태별 집계
    const orderStats = {
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    }

    orders?.forEach((order: any) => {
      if (order.status in orderStats) {
        orderStats[order.status as keyof typeof orderStats]++
      }
    })

    // 고객 등급별 집계
    const customerGradeStats = {
      premium: { count: 0, orders: 0, revenue: 0 },
      vip: { count: 0, orders: 0, revenue: 0 },
      general: { count: 0, orders: 0, revenue: 0 }
    }

    const gradeGroups = companyOrders?.reduce((acc: any, user: any) => {
      const grade = user.customer_grade || 'general'
      if (!acc[grade]) acc[grade] = []
      acc[grade].push(user)
      return acc
    }, {})

    Object.keys(gradeGroups || {}).forEach(grade => {
      if (grade in customerGradeStats) {
        const users = gradeGroups[grade]
        customerGradeStats[grade as keyof typeof customerGradeStats] = {
          count: users.length,
          orders: users.reduce((sum: number, user: any) => sum + (user.orders?.length || 0), 0),
          revenue: users.reduce((sum: number, user: any) => 
            sum + (user.orders?.reduce((orderSum: number, order: any) => orderSum + (order.total_amount || 0), 0) || 0), 0
          )
        }
      }
    })

    const statisticsData = {
      overview: {
        totalOrders: orders?.length || 0,
        totalRevenue,
        totalCustomers: totalCustomersResult.count || 0,
        totalProducts: totalProductsResult.count || 0,
        pendingShipments: pendingShipmentsResult.data?.length || 0,
        returnStatements: returnStatementsResult.count || 0
      },
      orderStats,
      customerGradeStats,
      dailyStats,
      topProducts,
      topCustomers
    }

    return NextResponse.json({
      success: true,
      data: statisticsData
    })

  } catch (error) {
    console.error('Statistics fetch error:', error)
    return NextResponse.json({ 
      success: false, 
      error: '통계 데이터 조회 중 오류가 발생했습니다.' 
    }, { status: 500 })
  }
} 