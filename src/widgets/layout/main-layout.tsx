import { ReactNode } from 'react'
import Header from '@/widgets/header/header'
import { Footer } from '@/widgets/footer/footer'
import { PopupDisplay } from '@/features/popup/ui/popup-display'

interface MainLayoutProps {
  children: ReactNode
  showCategoryNav?: boolean
  categoryNavContent?: ReactNode
}

export function MainLayout({ children, showCategoryNav = false, categoryNavContent }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      {/* 카테고리 네비게이션 (선택적) */}
      {showCategoryNav && categoryNavContent && (
        <nav className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4">
            {categoryNavContent}
          </div>
        </nav>
      )}
      
      {/* 메인 컨텐츠 */}
      <main>
        {children}
      </main>
      
      <Footer />
      
      {/* 팝업 표시 */}
      <PopupDisplay />
    </div>
  )
} 