import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, Admin } from '@/shared/types'

interface AuthState {
  // 상태
  user: User | Admin | null
  isAuthenticated: boolean
  isLoading: boolean
  userType: 'customer' | 'admin' | null
  
  // 액션
  setUser: (user: User | Admin, userType: 'customer' | 'admin') => void
  clearUser: () => void
  logout: () => void
  setLoading: (isLoading: boolean) => void
  updateUser: (userData: Partial<User | Admin>) => void
  initializeAuth: () => Promise<void>
}

// 쿠키에서 값 읽기 헬퍼 함수
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') {
  
    return null
  }
  
  
  const value = `; ${document.cookie}`
  const parts = value.split(`; ${name}=`)
  
  
  if (parts.length === 2) {
    const result = parts.pop()?.split(';').shift() || null
  
    return result
  }
  
  return null
}

// 쿠키 삭제 헬퍼 함수
const deleteCookie = (name: string) => {
  if (typeof document === 'undefined') return
  
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 초기 상태
      user: null,
      isAuthenticated: false,
      isLoading: false,
      userType: null,

      // 액션들
      setUser: (user, userType) => {
        
        set({
          user,
          userType,
          isAuthenticated: true,
          isLoading: false,
        })
      },

      clearUser: () => {
        
        set({
          user: null,
          userType: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },

      logout: async () => {
        
        
        try {
          // 서버 로그아웃 API 호출
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include',
          })
        } catch (error) {
          console.error('Logout API error:', error)
        }
        
        // 클라이언트 쿠키 삭제
        deleteCookie('user_id')
        deleteCookie('user_type')
        
        set({
          user: null,
          userType: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },

      setLoading: (isLoading) => {
  
        set({ isLoading })
      },

      updateUser: (userData) => {
        const { user } = get()
        if (user) {
          set({
            user: { ...user, ...userData },
          })
        }
      },

      // 쿠키 기반 로그인 상태 초기화
      initializeAuth: async () => {
        
        set({ isLoading: true })

        try {
          const userId = getCookie('user_id')
          const userType = getCookie('user_type')

          

          if (!userId || !userType) {
            
            set({
              user: null,
              userType: null,
              isAuthenticated: false,
              isLoading: false,
            })
            return
          }

          

          // 이미 로그인 상태인 경우 쿠키와 동기화 확인
          const { user: currentUser, userType: currentUserType } = get()
          if (currentUser && currentUserType === userType) {
            
            set({ isLoading: false })
            return
          }

          // 서버에서 사용자 정보 조회
          const response = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'include',
          })

          if (response.ok) {
            const result = await response.json()
            if (result.success && result.data) {
              
              set({
                user: result.data,
                userType: userType as 'customer' | 'admin',
                isAuthenticated: true,
                isLoading: false,
              })
              return
            }
          }

          // 서버에서 사용자 정보를 가져올 수 없는 경우 쿠키 삭제 및 로그아웃
          
          deleteCookie('user_id')
          deleteCookie('user_type')
          
          set({
            user: null,
            userType: null,
            isAuthenticated: false,
            isLoading: false,
          })

        } catch (error) {
          console.error('Auth initialization error:', error)
          
          // 오류 발생 시 쿠키 삭제 및 로그아웃
          deleteCookie('user_id')
          deleteCookie('user_type')
          
          set({
            user: null,
            userType: null,
            isAuthenticated: false,
            isLoading: false,
          })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        userType: state.userType,
        isAuthenticated: state.isAuthenticated,
      }),
      // 스토리지에서 복원 후 쿠키와 동기화 (AuthProvider가 이미 초기화했으므로 건너뛰기)
      onRehydrateStorage: () => (state) => {

        // AuthProvider에서 이미 초기화를 하므로 여기서는 하지 않음
        return state
      },
    }
  )
) 