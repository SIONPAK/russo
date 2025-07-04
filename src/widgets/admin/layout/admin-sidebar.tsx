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
  BarChart3,
  Settings,
  FileText
} from 'lucide-react';

interface AdminSidebarProps {
  className?: string;
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
    icon: Users,
    href: '/admin/users',
    children: []
  },
  {
    title: '마일리지 관리',
    icon: Coins,
    href: '/admin/mileage',
    children: []
  },
  {
    title: '상품 관리',
    icon: Package,
    href: '/admin/products',
    children: []
  },
  {
    title: '재고 관리',
    icon: Warehouse,
    href: '/admin/inventory',
    children: []
  },
  {
    title: '주문 관리',
    icon: ShoppingCart,
    href: '/admin/orders',
    children: []
  },
  {
    title: '샘플 관리',
    icon: Package,
    href: '/admin/samples',
    children: []
  },
  {
    title: '공지사항 관리',
    icon: Megaphone,
    href: '/admin/notices',
    children: []
  },
  {
    title: '팝업 관리',
    icon: Zap,
    href: '/admin/popups',
    children: []
  },
  {
    title: '카테고리 메뉴 관리',
    icon: Grid3X3,
    href: '/admin/categories',
    children: []
  },
  {
    title: '배너 관리',
    icon: Monitor,
    href: '/admin/banners',
    children: []
  },
  {
    title: '문서 관리',
    icon: FileText,
    href: '/admin/documents',
    children: []
  }
];

export function AdminSidebar({ className = '' }: AdminSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <div className={`w-64 flex-shrink-0 h-full ${className}`}>
      <div className="flex flex-col h-full bg-gray-900 text-white">
        {/* 헤더 - 고정 */}
        <div className="flex-shrink-0 p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold">R</span>
            </div>
            <div>
              <h2 className="font-bold text-lg">LUSSO</h2>
              <p className="text-xs text-gray-400">관리자 시스템</p>
            </div>
          </div>
        </div>

        {/* 메뉴 - 스크롤 가능 */}
        <nav className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-2">
            {menuItems.map((item) => (
              <div key={item.title}>
                <Link
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    isActive(item.href)
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.title}</span>
                </Link>
              </div>
            ))}
          </div>
        </nav>

        {/* 하단 버튼 - 고정 */}
        <div className="flex-shrink-0 p-4 border-t border-gray-700 space-y-2">
          <Link
            href="/"
            className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Home className="w-5 h-5" />
            <span>홈으로</span>
          </Link>
          <button
            className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
            onClick={() => {
              // 로그아웃 로직
              window.location.href = '/';
            }}
          >
            <LogOut className="w-5 h-5" />
            <span>로그아웃</span>
          </button>
        </div>
      </div>
    </div>
  );
} 