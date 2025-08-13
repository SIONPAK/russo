'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/shared/lib/supabase'

export interface Popup {
  id: string
  title: string
  image_url: string
  mobile_image_url?: string
  width: number
  height: number
  mobile_width?: number
  mobile_height?: number
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
}

export function usePopupDisplay() {
  const [activePopups, setActivePopups] = useState<Popup[]>([])
  const [hiddenPopups, setHiddenPopups] = useState<Set<string>>(new Set())

  // 활성 팝업 조회
  const fetchActivePopups = async () => {
    try {
      const now = new Date().toISOString()
      
      const { data, error } = await supabase
        .from('popups')
        .select('*')
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .order('created_at', { ascending: false })

      if (error) throw error

      // 로컬 스토리지에서 숨김 처리된 팝업 확인
      const hiddenPopupIds = getHiddenPopupIds()
      const visiblePopups = (data || []).filter(popup => !hiddenPopupIds.has(popup.id))
      
      setActivePopups(visiblePopups)
    } catch (error) {
      console.error('팝업 조회 실패:', error)
    }
  }

  // 로컬 스토리지에서 숨김 처리된 팝업 ID들 가져오기
  const getHiddenPopupIds = (): Set<string> => {
    try {
      const hiddenData = localStorage.getItem('hiddenPopups')
      if (!hiddenData) return new Set()

      const parsed = JSON.parse(hiddenData)
      const now = new Date()
      const validHidden = new Set<string>()

      // 만료되지 않은 숨김 기록만 유지
      Object.entries(parsed).forEach(([popupId, hiddenUntil]) => {
        if (new Date(hiddenUntil as string) > now) {
          validHidden.add(popupId)
        }
      })

      // 만료된 기록 제거
      const filteredData: Record<string, string> = {}
      validHidden.forEach(id => {
        filteredData[id] = parsed[id]
      })
      localStorage.setItem('hiddenPopups', JSON.stringify(filteredData))

      return validHidden
    } catch (error) {
      console.error('숨김 팝업 데이터 파싱 실패:', error)
      return new Set()
    }
  }

  // 팝업 숨기기 (오늘 하루 보지 않음)
  const hidePopupForToday = (popupId: string) => {
    try {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0) // 다음날 자정까지

      const hiddenData = localStorage.getItem('hiddenPopups')
      const parsed = hiddenData ? JSON.parse(hiddenData) : {}
      parsed[popupId] = tomorrow.toISOString()
      
      localStorage.setItem('hiddenPopups', JSON.stringify(parsed))
      
      // 현재 표시된 팝업에서 제거
      setActivePopups(prev => prev.filter(popup => popup.id !== popupId))
      setHiddenPopups(prev => new Set([...prev, popupId]))
    } catch (error) {
      console.error('팝업 숨기기 실패:', error)
    }
  }

  // 팝업 닫기 (이번 세션에서만)
  const closePopup = (popupId: string) => {
    setActivePopups(prev => prev.filter(popup => popup.id !== popupId))
  }

  useEffect(() => {
    fetchActivePopups()
  }, [])

  return {
    activePopups,
    hidePopupForToday,
    closePopup,
    refetch: fetchActivePopups
  }
} 