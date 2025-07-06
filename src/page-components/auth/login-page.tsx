'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { ArrowLeft, Home, CheckCircle, Package, Shield } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const { setUser } = useAuthStore()
  const [formData, setFormData] = useState({
    userId: '',
    password: '',
    businessNumber: '',
    rememberMe: false,
    saveId: false
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // 실제 로그인 API 호출
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: formData.userId,
          password: formData.password
        }),
      })

      const result = await response.json()

      if (result.success) {
        const userData = result.data
        
        if (userData.userType === 'admin') {
          setUser(userData, 'admin')
          router.push('/admin')
        } else {
          setUser(userData, 'customer')
          router.push('/')
        }
      } else {
        alert(result.message)
      }
    } catch (error) {
      console.error('로그인 실패:', error)
      alert('로그인에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.back()} className="p-2">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">로그인</h1>
          <button onClick={() => router.push('/')} className="p-2">
            <Home className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-8">
        {/* 사업자 회원 안내 섹션 */}
        <div className="bg-white rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">루소 전용 ERP프로그램 입니다.</p>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                루소 로그인
              </h2>
            </div>
            <div className="w-20 h-20 bg-blue-100 rounded-xl flex items-center justify-center">
              <div className="relative">
                <CheckCircle className="w-8 h-8 text-green-500 absolute -top-1 -right-1" />
                <Package className="w-10 h-10 text-blue-500" />
                <Shield className="w-6 h-6 text-yellow-500 absolute -bottom-1 -left-1" />
              </div>
            </div>
          </div>
          

        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="아이디"
              value={formData.userId}
              onChange={(e) => handleInputChange('userId', e.target.value)}
              className="w-full h-12 text-base"
              required
            />
          </div>
          <div>
            <Input
              type="password"
              placeholder="패스워드"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              className="w-full h-12 text-base"
              required
            />
          </div>

          {/* 체크박스 옵션 */}
          <div className="flex items-center justify-between py-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.rememberMe}
                onChange={(e) => handleInputChange('rememberMe', e.target.checked)}
                className="w-5 h-5 text-red-500 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">보안접속</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.saveId}
                onChange={(e) => handleInputChange('saveId', e.target.checked)}
                className="w-5 h-5 text-gray-400 border-gray-300 rounded focus:ring-gray-500"
              />
              <span className="text-sm text-gray-700">아이디 저장</span>
            </label>
          </div>

          {/* 로그인 버튼 */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-black text-white text-base font-medium rounded-lg hover:bg-gray-800 disabled:opacity-70"
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </Button>

          {/* 하단 링크 */}
          <div className="flex justify-center space-x-4 pt-4 text-sm text-gray-600">
            <Link href="/auth/register" className="hover:text-gray-900">
              회원가입
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
} 