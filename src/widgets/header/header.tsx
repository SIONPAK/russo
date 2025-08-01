'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { useCategoryMenu } from '@/features/category-menu/model/use-category-menu'
import { useUserMileage } from '@/features/user/model/use-user-mileage'
import { Button } from '@/shared/ui/button'
import { 
  User, 
  Search,
  Menu,
  X,
  ChevronDown,
  UserCircle,
  Package,
  CreditCard,
  FileText,
  MapPin,
  Award,
  Settings,
  LogOut,
  Bell,
  ClipboardList
} from 'lucide-react'

export default function Header() {
  const { user, isAuthenticated, logout, userType } = useAuthStore()
  const { categories } = useCategoryMenu()
  const { mileageBalance } = useUserMileage()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 사용자 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    setIsUserMenuOpen(false)
    router.push('/')
  }

  const handleCategoryClick = (categoryKey: string) => {
    router.push(`/products?category=${categoryKey}`)
    setIsMobileMenuOpen(false)
  }

  const handleUserMenuClick = () => {
    if (!isAuthenticated) {
      router.push('/auth/login')
    } else if (userType === 'admin') {
      // 어드민은 바로 관리자 화면으로 이동
      router.push('/admin')
    } else {
      setIsUserMenuOpen(!isUserMenuOpen)
    }
  }

  const handleMenuItemClick = (path: string) => {
    router.push(path)
    setIsUserMenuOpen(false)
  }

  // 사용자 표시명 가져오기
  const getUserDisplayName = () => {
    if (!user) return ''
    
    if (userType === 'customer') {
      const customerUser = user as any
      return customerUser.companyName || customerUser.company_name || customerUser.email
    } else if (userType === 'admin') {
      const adminUser = user as any
      return adminUser.username || adminUser.email
    }
    
    return user.email
  }

  // 마이페이지 메뉴 항목들
  const mypageMenuItems = [
    {
      icon: UserCircle,
      label: '프로필 관리',
      path: '/mypage/profile',
      description: '회원정보 수정'
    },
    {
      icon: Package,
      label: '주문 내역',
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
      description:'거래명세서, 세금계산서 등'
    }
  ]

  if (!mounted) {
    return (
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="text-2xl font-bold text-black">
              LUSSO
            </Link>
          </div>
        </div>
      </header>
    )
  }

  return (
    <>
      {/* 상단 유틸리티 바 */}
      <div className="bg-black border-b border-gray-800 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-10">
            <div className="flex items-center space-x-4 text-gray-300">
              <Link href="/community" className="hover:text-white transition-colors">
                커뮤니티
              </Link>
            </div>
            
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <div className="flex items-center space-x-3 text-gray-300 align-baseline">
                  <span className="font-medium text-white">
                    {getUserDisplayName()}
                  </span>
                  {userType === 'customer' && (
                    <span className={`text-sm ${mileageBalance < 0 ? 'text-red-400' : 'text-blue-300'}`}>
                      {mileageBalance < 0 ? '-' : ''}{new Intl.NumberFormat('ko-KR').format(Math.abs(mileageBalance))}원
                    </span>
                  )}
                  <button
                    onClick={handleLogout}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-3 text-gray-300">
                  <Link href="/auth/login" className="hover:text-white transition-colors">
                    로그인
                  </Link>
                  <span className="text-gray-600">|</span>
                  <Link href="/auth/register" className="hover:text-white transition-colors">
                    회원가입
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 메인 헤더 */}
      <header className="bg-white shadow-lg sticky top-0 z-40 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* 로고 */}
            <div className="flex-shrink-0 min-w-[120px]">
              <Link href="/" className="text-2xl font-paperlogy-extrabold text-black">
                LUSSO
              </Link>
            </div>

            {/* 메인 네비게이션 */}
            <div className="flex-1 flex justify-center">
              <nav className="hidden md:flex items-center space-x-8 min-w-[200px] justify-center">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      if (!isAuthenticated) {
                        router.push('/auth/login')
                        return
                      }
                      handleCategoryClick(category.key)
                    }}
                    className="text-base font-medium text-gray-900 hover:text-black transition-colors relative whitespace-nowrap hover:cursor-pointer"
                  >
                    {category.badge && (
                      <span className="bg-black text-white px-1.5 py-0.5 rounded text-xs mr-1">
                        {category.badge}
                      </span>
                    )}
                    {category.name.toUpperCase()}
                    {category.key === 'new' || category.key === 'womans' ? (
                      <span className="text-black text-xs absolute -top-1 -right-2">*</span>
                    ) : null}
                  </button>
                ))}
              </nav>
            </div>

            {/* 우측 액션 버튼들 */}
            <div className="flex items-center space-x-3 flex-shrink-0 min-w-[120px] justify-end">
              {/* 사용자 메뉴 - 데스크톱만 표시 */}
              <div className="relative hidden md:block" ref={userMenuRef}>
                <button 
                  onClick={handleUserMenuClick}
                  className="flex items-center p-2 text-gray-700 hover:text-black transition-colors"
                >
                  {userType === 'admin' ? (
                    <Settings className="h-5 w-5" />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                  {isAuthenticated && userType === 'customer' && (
                    <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {/* 사용자 드롭다운 메뉴 */}
                {isAuthenticated && isUserMenuOpen && userType === 'customer' && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                    {/* 사용자 정보 헤더 */}
                    <div className="px-4 py-3 border-b border-gray-100 bg-black">
                      <div className="text-sm font-medium text-white">
                        {getUserDisplayName()}
                      </div>
                      <div className="text-xs text-gray-300 mt-1">
                        {userType === 'customer' ? '일반 회원' : '관리자'}
                      </div>
                    </div>

                    {/* 메뉴 항목들 */}
                    <div className="py-2">
                      {mypageMenuItems.map((item) => {
                        const IconComponent = item.icon
                        return (
                          <button
                            key={item.path}
                            onClick={() => handleMenuItemClick(item.path)}
                            className="w-full px-4 py-3 text-left hover:bg-gray-100 transition-colors flex items-center"
                          >
                            <IconComponent className="h-4 w-4 text-gray-600 mr-3" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {item.label}
                              </div>
                              <div className="text-xs text-gray-500">
                                {item.description}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* 로그아웃 */}
                    <div className="border-t border-gray-100 pt-2">
                      <button
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 hover:text-black transition-colors"
                      >
                        로그아웃
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 검색 버튼 - 데스크톱만 표시 */}
              <button 
                onClick={() => router.push('/products')}
                className="hidden md:block p-2 text-gray-700 hover:text-black transition-colors"
              >
                <Search className="h-5 w-5" />
              </button>

              {/* 모바일 메뉴 버튼 */}
              <button
                className="block md:hidden p-2 text-gray-700 hover:text-black transition-colors border border-gray-300 rounded"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              {/* B2B 발주관리 메뉴 (관리자가 아닐 때만) - 데스크톱만 표시 */}
              {isAuthenticated && userType === 'customer' && (
                <Link
                  href="/order-management"
                  className="hidden md:flex items-center space-x-1 px-2 lg:px-3 py-2 text-xs lg:text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  <ClipboardList className="h-3 w-3 lg:h-4 lg:w-4" color='white'/>
                  <span className='text-white'>발주관리</span>
                </Link>
              )}
            </div>
          </div>

          {/* 모바일 메뉴 */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 py-4">
              <nav className="grid grid-cols-2 gap-4">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => {
                      if (!isAuthenticated) {
                        router.push('/auth/login')
                        return
                      }
                      handleCategoryClick(category.key)
                    }}
                    className={`text-sm font-medium transition-colors ${
                      category.is_special 
                        ? 'text-red-600 hover:text-red-700' 
                        : 'text-gray-900 hover:text-blue-600'
                    } ${category.key === 'sale' ? 'col-span-2' : ''}`}
                    style={category.text_color ? { color: category.text_color } : {}}
                  >
                    {category.badge && `${category.badge} `}
                    {category.name.toUpperCase()}
                    {(category.key === 'new' || category.key === 'womans') && ' *'}
                  </button>
                ))}
              </nav>
              
              {/* 모바일 사용자 메뉴 */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                {isAuthenticated ? (
                  <div className="space-y-4">
                    <div className="text-sm font-medium text-gray-900 mb-4">
                      {getUserDisplayName()}
                    </div>
                    
                    {userType === 'admin' ? (
                      <Link
                        href="/admin"
                        className="block text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        관리자 화면
                      </Link>
                    ) : (
                      /* 모바일 마이페이지 메뉴 */
                      <div className="space-y-3">
                        {/* B2B 발주관리 메뉴 (관리자가 아닐 때만) - 최상단 배치 */}
                        {isAuthenticated && userType === 'customer' && (
                          <Link
                            href="/order-management"
                            className="flex items-center text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors bg-blue-50 px-3 py-2 rounded-md border border-blue-200"
                            onClick={() => setIsMobileMenuOpen(false)}
                          >
                            <ClipboardList className="h-4 w-4 mr-2" />
                            발주관리
                          </Link>
                        )}
                        
                        {mypageMenuItems.map((item) => {
                          const IconComponent = item.icon
                          return (
                            <Link
                              key={item.path}
                              href={item.path}
                              className="flex items-center text-sm text-gray-600 hover:text-black transition-colors"
                              onClick={() => setIsMobileMenuOpen(false)}
                            >
                              <IconComponent className="h-4 w-4 mr-2" />
                              {item.label}
                            </Link>
                          )
                        })}
                      </div>
                    )}
                    
                    <button
                      onClick={async () => {
                        await handleLogout()
                        setIsMobileMenuOpen(false)
                      }}
                      className="text-sm text-red-600 hover:text-red-700 transition-colors"
                    >
                      로그아웃
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Link 
                      href="/auth/login"
                      className="block text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      로그인
                    </Link>
                    <Link 
                      href="/auth/register"
                      className="block text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      회원가입
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>
    </>
  )
} 