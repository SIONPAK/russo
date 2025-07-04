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

export function useNotices() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)

  // 공지사항 목록 조회 (사용자용)
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

  useEffect(() => {
    fetchNotices()
  }, [])

  return {
    notices,
    loading,
    refetch: fetchNotices
  }
} 