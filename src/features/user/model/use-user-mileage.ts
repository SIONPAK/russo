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
      const response = await fetch(`/api/mileage?userId=${user.id}&limit=1`)
      const result = await response.json()
      
      if (result.success && result.data.summary) {
        setMileageBalance(result.data.summary.currentBalance || 0)
      } else {
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