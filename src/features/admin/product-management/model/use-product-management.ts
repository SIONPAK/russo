'use client'

import { useState, useCallback, useEffect } from 'react'
import { Product, CreateProductData, UpdateProductData, ProductFilters, Category } from '@/shared/types'
import { showSuccess, showError } from '@/shared/lib/toast'

interface InventoryOption {
  color: string
  size: string
  quantity: number
}

interface ExtendedCreateProductData extends CreateProductData {
  inventoryOptions?: InventoryOption[]
}

interface UseProductManagementReturn {
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
  // 액션들
  fetchProducts: () => void
  fetchCategories: () => void
  createProduct: (data: ExtendedCreateProductData) => Promise<{ success: boolean; data: Product | null; error?: string }>
  updateProduct: (id: string, data: Partial<ExtendedCreateProductData>) => Promise<{ success: boolean; data: Product | null; error?: string }>
  deleteProduct: (id: string) => Promise<{ success: boolean; error?: string }>
  setFilters: (filters: Partial<ProductFilters>) => void
  setPage: (page: number) => void
}

export function useProductManagement(): UseProductManagementReturn {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<ProductFilters>({
    search: '',
    status: 'all',
    category: '',
    sort_by: 'created_at',
    sort_order: 'desc',
    page: 1,
    limit: 20
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // 상품 목록 조회
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    setError(null)

    const queryParams = new URLSearchParams()
    
    if (filters.search) queryParams.append('search', filters.search)
    if (filters.status) queryParams.append('status', filters.status)
    if (filters.category) queryParams.append('category', filters.category)
    if (filters.sort_by) queryParams.append('sort_by', filters.sort_by)
    if (filters.sort_order) queryParams.append('sort_order', filters.sort_order)
    queryParams.append('page', filters.page?.toString() || '1')
    queryParams.append('limit', filters.limit?.toString() || '20')

    try {
      const response = await fetch(`/api/admin/products?${queryParams}`)
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
        console.error('Failed to fetch products:', data.error)
        setProducts([])
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  // 카테고리 목록 조회
  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/categories')
      const result = await response.json()

      if (result.success) {
        setCategories(result.data)
      } else {
        console.error('Categories fetch error:', result.error)
      }
    } catch (err) {
      console.error('Categories fetch error:', err)
    }
  }, [])

  // 상품 생성
  const createProduct = useCallback(async (productData: ExtendedCreateProductData) => {
    try {
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      })

      const data = await response.json()

      if (data.success) {
        await fetchProducts() // 목록 새로고침
        return { success: true, data: data.data, error: undefined }
      } else {
        return { success: false, data: null, error: data.error }
      }
    } catch (error) {
      console.error('Error creating product:', error)
      return { success: false, data: null, error: '상품 생성 중 오류가 발생했습니다.' }
    }
  }, [fetchProducts])

  // 상품 수정
  const updateProduct = useCallback(async (id: string, productData: Partial<ExtendedCreateProductData>) => {
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      })

      const data = await response.json()

      if (data.success) {
        await fetchProducts() // 목록 새로고침
        return { success: true, data: data.data, error: undefined }
      } else {
        return { success: false, data: null, error: data.error }
      }
    } catch (error) {
      console.error('Error updating product:', error)
      return { success: false, data: null, error: '상품 수정 중 오류가 발생했습니다.' }
    }
  }, [fetchProducts])

  // 상품 삭제
  const deleteProduct = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.success) {
        await fetchProducts() // 목록 새로고침
        return { success: true, error: undefined }
      } else {
        return { success: false, error: data.error }
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      return { success: false, error: '상품 삭제 중 오류가 발생했습니다.' }
    }
  }, [fetchProducts])

  // 필터 변경
  const setFilters = useCallback((newFilters: Partial<ProductFilters>) => {
    setFiltersState(prev => ({
      ...prev,
      ...newFilters,
      page: newFilters.page || 1 // 필터 변경 시 첫 페이지로
    }))
  }, [])

  // 페이지 변경
  const setPage = useCallback((page: number) => {
    setFiltersState(prev => ({ ...prev, page }))
  }, [])

  // 초기 데이터 로드
  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [])

  // 필터 변경 시 상품 목록 새로고침
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
    fetchProducts,
    fetchCategories,
    createProduct,
    updateProduct,
    deleteProduct,
    setFilters,
    setPage
  }
} 