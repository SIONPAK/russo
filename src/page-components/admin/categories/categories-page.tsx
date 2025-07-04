'use client'

import { CategoryMenuList } from '@/features/admin/category-management/ui/category-menu-list'
import { CategoryMenuModal } from '@/features/admin/category-management/ui/category-menu-modal'
import { useCategoryManagement } from '@/features/admin/category-management/model/use-category-management'
import { Button } from '@/shared/ui/button'
import { Plus } from 'lucide-react'

export function CategoriesPage() {
  const {
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
    openEditModal
  } = useCategoryManagement()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">카테고리 메뉴를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">카테고리 메뉴 관리</h1>
        <p className="text-gray-600 mt-2">메인페이지 카테고리 메뉴 설정 및 관리</p>
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-end mb-6">
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          메뉴 추가
        </Button>
      </div>

      <CategoryMenuList
        categories={categories}
        onEdit={openEditModal}
        onDelete={deleteCategory}
        onToggleActive={toggleActive}
        onUpdateOrder={updateOrder}
      />

      <CategoryMenuModal
        isOpen={showAddModal || !!editingCategory}
        onClose={closeModal}
        editingCategory={editingCategory}
        onSubmit={editingCategory ? updateCategory : addCategory}
      />
    </div>
  )
} 