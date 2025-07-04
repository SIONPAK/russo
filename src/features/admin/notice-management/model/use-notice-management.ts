'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/shared/lib/supabase'

export interface Notice {
  id: string
  title: string
  content: string
  is_pinned: boolean
  created_at: string
  updated_at: string
  created_by: string
}

export function useNoticeManagement() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)

  // 공지사항 목록 조회
  const fetchNotices = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('notices')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotices(data || [])
    } catch (error) {
      console.error('공지사항 조회 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  // 공지사항 생성
  const createNotice = async (data: { title: string; content: string; is_pinned?: boolean }) => {
    try {
      const response = await fetch('/api/admin/notices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: data.title,
          content: data.content,
          is_pinned: data.is_pinned || false
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '공지사항 생성에 실패했습니다.')
      }

      await fetchNotices()
    } catch (error) {
      console.error('공지사항 생성 실패:', error)
      throw error
    }
  }

  // 공지사항 수정
  const updateNotice = async (id: string, data: { title: string; content: string; is_pinned?: boolean }) => {
    try {
      const { error } = await supabase
        .from('notices')
        .update({
          title: data.title,
          content: data.content,
          is_pinned: data.is_pinned
        })
        .eq('id', id)

      if (error) throw error
      await fetchNotices()
    } catch (error) {
      console.error('공지사항 수정 실패:', error)
      throw error
    }
  }

  // 공지사항 삭제
  const deleteNotice = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notices')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchNotices()
    } catch (error) {
      console.error('공지사항 삭제 실패:', error)
      throw error
    }
  }

  // 고정/해제 토글
  const togglePin = async (id: string, isPinned: boolean) => {
    try {
      const { error } = await supabase
        .from('notices')
        .update({ is_pinned: isPinned })
        .eq('id', id)

      if (error) throw error
      await fetchNotices()
    } catch (error) {
      console.error('고정 상태 변경 실패:', error)
      throw error
    }
  }

  useEffect(() => {
    fetchNotices()
  }, [])

  return {
    notices,
    loading,
    createNotice,
    updateNotice,
    deleteNotice,
    togglePin,
    refetch: fetchNotices
  }
} 