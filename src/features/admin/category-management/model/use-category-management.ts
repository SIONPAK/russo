import { useState, useEffect } from 'react'

// 데이터베이스 스키마에 맞는 타입
export interface CategoryMenu {
  id: string
  name: string
  key: string
  path: string
  order_index: number
  is_active: boolean
  is_special: boolean
  badge?: string | null
  text_color?: string | null
  created_at: string
  updated_at: string
}

export interface CategoryMenuForm {
  name: string
  key: string
  path: string
  order_index: number
  is_active: boolean
  is_special: boolean
  badge?: string
  text_color?: string
}

// TODO: 실제 API로 교체
const mockCategories: CategoryMenu[] = [
  {
    id: '1',
    name: 'ORDER',
    key: 'order',
    path: '/customer/products',
    order_index: 1,
    is_active: true,
    is_special: true,
    text_color: '#dc2626',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    name: 'NEW',
    key: 'new',
    path: '/products?filter=new',
    order_index: 2,
    is_active: true,
    is_special: false,
    badge: '✨',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '3',
    name: 'WOMANS',
    key: 'womans',
    path: '/products?category=womans',
    order_index: 3,
    is_active: true,
    is_special: false,
    badge: '♀',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '4',
    name: 'DENIM',
    key: 'denim',
    path: '/products?category=denim',
    order_index: 4,
    is_active: true,
    is_special: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '5',
    name: 'ON SALE',
    key: 'sale',
    path: '/products?filter=sale',
    order_index: 5,
    is_active: true,
    is_special: true,
    text_color: '#dc2626',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
]

export function useCategoryManagement() {
  const [categories, setCategories] = useState<CategoryMenu[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryMenu | null>(null)

  // 카테고리 목록 조회
  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/categories')
      const result = await response.json()

      if (result.success) {
        setCategories(result.data)
      } else {
        console.error('Categories fetch error:', result.error)
      }
    } catch (error) {
      console.error('Categories fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  // 카테고리 추가
  const addCategory = async (form: CategoryMenuForm): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          key: form.key,
          path: form.path,
          order_index: form.order_index,
          is_active: form.is_active,
          is_special: form.is_special,
          badge: form.badge || null,
          text_color: form.text_color || null
        })
      })

      const result = await response.json()

      if (result.success) {
        await fetchCategories() // 목록 새로고침
        return { success: true }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Category add error:', error)
      return { success: false, error: '카테고리 추가 중 오류가 발생했습니다.' }
    }
  }

  // 카테고리 수정
  const updateCategory = async (id: string, form: CategoryMenuForm): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          key: form.key,
          path: form.path,
          order_index: form.order_index,
          is_active: form.is_active,
          is_special: form.is_special,
          badge: form.badge || null,
          text_color: form.text_color || null
        })
      })

      const result = await response.json()

      if (result.success) {
        await fetchCategories() // 목록 새로고침
        return { success: true }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Category update error:', error)
      return { success: false, error: '카테고리 수정 중 오류가 발생했습니다.' }
    }
  }

  // 카테고리 삭제
  const deleteCategory = async (id: string) => {
    const category = categories.find(cat => cat.id === id)
    const categoryName = category?.name || '카테고리'
    
    if (!confirm(`정말로 "${categoryName}" 카테고리를 삭제하시겠습니까?\n\n⚠️ 이 카테고리를 사용하는 상품이 있으면 삭제할 수 없습니다.`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        await fetchCategories() // 목록 새로고침
        alert('카테고리가 성공적으로 삭제되었습니다.')
      } else {
        alert(result.error || '카테고리 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('Category delete error:', error)
      alert('카테고리 삭제 중 오류가 발생했습니다.')
    }
  }

  // 카테고리 활성화/비활성화 토글
  const toggleActive = async (id: string) => {
    const category = categories.find(cat => cat.id === id)
    if (!category) return

    try {
      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...category,
          is_active: !category.is_active
        })
      })

      const result = await response.json()

      if (result.success) {
        await fetchCategories() // 목록 새로고침
      } else {
        alert(result.error || '상태 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('Category toggle error:', error)
      alert('상태 변경 중 오류가 발생했습니다.')
    }
  }

  // 순서 업데이트
  const updateOrder = async (reorderedCategories: CategoryMenu[]) => {
    try {
      // 각 카테고리의 order_index를 업데이트
      const updatePromises = reorderedCategories.map((category, index) => 
        fetch(`/api/admin/categories/${category.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...category,
            order_index: index + 1
          })
        })
      )

      await Promise.all(updatePromises)
      await fetchCategories() // 목록 새로고침
    } catch (error) {
      console.error('Category order update error:', error)
      alert('순서 변경 중 오류가 발생했습니다.')
    }
  }

  // 모달 관리
  const openAddModal = () => {
    setEditingCategory(null)
    setShowAddModal(true)
  }

  const openEditModal = (category: CategoryMenu) => {
    setEditingCategory(category)
    setShowAddModal(false)
  }

  const closeModal = () => {
    setShowAddModal(false)
    setEditingCategory(null)
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  return {
    categories,
    loading,
    showAddModal,
    editingCategory,
    addCategory,
    updateCategory,
    deleteCategory,
    updateOrder,
    toggleActive,
    openAddModal,
    closeModal,
    openEditModal,
    refetch: fetchCategories
  }
} 