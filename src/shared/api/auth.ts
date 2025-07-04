import { User, Admin } from '@/shared/types'

export interface RegisterData {
  email: string
  password: string
  company_name: string
  business_number: string
  representative_name: string
  phone: string
  address: string
  postal_code: string
  recipient_name: string
  recipient_phone: string
}

export interface LoginRequest {
  email: string
  password: string
  userType: 'admin' | 'customer'
}

export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
}

export const authApi = {
  // 회원가입
  register: async (data: RegisterData): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error('회원가입 API 호출 오류:', error)
      return {
        success: false,
        message: '네트워크 오류가 발생했습니다.',
      }
    }
  },

  // 로그인
  login: async (data: LoginRequest): Promise<ApiResponse<User | Admin>> => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error('로그인 API 호출 오류:', error)
      return {
        success: false,
        message: '네트워크 오류가 발생했습니다.',
      }
    }
  },

  // 로그아웃 (클라이언트 사이드)
  logout: () => {
    // 로컬 스토리지나 세션 스토리지에서 토큰 제거
    if (typeof window !== 'undefined') {
      localStorage.removeItem('user')
      localStorage.removeItem('token')
    }
  },
} 