'use client'

import { useState, useEffect } from 'react'
import { showSuccess, showError } from '@/shared/lib/toast'

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

export interface BannerFormData {
  title: string
  desktop_image: string
  mobile_image: string
  link_url: string
  order_index: number
  is_active: boolean
}

export function useBannerManagement() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  // 배너 목록 조회
  const fetchBanners = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/banners')
      const result = await response.json()

      if (result.success) {
        setBanners(result.data)
      } else {
        showError(result.error || '배너 목록 조회에 실패했습니다.')
      }
    } catch (error) {
      console.error('배너 목록 조회 오류:', error)
      showError('배너 목록 조회에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 배너 생성
  const createBanner = async (bannerData: BannerFormData) => {
    try {
      setUpdating(true)
      const response = await fetch('/api/admin/banners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bannerData),
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(result.message)
        await fetchBanners()
        return true
      } else {
        showError(result.error || '배너 생성에 실패했습니다.')
        return false
      }
    } catch (error) {
      console.error('배너 생성 오류:', error)
      showError('배너 생성에 실패했습니다.')
      return false
    } finally {
      setUpdating(false)
    }
  }

  // 배너 수정
  const updateBanner = async (id: string, bannerData: BannerFormData) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/admin/banners/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bannerData),
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(result.message)
        await fetchBanners()
        return true
      } else {
        showError(result.error || '배너 수정에 실패했습니다.')
        return false
      }
    } catch (error) {
      console.error('배너 수정 오류:', error)
      showError('배너 수정에 실패했습니다.')
      return false
    } finally {
      setUpdating(false)
    }
  }

  // 배너 삭제
  const deleteBanner = async (id: string) => {
    try {
      setUpdating(true)
      const response = await fetch(`/api/admin/banners/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(result.message)
        await fetchBanners()
        return true
      } else {
        showError(result.error || '배너 삭제에 실패했습니다.')
        return false
      }
    } catch (error) {
      console.error('배너 삭제 오류:', error)
      showError('배너 삭제에 실패했습니다.')
      return false
    } finally {
      setUpdating(false)
    }
  }

  // 배너 활성화/비활성화
  const toggleBannerStatus = async (id: string, isActive: boolean) => {
    try {
      const banner = banners.find(b => b.id === id)
      if (!banner) return false

      return await updateBanner(id, {
        title: banner.title,
        desktop_image: banner.desktop_image,
        mobile_image: banner.mobile_image,
        link_url: banner.link_url || '',
        order_index: banner.order_index,
        is_active: isActive
      })
    } catch (error) {
      console.error('배너 상태 변경 오류:', error)
      showError('배너 상태 변경에 실패했습니다.')
      return false
    }
  }

  // 이미지 업로드
  const uploadImage = async (file: File, type: 'desktop' | 'mobile') => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const response = await fetch('/api/upload/banner-images', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (result.success) {
        return result.data.publicUrl
      } else {
        showError(result.error || '이미지 업로드에 실패했습니다.')
        return null
      }
    } catch (error) {
      console.error('이미지 업로드 오류:', error)
      showError('이미지 업로드에 실패했습니다.')
      return null
    }
  }

  useEffect(() => {
    fetchBanners()
  }, [])

  return {
    banners,
    loading,
    updating,
    fetchBanners,
    createBanner,
    updateBanner,
    deleteBanner,
    toggleBannerStatus,
    uploadImage,
  }
}
