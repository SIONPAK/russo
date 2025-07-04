'use client'

import { useState, useEffect } from 'react'

export interface Banner {
  id: string
  title: string
  desktop_image: string
  mobile_image: string
  link_url: string | null
  order_index: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export function useBanners() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)

  // 활성화된 배너 목록 조회
  const fetchActiveBanners = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/banners')
      const result = await response.json()

      if (result.success) {
        setBanners(result.data)
      } else {
        console.error('배너 조회 실패:', result.error)
      }
    } catch (error) {
      console.error('배너 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActiveBanners()
  }, [])

  return {
    banners,
    loading,
    fetchActiveBanners,
  }
}
