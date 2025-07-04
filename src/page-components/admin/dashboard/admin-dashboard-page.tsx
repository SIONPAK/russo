'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ROUTES } from '@/shared/constants'
import { 
  Users, 
  Package, 
  ShoppingCart, 
  Warehouse, 
  CreditCard,
  Clock,
  AlertTriangle,
  UserCheck
} from 'lucide-react'

interface DashboardStats {
  totalUsers: number
  pendingApprovals: number
  totalProducts: number
  lowStockProducts: number
  todayOrders: number
}

interface RecentActivity {
  id: string
  type: 'order' | 'user_approval' | 'low_stock'
  title: string
  description: string
  timestamp: string
  icon: 'order' | 'user' | 'alert'
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    pendingApprovals: 0,
    totalProducts: 0,
    lowStockProducts: 0,
    todayOrders: 0,
  })
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      
      // 통계 데이터 조회
      const [usersRes, productsRes, ordersRes, activitiesRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/products'),
        fetch('/api/admin/orders'),
        fetch('/api/admin/info')
      ])

      // 사용자 통계
      if (usersRes.ok) {
        const usersData = await usersRes.json()
        if (usersData.success) {
          const users = usersData.data || []
          const totalUsers = users.length
          const pendingApprovals = users.filter((user: any) => user.approval_status === 'pending').length
          setStats(prev => ({ ...prev, totalUsers, pendingApprovals }))
        }
      }

      // 상품 통계
      if (productsRes.ok) {
        const productsData = await productsRes.json()
        if (productsData.success) {
          const products = productsData.data || []
          const totalProducts = products.length
          const lowStockProducts = products.filter((product: any) => product.stock_quantity <= 10).length
          setStats(prev => ({ ...prev, totalProducts, lowStockProducts }))
        }
      }

      // 주문 통계 (오늘 주문)
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json()
        if (ordersData.success) {
          const orders = ordersData.data?.orders || []
          const today = new Date().toISOString().split('T')[0]
          const todayOrders = orders.filter((order: any) => 
            order.created_at.startsWith(today)
          ).length
          setStats(prev => ({ ...prev, todayOrders }))
        }
      }

      // 최근 활동 조회
      if (activitiesRes.ok) {
        const activitiesData = await activitiesRes.json()
        if (activitiesData.success) {
          setRecentActivities(activitiesData.data?.activities || [])
        }
      }

    } catch (error) {
      console.error('대시보드 데이터 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  const menuItems = [
    {
      title: '회원 관리',
      description: '전체 회원 관리 및 승인 처리',
      href: ROUTES.admin.users,
      icon: Users,
      color: 'bg-blue-500',
      stats: `${stats.totalUsers}명 가입, ${stats.pendingApprovals}건 대기`
    },
    {
      title: '상품 관리',
      description: '상품 등록 및 정보 관리',
      href: ROUTES.admin.products,
      icon: Package,
      color: 'bg-green-500',
      stats: `${stats.totalProducts}개 상품 등록`
    },
    {
      title: '재고 관리',
      description: '상품 입고/출고 및 재고 조회',
      href: ROUTES.admin.inventory,
      icon: Warehouse,
      color: 'bg-yellow-500',
      stats: `${stats.lowStockProducts}개 상품 재고 부족`
    },
    {
      title: '주문 관리',
      description: '주문 처리 및 배송 관리',
      href: ROUTES.admin.orders,
      icon: ShoppingCart,
      color: 'bg-purple-500',
      stats: `오늘 ${stats.todayOrders}건 주문`
    },
    {
      title: '마일리지 관리',
      description: '마일리지 적립/차감 관리',
      href: ROUTES.admin.mileage,
      icon: CreditCard,
      color: 'bg-red-500',
      stats: '적립/차감 내역 관리'
    },
  ]

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <ShoppingCart className="h-5 w-5 text-green-600" />
      case 'user_approval':
        return <UserCheck className="h-5 w-5 text-blue-600" />
      case 'low_stock':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return '방금 전'
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}시간 전`
    return `${Math.floor(diffInMinutes / 1440)}일 전`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      {/* 요약 통계 (월 매출 카드 제거) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">총 회원수</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}명</p>
              <p className="text-sm text-orange-600">{stats.pendingApprovals}건 승인 대기</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <ShoppingCart className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">오늘 주문</p>
              <p className="text-2xl font-bold text-gray-900">{stats.todayOrders.toLocaleString()}건</p>
              <p className="text-sm text-green-600">실시간 주문 현황</p>
            </div>
          </div>
        </div>
      </div>

      {/* 메뉴 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item) => {
          const Icon = item.icon
          return (
            <Link key={item.href} href={item.href}>
              <div className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 hover:border-gray-300">
                <div className="flex items-start">
                  <div className={`p-3 rounded-lg ${item.color}`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3">
                      {item.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.stats}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* 최근 활동 */}
      <div className="mt-8 bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">최근 활동</h2>
        </div>
        <div className="p-6">
          {recentActivities.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">최근 활동이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center">
                    <div className="mr-3">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-600">{activity.description}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatTimeAgo(activity.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 