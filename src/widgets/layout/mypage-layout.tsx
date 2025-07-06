'use client'

import { ReactNode } from 'react'
import Header from '@/widgets/header/header'
import { Footer } from '@/widgets/footer/footer'
import { MypageSidebar } from './mypage-sidebar'

interface MypageLayoutProps {
  children: ReactNode
}

export function MypageLayout({ children }: MypageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="min-h-screen max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* 사이드바 */}
          <aside className="w-64 flex-shrink-0">
            <MypageSidebar />
          </aside>
          
          {/* 메인 콘텐츠 */}
          <div className="flex-1 min-w-0 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            {children}
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  )
} 