'use client'

import { useEffect } from 'react'
import { useAuthStore } from '../model/auth-store'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initializeAuth, user, isAuthenticated, userType } = useAuthStore()

  useEffect(() => {
    console.log('🔥 AuthProvider mounted - forcing auth initialization')
    
    // 디버깅을 위한 전역 함수 추가
    if (typeof window !== 'undefined') {
      (window as any).debugAuth = () => {
        console.log('🔍 Current auth state:', { user, isAuthenticated, userType })
        console.log('🔍 Current cookies:', document.cookie)
        return { user, isAuthenticated, userType, cookies: document.cookie }
      }
      
      (window as any).forceAuthCheck = initializeAuth
    }
    
    // 페이지 로드 즉시 인증 상태 확인
    const checkAuth = async () => {
      try {
        await initializeAuth()
        console.log('✅ Auth initialization completed in AuthProvider')
      } catch (error) {
        console.error('❌ Auth initialization failed in AuthProvider:', error)
      }
    }

    checkAuth()
  }, [initializeAuth, user, isAuthenticated, userType])

  return <>{children}</>
} 