import { useState, useEffect } from 'react'

export interface Category {
  id: string
  key: string
  name: string
  path: string
  order_index: number
  is_active: boolean
  is_special: boolean
  badge?: string
  text_color?: string
  created_at: string
  updated_at: string
}

interface UseCategoryMenuReturn {
  categories: Category[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useCategoryMenu(): UseCategoryMenuReturn {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategories = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/categories')
      const result = await response.json()

      if (result.success) {
        setCategories(result.data)
      } else {
        setError(result.error || '카테고리를 불러오는데 실패했습니다.')
        setCategories([])
      }
    } catch (err) {
      console.error('Category fetch error:', err)
      setError('카테고리를 불러오는데 실패했습니다.')
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories
  }
} 