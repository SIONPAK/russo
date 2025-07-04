'use client'

import { useState, useEffect } from 'react'
import { Product } from '@/shared/types'

export function useProductDetail(productId: string) {
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProductDetail = async () => {
      if (!productId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      
      try {
        const response = await fetch(`/api/products/${productId}`)
        const data = await response.json()
        
        if (data.success) {
          setProduct(data.data)
        } else {
          setError(data.error || '상품 정보를 불러오는데 실패했습니다.')
          setProduct(null)
        }
      } catch (err) {
        console.error('상품 상세 정보 로딩 실패:', err)
        setError('상품 정보를 불러오는데 실패했습니다.')
        setProduct(null)
      } finally {
        setLoading(false)
      }
    }

    fetchProductDetail()
  }, [productId])

  return {
    product,
    loading,
    error
  }
} 