'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/shared/lib/supabase'

export interface Popup {
  id: string
  title: string
  image_url: string
  width: number
  height: number
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export function usePopupManagement() {
  const [popups, setPopups] = useState<Popup[]>([])
  const [loading, setLoading] = useState(true)

  // 팝업 목록 조회
  const fetchPopups = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/popups')
      if (!response.ok) throw new Error('팝업 조회 실패')
      
      const data = await response.json()
      setPopups(data || [])
    } catch (error) {
      console.error('팝업 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  // 팝업 생성
  const createPopup = async (data: {
    title: string
    image_url: string
    width: number
    height: number
    start_date: string
    end_date: string
    is_active?: boolean
  }) => {
    try {
      const response = await fetch('/api/admin/popups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: data.title,
          image_url: data.image_url,
          width: data.width,
          height: data.height,
          start_date: data.start_date,
          end_date: data.end_date,
          is_active: data.is_active || true,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '팝업 생성 실패')
      }

      await fetchPopups()
    } catch (error) {
      console.error('팝업 생성 실패:', error)
      throw error
    }
  }

  // 팝업 수정
  const updatePopup = async (id: string, data: {
    title: string
    image_url: string
    width: number
    height: number
    start_date: string
    end_date: string
    is_active?: boolean
  }) => {
    try {
      const response = await fetch(`/api/admin/popups/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: data.title,
          image_url: data.image_url,
          width: data.width,
          height: data.height,
          start_date: data.start_date,
          end_date: data.end_date,
          is_active: data.is_active
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '팝업 수정 실패')
      }

      await fetchPopups()
    } catch (error) {
      console.error('팝업 수정 실패:', error)
      throw error
    }
  }

  // 팝업 삭제
  const deletePopup = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/popups/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '팝업 삭제 실패')
      }

      await fetchPopups()
    } catch (error) {
      console.error('팝업 삭제 실패:', error)
      throw error
    }
  }

  // 활성/비활성 토글
  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const popup = popups.find(p => p.id === id)
      if (!popup) throw new Error('팝업을 찾을 수 없습니다.')

      const response = await fetch(`/api/admin/popups/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: popup.title,
          image_url: popup.image_url,
          width: popup.width,
          height: popup.height,
          start_date: popup.start_date,
          end_date: popup.end_date,
          is_active: isActive
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '활성 상태 변경 실패')
      }

      await fetchPopups()
    } catch (error) {
      console.error('활성 상태 변경 실패:', error)
      throw error
    }
  }

  // 이미지 업로드
  const uploadImage = async (file: File): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('popup-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('popup-images')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (error) {
      console.error('이미지 업로드 실패:', error)
      throw error
    }
  }

  useEffect(() => {
    fetchPopups()
  }, [])

  return {
    popups,
    loading,
    createPopup,
    updatePopup,
    deletePopup,
    toggleActive,
    uploadImage,
    refetch: fetchPopups
  }
} 