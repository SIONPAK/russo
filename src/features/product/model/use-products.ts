'use client'

import { useState, useEffect, useCallback } from 'react'
import { Product, Category } from '@/shared/types'

interface ProductFilters {
  search?: string
  category?: string
  filter?: 'new' | 'sale' | 'featured' | ''
  sortBy?: string
  page?: number
  limit?: number
}

interface UseProductsReturn {
  products: Product[]
  categories: Category[]
  loading: boolean
  error: string | null
  filters: ProductFilters
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  setFilters: (filters: ProductFilters | ((prev: ProductFilters) => ProductFilters)) => void
  setPage: (page: number) => void
  setSortBy: (sortBy: string) => void
  refetch: () => void
}

export function useProducts(): UseProductsReturn {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<ProductFilters>({
    search: '',
    category: '',
    filter: '',
    sortBy: 'created_at_desc',
    page: 1,
    limit: 20
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // 카테고리 목록 조회
  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/categories')
      const data = await response.json()
      
      if (data.success) {
        setCategories(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }, [])

  // 상품 목록 조회
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)

    const queryParams = new URLSearchParams()
    
    if (filters.search) queryParams.append('search', filters.search)
    if (filters.category) queryParams.append('category', filters.category)
    if (filters.filter) queryParams.append('filter', filters.filter)
    if (filters.sortBy) queryParams.append('sortBy', filters.sortBy)
    queryParams.append('page', filters.page?.toString() || '1')
    queryParams.append('limit', filters.limit?.toString() || '20')

    try {
      const response = await fetch(`/api/products?${queryParams}`)
      const data = await response.json()

      if (data.success) {
        setProducts(data.data || [])
        setPagination(data.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0
        })
      } else {
        setError(data.error || '상품을 불러오는데 실패했습니다.')
        setProducts([])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      setError('서버 오류가 발생했습니다.')
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  // 필터 변경
  const setFilters = useCallback((newFilters: ProductFilters | ((prev: ProductFilters) => ProductFilters)) => {
    if (typeof newFilters === 'function') {
      setFiltersState(prev => ({
        ...prev,
        ...newFilters(prev)
      }))
    } else {
      setFiltersState(prev => ({
        ...prev,
        ...newFilters
      }))
    }
  }, [])

  // 페이지 변경
  const setPage = useCallback((page: number) => {
    setFiltersState(prev => ({
      ...prev,
      page
    }))
  }, [])

  // 정렬 변경
  const setSortBy = useCallback((sortBy: string) => {
    setFiltersState(prev => ({
      ...prev,
      sortBy,
      page: 1 // 정렬 변경 시 첫 페이지로
    }))
  }, [])

  // 새로고침
  const refetch = useCallback(() => {
    fetchProducts()
  }, [fetchProducts])

  // 초기 데이터 로드
  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // 필터 변경 시 데이터 다시 로드
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  return {
    products,
    categories,
    loading,
    error,
    filters,
    pagination,
    setFilters,
    setPage,
    setSortBy,
    refetch
  }
} 