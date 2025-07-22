'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/entities/auth/model/auth-store'

export function useUserMileage() {
  const { user, isAuthenticated, userType } = useAuthStore()
  const [mileageBalance, setMileageBalance] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchMileageBalance = async () => {
    // 관리자는 마일리지가 없음
    if (!isAuthenticated || !user?.id || userType !== 'customer') {
      setMileageBalance(0)
      return
    }

    setLoading(true)
    try {
      // 캐시 방지를 위해 타임스탬프 추가
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/mileage?userId=${user.id}&limit=1&_t=${timestamp}`)
      const result = await response.json()
      
      console.log('🔍 헤더 마일리지 API 응답:', result.data?.summary)
      
      if (result.success && result.data.summary) {
        const balance = result.data.summary.currentBalance || 0
        console.log('🔍 헤더 마일리지 설정:', balance)
        setMileageBalance(balance)
      } else {
        console.log('🔍 헤더 마일리지 API 실패 또는 데이터 없음')
        setMileageBalance(0)
      }
    } catch (error) {
      console.error('마일리지 조회 실패:', error)
      setMileageBalance(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMileageBalance()
  }, [user?.id, isAuthenticated, userType])

  return {
    mileageBalance,
    loading,
    refreshMileage: fetchMileageBalance
  }
} 