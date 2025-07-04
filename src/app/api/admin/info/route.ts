import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/shared/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const activities: any[] = []

    // 1. 최근 주문 (최신 5건)
    const { data: recentOrders } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        total_amount,
        created_at,
        users!orders_user_id_fkey (
          company_name,
          representative_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(5)

    if (recentOrders) {
      recentOrders.forEach((order: any) => {
        const companyName = order.users?.company_name || order.users?.representative_name || '고객'
        activities.push({
          id: `order-${order.id}`,
          type: 'order',
          title: '새로운 주문 접수',
          description: `${companyName} - ${order.order_number} (${(order.total_amount / 10000).toLocaleString()}만원)`,
          timestamp: order.created_at,
          icon: 'order'
        })
      })
    }

    // 2. 승인 대기 중인 회원 (최신 3건)
    const { data: pendingUsers } = await supabase
      .from('users')
      .select('id, company_name, representative_name, created_at')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(3)

    if (pendingUsers) {
      pendingUsers.forEach((user: any) => {
        activities.push({
          id: `user-${user.id}`,
          type: 'user_approval',
          title: '새로운 회원가입',
          description: `${user.company_name || user.representative_name} - 승인 대기`,
          timestamp: user.created_at,
          icon: 'user'
        })
      })
    }

    // 3. 재고 부족 상품 (재고 10개 이하, 최신 2건)
    const { data: lowStockProducts } = await supabase
      .from('products')
      .select('id, name, stock_quantity, updated_at')
      .lte('stock_quantity', 10)
      .gt('stock_quantity', 0)
      .order('updated_at', { ascending: false })
      .limit(2)

    if (lowStockProducts) {
      lowStockProducts.forEach((product: any) => {
        activities.push({
          id: `stock-${product.id}`,
          type: 'low_stock',
          title: '재고 부족 알림',
          description: `${product.name} - 재고 ${product.stock_quantity}개 남음`,
          timestamp: product.updated_at,
          icon: 'alert'
        })
      })
    }

    // 시간순으로 정렬하여 최신 10건만 반환
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)

    return NextResponse.json({
      success: true,
      data: {
        activities: sortedActivities
      }
    })

  } catch (error) {
    console.error('어드민 정보 조회 오류:', error)
    return NextResponse.json({
      success: false,
      error: '어드민 정보를 불러오는데 실패했습니다.'
    }, { status: 500 })
  }
} 