'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Warehouse, 
  ShoppingCart, 
  Coins,
  Home,
  LogOut,
  Grid3X3,
  Megaphone,
  Monitor,
  Star,
  Bell,
  Zap,
  Archive,
  Settings,
  FileText,
  AlertTriangle
} from 'lucide-react';

interface AdminSidebarProps {
  className?: string;
  collapsed?: boolean;
}

const menuItems = [
  {
    title: '대시보드',
    icon: LayoutDashboard,
    href: '/admin',
    children: []
  },
  {
    title: '전체 회원 관리',
    shortTitle: '회원',
    icon: Users,
    href: '/admin/users',
    children: []
  },
  {
    title: '마일리지 관리',
    shortTitle: '마일리지',
    icon: Coins,
    href: '/admin/mileage',
    children: []
  },
  {
    title: '상품 관리',
    shortTitle: '상품',
    icon: Package,
    href: '/admin/products',
    children: []
  },
  {
    title: '재고 관리',
    shortTitle: '재고',
    icon: Warehouse,
    href: '/admin/inventory',
    children: []
  },
  {
    title: '주문 관리',
    shortTitle: '주문',
    icon: ShoppingCart,
    href: '/admin/orders',
    children: []
  },
  {
    title: '📋 출고 명세서 관리',
    shortTitle: '출고',
    icon: Archive,
    href: '/admin/shipping-statements',
    children: []
  },
  {
    title: '🔄 반품 명세서 관리',
    shortTitle: '반품',
    icon: FileText,
    href: '/admin/return-statements',
    children: []
  },
  {
    title: '➖ 차감 명세서 관리',
    shortTitle: '차감',
    icon: AlertTriangle,
    href: '/admin/deduction-statements',
    children: []
  },
  {
    title: '샘플 관리',
    shortTitle: '샘플',
    icon: Package,
    href: '/admin/samples',
    children: []
  },
  {
    title: '공지사항 관리',
    shortTitle: '공지',
    icon: Megaphone,
    href: '/admin/notices',
    children: []
  },
  {
    title: '팝업 관리',
    shortTitle: '팝업',
    icon: Zap,
    href: '/admin/popups',
    children: []
  },
  {
    title: '카테고리 메뉴 관리',
    shortTitle: '카테고리',
    icon: Grid3X3,
    href: '/admin/categories',
    children: []
  }
];

export function AdminSidebar({ className = '', collapsed = false }: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <div className={`${collapsed ? 'w-16' : 'w-64'} flex-shrink-0 h-full transition-all duration-300 ${className}`}>
      <div className="flex flex-col h-full bg-gray-900 text-white">
        {/* 헤더 - 고정 */}
        <div className="flex-shrink-0 p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold">R</span>
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-bold text-lg">LUSSO</h2>
                <p className="text-xs text-gray-400">관리자 시스템</p>
              </div>
            )}
          </div>
        </div>

        {/* 메뉴 - 스크롤 가능 */}
        <nav className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1">
            {menuItems.map((item) => (
              <div key={item.title}>
                <Link
                  href={item.href}
                  className={`flex items-center ${collapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 text-sm rounded-lg transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                  title={collapsed ? item.title : undefined}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.title}</span>}
                </Link>
              </div>
            ))}
          </div>
        </nav>

        {/* 하단 버튼 - 고정 */}
        <div className="flex-shrink-0 p-2 border-t border-gray-700 space-y-1">
          <Link
            href="/"
            className={`flex items-center ${collapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors`}
            title={collapsed ? "홈으로" : undefined}
          >
            <Home className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>홈으로</span>}
          </Link>
          <button
            className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'space-x-3 px-3'} py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors`}
            onClick={() => {
              // 로그아웃 로직
              window.location.href = '/';
            }}
            title={collapsed ? "로그아웃" : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>로그아웃</span>}
          </button>
        </div>
      </div>
    </div>
  );
} 