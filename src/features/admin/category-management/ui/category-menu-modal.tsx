'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { CategoryMenu, CategoryMenuForm } from '../model/use-category-management'
import { X } from 'lucide-react'

interface CategoryMenuModalProps {
  isOpen: boolean
  onClose: () => void
  editingCategory?: CategoryMenu | null
  onSubmit: ((form: CategoryMenuForm) => Promise<{ success: boolean; error?: string }>) | 
           ((id: string, form: CategoryMenuForm) => Promise<{ success: boolean; error?: string }>)
}

export function CategoryMenuModal({
  isOpen,
  onClose,
  editingCategory,
  onSubmit
}: CategoryMenuModalProps) {
  const [form, setForm] = useState<CategoryMenuForm>({
    name: '',
    key: '',
    path: '',
    order_index: 1,
    is_active: true,
    is_special: false,
    badge: '',
    text_color: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editingCategory) {
      setForm({
        name: editingCategory.name,
        key: editingCategory.key,
        path: editingCategory.path,
        order_index: editingCategory.order_index,
        is_active: editingCategory.is_active,
        is_special: editingCategory.is_special,
        badge: editingCategory.badge || '',
        text_color: editingCategory.text_color || ''
      })
    } else {
      setForm({
        name: '',
        key: '',
        path: '',
        order_index: 1,
        is_active: true,
        is_special: false,
        badge: '',
        text_color: ''
      })
    }
    setError('')
  }, [editingCategory, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.name.trim()) {
      setError('메뉴명을 입력해주세요.')
      return
    }

    if (!form.key.trim()) {
      setError('메뉴 키를 입력해주세요.')
      return
    }

    if (!form.path.trim()) {
      setError('링크 경로를 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      let result
      if (editingCategory) {
        // 수정 모드
        const updateFn = onSubmit as (id: string, form: CategoryMenuForm) => Promise<{ success: boolean; error?: string }>
        result = await updateFn(editingCategory.id, form)
      } else {
        // 추가 모드
        const addFn = onSubmit as (form: CategoryMenuForm) => Promise<{ success: boolean; error?: string }>
        result = await addFn(form)
      }

      if (result.success) {
        onClose()
      } else {
        setError(result.error || '처리 중 오류가 발생했습니다.')
      }
    } catch (err) {
      setError('처리 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">
              {editingCategory ? '카테고리 메뉴 수정' : '카테고리 메뉴 추가'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 메뉴명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              메뉴명 *
            </label>
            <Input
              placeholder="예: NEW, DENIM, ORDER..."
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full"
            />
          </div>

          {/* 메뉴 키 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              메뉴 키 * <span className="text-xs text-gray-500">(영문, 숫자, 언더스코어만)</span>
            </label>
            <Input
              placeholder="예: new, denim, order..."
              value={form.key}
              onChange={(e) => setForm(prev => ({ ...prev, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
              className="w-full"
            />
          </div>

          {/* 링크 경로 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              링크 경로 *
            </label>
            <Input
              placeholder="예: /products?filter=new"
              value={form.path}
              onChange={(e) => setForm(prev => ({ ...prev, path: e.target.value }))}
              className="w-full"
            />
          </div>

          {/* 표시 순서 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              표시 순서
            </label>
            <Input
              type="number"
              min="1"
              value={form.order_index}
              onChange={(e) => setForm(prev => ({ ...prev, order_index: parseInt(e.target.value) || 1 }))}
              className="w-32"
            />
          </div>

          {/* 배지 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              배지 <span className="text-xs text-gray-500">(이모지 또는 특수문자)</span>
            </label>
            <Input
              placeholder="예: ✨, ♀, 🔥..."
              value={form.badge}
              onChange={(e) => setForm(prev => ({ ...prev, badge: e.target.value }))}
              className="w-full"
            />
          </div>

          {/* 텍스트 색상 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              텍스트 색상 <span className="text-xs text-gray-500">(HEX 코드)</span>
            </label>
            <div className="flex items-center space-x-3">
              <Input
                placeholder="예: #dc2626"
                value={form.text_color}
                onChange={(e) => setForm(prev => ({ ...prev, text_color: e.target.value }))}
                className="flex-1"
              />
              {form.text_color && (
                <div 
                  className="w-8 h-8 rounded border border-gray-300"
                  style={{ backgroundColor: form.text_color }}
                />
              )}
            </div>
          </div>

          {/* 특별 메뉴 */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="is_special"
              checked={form.is_special}
              onChange={(e) => setForm(prev => ({ ...prev, is_special: e.target.checked }))}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_special" className="text-sm font-medium text-gray-700">
              특별 메뉴로 표시
            </label>
          </div>

          {/* 활성화 */}
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              메뉴 활성화
            </label>
          </div>

          {/* 버튼 */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? '처리 중...' : editingCategory ? '수정' : '추가'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
} 