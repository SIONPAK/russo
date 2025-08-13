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
    mobile_image_url?: string
    width: number
    height: number
    mobile_width?: number
    mobile_height?: number
    start_date: string
    end_date: string
    is_active: boolean
  }) => void
  onCancel: () => void
}

export function PopupModal({ popup, onSave, onCancel }: PopupModalProps) {
  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [mobileImageUrl, setMobileImageUrl] = useState('')
  const [width, setWidth] = useState(400)
  const [height, setHeight] = useState(300)
  const [mobileWidth, setMobileWidth] = useState(300)
  const [mobileHeight, setMobileHeight] = useState(400)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [mobileUploading, setMobileUploading] = useState(false)
  const [deviceType, setDeviceType] = useState<'desktop' | 'mobile'>('desktop')

  const { uploadImage } = usePopupManagement()

  useEffect(() => {
    if (popup) {
      setTitle(popup.title)
      setImageUrl(popup.image_url)
      setMobileImageUrl(popup.mobile_image_url || '')
      setWidth(popup.width)
      setHeight(popup.height)
      setMobileWidth(popup.mobile_width || 300)
      setMobileHeight(popup.mobile_height || 400)
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

  // 디바이스 타입 감지
  useEffect(() => {
    const checkDeviceType = () => {
      const isMobile = window.innerWidth <= 768
      setDeviceType(isMobile ? 'mobile' : 'desktop')
    }
    
    checkDeviceType()
    window.addEventListener('resize', checkDeviceType)
    
    return () => window.removeEventListener('resize', checkDeviceType)
  }, [])

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

  const handleMobileImageUpload = async (file: File) => {
    try {
      setMobileUploading(true)
      const url = await uploadImage(file)
      setMobileImageUrl(url)
    } catch (error) {
      console.error('모바일 이미지 업로드 실패:', error)
      alert('모바일 이미지 업로드에 실패했습니다.')
    } finally {
      setMobileUploading(false)
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
        mobile_image_url: mobileImageUrl,
        width,
        height,
        mobile_width: mobileWidth,
        mobile_height: mobileHeight,
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto ${
        deviceType === 'mobile' ? 'max-w-full' : 'max-w-2xl'
      }`}>
        <div className="flex justify-between items-center p-4 md:p-6 border-b">
          <h2 className="text-lg md:text-xl font-semibold">
            {popup ? '팝업 수정' : '팝업 생성'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
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
              데스크탑 팝업 이미지 *
            </label>
            <div className="space-y-3">
              {imageUrl && (
                <div className="border rounded-lg p-4">
                  <img
                    src={imageUrl}
                    alt="데스크탑 팝업 미리보기"
                    className="max-w-full h-auto max-h-48 mx-auto"
                  />
                </div>
              )}
              <FileUpload
                accept="image/*"
                onFileSelect={handleImageUpload}
                disabled={uploading}
                className="w-full"
                label={uploading ? '업로드 중...' : '데스크탑 이미지 업로드'}
                description="JPG, PNG, WebP 파일만 가능 (권장: 300x500px)"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              모바일 팝업 이미지 (선택사항)
            </label>
            <div className="space-y-3">
              {mobileImageUrl && (
                <div className="border rounded-lg p-4">
                  <img
                    src={mobileImageUrl}
                    alt="모바일 팝업 미리보기"
                    className="max-w-full h-auto max-h-48 mx-auto"
                  />
                </div>
              )}
              <FileUpload
                accept="image/*"
                onFileSelect={handleMobileImageUpload}
                disabled={mobileUploading}
                className="w-full"
                label={mobileUploading ? '업로드 중...' : '모바일 이미지 업로드'}
                description="JPG, PNG, WebP 파일만 가능 (권장: 300x400px)"
              />
              <p className="text-xs text-gray-500">
                모바일 이미지를 설정하지 않으면 데스크탑 이미지가 사용됩니다.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">데스크탑 크기 설정</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <p className="text-xs text-gray-500 mt-1">권장: 300-600px</p>
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
                <p className="text-xs text-gray-500 mt-1">권장: 200-800px</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">모바일 크기 설정 (선택사항)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  너비 (px)
                </label>
                <Input
                  type="number"
                  value={mobileWidth}
                  onChange={(e) => setMobileWidth(Number(e.target.value))}
                  min="200"
                  max="400"
                />
                <p className="text-xs text-gray-500 mt-1">권장: 250-350px</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  높이 (px)
                </label>
                <Input
                  type="number"
                  value={mobileHeight}
                  onChange={(e) => setMobileHeight(Number(e.target.value))}
                  min="200"
                  max="600"
                />
                <p className="text-xs text-gray-500 mt-1">권장: 350-500px</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim() || !imageUrl || uploading}
              className="w-full sm:w-auto"
            >
              {loading ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
} 