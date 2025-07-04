'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { FileUpload } from '@/shared/ui/file-upload'
import { X, Upload } from 'lucide-react'
import { usePopupManagement } from '../model/use-popup-management'

interface PopupModalProps {
  popup?: any
  onSave: (data: {
    title: string
    image_url: string
    width: number
    height: number
    start_date: string
    end_date: string
    is_active: boolean
  }) => void
  onCancel: () => void
}

export function PopupModal({ popup, onSave, onCancel }: PopupModalProps) {
  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [width, setWidth] = useState(400)
  const [height, setHeight] = useState(300)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const { uploadImage } = usePopupManagement()

  useEffect(() => {
    if (popup) {
      setTitle(popup.title)
      setImageUrl(popup.image_url)
      setWidth(popup.width)
      setHeight(popup.height)
      setStartDate(popup.start_date.split('T')[0])
      setEndDate(popup.end_date.split('T')[0])
      setIsActive(popup.is_active)
    } else {
      // 기본값 설정
      const today = new Date().toISOString().split('T')[0]
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      setStartDate(today)
      setEndDate(nextWeek)
    }
  }, [popup])

  const handleImageUpload = async (file: File) => {
    try {
      setUploading(true)
      const url = await uploadImage(file)
      setImageUrl(url)
    } catch (error) {
      console.error('이미지 업로드 실패:', error)
      alert('이미지 업로드에 실패했습니다.')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !imageUrl || !startDate || !endDate) return

    setLoading(true)
    try {
      await onSave({
        title: title.trim(),
        image_url: imageUrl,
        width,
        height,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        is_active: isActive
      })
    } catch (error) {
      console.error('저장 실패:', error)
      const errorMessage = error instanceof Error ? error.message : '저장에 실패했습니다.'
      alert(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">
            {popup ? '팝업 수정' : '팝업 생성'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              팝업 제목 *
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="팝업 제목을 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              팝업 이미지 *
            </label>
            <div className="space-y-3">
              {imageUrl && (
                <div className="border rounded-lg p-4">
                  <img
                    src={imageUrl}
                    alt="팝업 미리보기"
                    className="max-w-full h-auto max-h-48 mx-auto"
                  />
                </div>
              )}
              <FileUpload
                accept="image/*"
                onFileSelect={handleImageUpload}
                disabled={uploading}
                className="w-full"
                label={uploading ? '업로드 중...' : '이미지 업로드'}
                description="JPG, PNG, WebP 파일만 가능"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                너비 (px) *
              </label>
              <Input
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                min="100"
                max="1920"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                높이 (px) *
              </label>
              <Input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                min="100"
                max="1080"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시작일 *
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                종료일 *
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
              팝업 활성화
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim() || !imageUrl || uploading}
            >
              {loading ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
} 