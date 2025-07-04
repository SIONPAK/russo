'use client';

import { AdminSidebar } from './admin-sidebar';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/entities/auth/model/auth-store';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();
  const { user, userType, isAuthenticated } = useAuthStore();

  useEffect(() => {
    console.log('Admin Layout - Auth Store State:', { user, userType, isAuthenticated });
    
    // user_id가 "admin"인지 확인
    const userId = (user as any)?.user_id || (user as any)?.username;
    console.log('Admin Layout - User ID:', userId);
    
    if (!isAuthenticated || !user) {
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
  }, [user, userType, isAuthenticated, router]);

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
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* 사이드바 */}
      <AdminSidebar />
      
      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 flex flex-col h-full">
        <div className="flex-1 p-6 overflow-y-auto">
          {/* 페이지 헤더 */}
          {(title || description) && (
            <div className="mb-6">
              {title && (
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {title}
                </h1>
              )}
              {description && (
                <p className="text-gray-600">
                  {description}
                </p>
              )}
            </div>
          )}
          
          {/* 페이지 컨텐츠 */}
          {children}
        </div>
      </div>
    </div>
  );
}
