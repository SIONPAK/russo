import { ReactNode } from 'react'
import Header from '@/widgets/header/header'
import { Footer } from '@/widgets/footer/footer'
import { PopupDisplay } from '@/features/popup/ui/popup-display'
import { AuthProvider } from '@/entities/auth/ui/auth-provider'

interface MainLayoutProps {
  children: ReactNode
  showCategoryNav?: boolean
  categoryNavContent?: ReactNode
}

export function MainLayout({ children, showCategoryNav = false, categoryNavContent }: MainLayoutProps) {
  return (
    <AuthProvider>
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
        <main className='min-h-screen'>
          {children}
        </main>
        
        <Footer />
        
        {/* 팝업 표시 */}
        <PopupDisplay />
      </div>
    </AuthProvider>
  )
} 