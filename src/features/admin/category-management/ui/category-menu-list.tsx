'use client'

import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { CategoryMenu } from '../model/use-category-management'
import { 
  GripVertical,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink
} from 'lucide-react'

interface CategoryMenuListProps {
  categories: CategoryMenu[]
  onEdit: (category: CategoryMenu) => void
  onDelete: (id: string) => void
  onToggleActive: (id: string) => void
  onUpdateOrder: (categories: CategoryMenu[]) => void
}

export function CategoryMenuList({
  categories,
  onEdit,
  onDelete,
  onToggleActive,
  onUpdateOrder
}: CategoryMenuListProps) {
  const [draggedItem, setDraggedItem] = useState<CategoryMenu | null>(null)

  const handleDragStart = (e: React.DragEvent, category: CategoryMenu) => {
    setDraggedItem(category)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, targetCategory: CategoryMenu) => {
    e.preventDefault()
    
    if (!draggedItem || draggedItem.id === targetCategory.id) return

    const reorderedCategories = [...categories]
    const draggedIndex = reorderedCategories.findIndex(cat => cat.id === draggedItem.id)
    const targetIndex = reorderedCategories.findIndex(cat => cat.id === targetCategory.id)

    // 배열에서 드래그된 아이템 제거
    const [removed] = reorderedCategories.splice(draggedIndex, 1)
    // 타겟 위치에 삽입
    reorderedCategories.splice(targetIndex, 0, removed)

    onUpdateOrder(reorderedCategories)
    setDraggedItem(null)
  }

  if (categories.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <div className="text-gray-400 mb-4">
          <ExternalLink className="h-12 w-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          등록된 카테고리 메뉴가 없습니다
        </h3>
        <p className="text-gray-600 mb-4">
          첫 번째 카테고리 메뉴를 추가해보세요
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            카테고리 메뉴 목록
          </h2>
          <p className="text-sm text-gray-600">
            드래그하여 순서를 변경할 수 있습니다 ({categories.length}개)
          </p>
        </div>
      </div>

      {/* 카테고리 목록 */}
      <div className="space-y-3">
        {categories
          .sort((a, b) => a.order_index - b.order_index)
          .map((category) => (
            <div
              key={category.id}
              draggable
              onDragStart={(e) => handleDragStart(e, category)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, category)}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-move"
            >
              <div className="flex items-center space-x-4">
                {/* 드래그 핸들 */}
                <div className="flex-shrink-0 text-gray-400">
                  <GripVertical className="h-5 w-5" />
                </div>

                {/* 순서 */}
                <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                  {category.order_index}
                </div>

                {/* 메뉴 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-sm font-medium text-gray-900">
                      {category.badge && <span className="mr-1">{category.badge}</span>}
                      <span style={{ color: category.text_color || 'inherit' }}>
                        {category.name}
                      </span>
                    </h3>
                    {category.is_special && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        특별
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <p><span className="font-medium">키:</span> {category.key}</p>
                    <p><span className="font-medium">경로:</span> {category.path}</p>
                  </div>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      category.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {category.is_active ? '활성' : '비활성'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(category.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onToggleActive(category.id)}
                    className="border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    {category.is_active ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(category)}
                    className="border-gray-200 text-gray-600 hover:bg-gray-50"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(category.id)}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
} 