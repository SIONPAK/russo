'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  User, 
  Package, 
  Award, 
  FileText,
  MapPin
} from 'lucide-react'

export function MypageSidebar() {
  const pathname = usePathname()

  const menuItems = [
    {
      icon: User,
      label: '회원정보',
      path: '/mypage/profile',
      description: '프로필 관리'
    },
    {
      icon: Package,
      label: '주문내역 조회',
      path: '/mypage/orders',
      description: '주문 조회 및 관리'
    },
    {
      icon: MapPin,
      label: '배송지 관리',
      path: '/mypage/shipping-addresses',
      description: '배송지 추가 및 관리'
    },
    {
      icon: Award,
      label: '마일리지',
      path: '/mypage/mileage',
      description: '적립금 조회'
    },
    {
      icon: FileText,
      label: '서류 관리',
      path: '/mypage/documents',
      description: '거래명세서, 세금계산서 등'
    }
  ]

  const isActive = (path: string) => pathname === path

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-6 py-4 bg-black border-b border-gray-200">
        <h2 className="text-lg font-semibold text-white">마이페이지</h2>
        <p className="text-sm text-gray-300 mt-1">계정 관리 및 주문 내역</p>
      </div>
      
      {/* 메뉴 */}
      <nav className="">
        <ul>
          {menuItems.map((item, index) => {
            const Icon = item.icon
            const active = isActive(item.path)
            
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`flex items-center px-6 py-3 text-sm transition-all duration-200 relative ${
                    active
                      ? 'bg-black text-white font-medium'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-black'
                  }`}
                  style={{
                    borderRight: active ? '3px solid #000000' : '3px solid transparent'
                  }}
                >
                  <Icon className={`h-5 w-5 mr-4 flex-shrink-0 ${active ? 'text-white' : 'text-gray-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${active ? 'text-gray-300' : 'text-gray-500'}`}>{item.label}</div>
                    <div className={`text-xs mt-0.5 truncate ${active ? 'text-gray-300' : 'text-gray-500'}`}>{item.description}</div>
                  </div>
                </Link>
                {/* 구분선 (마지막 아이템 제외) */}
                {index < menuItems.length - 1 && (
                  <div className="mx-6 border-b border-gray-100"></div>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
