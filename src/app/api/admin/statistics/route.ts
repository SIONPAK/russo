import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // 권한 확인 제거 - 일반 클라이언트 사용

    // 기본 통계 조회
    const [
      totalOrdersResult,
      totalRevenueResult,
      totalCustomersResult,
      totalProductsResult,
      orderStatsResult,
      customerGradeStatsResult
    ] = await Promise.all([
      // 총 주문수
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`),
      
      // 총 매출
      supabase
        .from('orders')
        .select('total_amount')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`),
      
      // 총 고객수
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'customer'),
      
      // 총 상품수
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true }),
      
      // 주문 상태별 통계
      supabase
        .from('orders')
        .select('status')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`),
      
      // 고객 등급별 통계
      supabase
        .from('users')
        .select(`
          customer_grade,
          orders!inner(
            id,
            total_amount,
            created_at
          )
        `)
        .eq('role', 'customer')
        .gte('orders.created_at', `${startDate}T00:00:00`)
        .lte('orders.created_at', `${endDate}T23:59:59`)
    ])

    // 미출고 및 반품 통계
    const [pendingShipmentsResult, returnStatementsResult] = await Promise.all([
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
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`)
    ])

    // 일별 통계 생성 (최근 30일)
    const dailyStats = []
    const currentDate = new Date(endDate || new Date())
    const startDateObj = new Date(startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
    
    for (let d = new Date(startDateObj); d <= currentDate; d.setDate(d.getDate() + 1)) {
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
    const totalRevenue = totalRevenueResult.data?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0

    // 주문 상태별 집계
    const orderStats = {
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    }

    orderStatsResult.data?.forEach(order => {
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

    const gradeGroups = customerGradeStatsResult.data?.reduce((acc: any, user: any) => {
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
        totalOrders: totalOrdersResult.count || 0,
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