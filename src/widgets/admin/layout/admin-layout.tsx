'use client';

import { AdminSidebar } from './admin-sidebar';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/entities/auth/model/auth-store';
import { AuthProvider } from '@/entities/auth/ui/auth-provider';
import { Menu, X } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const router = useRouter();
  const { user, userType, isAuthenticated, initializeAuth } = useAuthStore();

  useEffect(() => {
    const checkAdminAuth = async () => {
      console.log('Admin Layout - Starting auth check...');
      
      // AuthProvider가 초기화를 완료할 시간을 주기 위해 잠시 대기
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 인증 상태가 불확실한 경우 강제로 초기화
      if (!isAuthenticated || !user) {
        console.log('Admin Layout - Auth state unclear, forcing initialization...');
        try {
          await initializeAuth();
        } catch (error) {
          console.error('Admin Layout - Auth initialization failed:', error);
        }
      }
      
      // 재확인을 위해 최신 상태 가져오기
      const currentState = useAuthStore.getState();
      const currentUser = currentState.user;
      const currentAuthenticated = currentState.isAuthenticated;
      
      console.log('Admin Layout - Final auth state:', { 
        user: currentUser, 
        isAuthenticated: currentAuthenticated 
      });
      
      // user_id가 "admin"인지 확인
      const userId = (currentUser as any)?.user_id || (currentUser as any)?.username;
      console.log('Admin Layout - User ID:', userId);
      
      if (!currentAuthenticated || !currentUser) {
        console.log('Admin Layout - Not authenticated, redirecting to login');
        router.push('/auth/login');
        return;
      }

      // user_id가 "admin"이 아니면 튕겨버림
      if (userId !== 'admin') {
        console.log('Admin Layout - Access denied for user_id:', userId);
        router.push('/');
        return;
      }

      console.log('Admin Layout - Access granted for admin user');
      setIsAuthorized(true);
      setIsLoading(false);
    };

    checkAdminAuth();
  }, [router, initializeAuth]);

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="text-gray-600">관리자 권한 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">접근 권한이 없습니다</h1>
          <p className="text-gray-600 mb-6">관리자만 접근할 수 있는 페이지입니다.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            메인 페이지로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <div className="h-screen bg-gray-50 flex overflow-hidden">
        {/* 사이드바 */}
        <AdminSidebar collapsed={sidebarCollapsed} />
        
        {/* 메인 컨텐츠 영역 */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          {/* 상단 헤더 바 */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* 사이드바 토글 버튼 */}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {sidebarCollapsed ? (
                  <Menu className="h-5 w-5 text-gray-600" />
                ) : (
                  <X className="h-5 w-5 text-gray-600" />
                )}
              </button>
              
              {/* 페이지 제목 */}
              {title && (
                <h1 className="text-xl font-bold text-gray-900">
                  {title}
                </h1>
              )}
            </div>
            
            {/* 우측 메뉴 (필요시 추가) */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">관리자</span>
            </div>
          </div>
          
          {/* 페이지 컨텐츠 */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* 페이지 설명 */}
            {description && (
              <div className="mb-6">
                <p className="text-gray-600">
                  {description}
                </p>
              </div>
            )}
            
            {/* 메인 컨텐츠 */}
            {children}
          </div>
        </div>
      </div>
    </AuthProvider>
  );
}
