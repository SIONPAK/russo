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
        console.log('Auth Store - setUser called:', { user, userType })
        set({
          user,
          userType,
          isAuthenticated: true,
          isLoading: false,
        })
      },

      clearUser: () => {
        console.log('Auth Store - clearUser called')
        set({
          user: null,
          userType: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },

      logout: () => {
        console.log('Auth Store - logout called')
        set({
          user: null,
          userType: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },

      setLoading: (isLoading) => {
        console.log('Auth Store - setLoading:', isLoading)
        set({ isLoading })
      },

      updateUser: (userData) => {
        const { user } = get()
        console.log('Auth Store - updateUser called:', { currentUser: user, userData })
        if (user) {
          set({
            user: { ...user, ...userData },
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
    }
  )
) 