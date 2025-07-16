'use client'

import { useState, useEffect } from 'react'

interface CompanyTotalPoints {
  company_name: string
  representative_name: string
  total_points: number
  total_earned: number
  total_spent: number
  user_count: number
}

export function useTotalPoints() {
  const [totalPoints, setTotalPoints] = useState<CompanyTotalPoints[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTotalPoints = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/mileage/total-points')
      const result = await response.json()

      if (result.success) {
        setTotalPoints(result.data)
      } else {
        setError(result.error || '데이터를 불러오는데 실패했습니다.')
      }
    } catch (err) {
      console.error('총 포인트 조회 오류:', err)
      setError('데이터를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTotalPoints()
  }, [])

  const refresh = () => {
    fetchTotalPoints()
  }

  return {
    totalPoints,
    loading,
    error,
    refresh
  }
} 