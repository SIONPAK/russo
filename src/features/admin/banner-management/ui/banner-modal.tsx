'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { X, Upload, Image as ImageIcon, Monitor, Smartphone } from 'lucide-react'
import { Banner, BannerFormData } from '../model/use-banner-management'
import { showError, showInfo } from '@/shared/lib/toast'

interface BannerModalProps {
  isOpen: boolean
  onClose: () => void
  banner?: Banner | null
  onSave: (data: BannerFormData) => Promise<boolean>
  onUploadImage: (file: File, type: 'desktop' | 'mobile') => Promise<string | null>
  updating: boolean
}

export function BannerModal({
  isOpen,
  onClose,
  banner,
  onSave,
  onUploadImage,
  updating
}: BannerModalProps) {
  const [formData, setFormData] = useState<BannerFormData>({
    title: '',
    desktop_image: '',
    mobile_image: '',
    link_url: '',
    order_index: 1,
    is_active: true
  })

  const [desktopPreview, setDesktopPreview] = useState<string>('')
  const [mobilePreview, setMobilePreview] = useState<string>('')
  const [uploadingDesktop, setUploadingDesktop] = useState(false)
  const [uploadingMobile, setUploadingMobile] = useState(false)

  useEffect(() => {
    if (banner) {
      setFormData({
        title: banner.title,
        desktop_image: banner.desktop_image,
        mobile_image: banner.mobile_image,
        link_url: banner.link_url || '',
        order_index: banner.order_index,
        is_active: banner.is_active
      })
      setDesktopPreview(banner.desktop_image)
      setMobilePreview(banner.mobile_image)
    } else {
      setFormData({
        title: '',
        desktop_image: '',
        mobile_image: '',
        link_url: '',
        order_index: 1,
        is_active: true
      })
      setDesktopPreview('')
      setMobilePreview('')
    }
  }, [banner, isOpen])

  if (!isOpen) return null

  const handleImageUpload = async (file: File, type: 'desktop' | 'mobile') => {
    if (type === 'desktop') {
      setUploadingDesktop(true)
      const url = await onUploadImage(file, type)
      if (url) {
        setFormData(prev => ({ ...prev, desktop_image: url }))
        setDesktopPreview(url)
      }
      setUploadingDesktop(false)
    } else {
      setUploadingMobile(true)
      const url = await onUploadImage(file, type)
      if (url) {
        setFormData(prev => ({ ...prev, mobile_image: url }))
        setMobilePreview(url)
      }
      setUploadingMobile(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      showError('배너 제목을 입력해주세요.')
      return
    }

    if (!formData.desktop_image) {
      showError('데스크톱 이미지를 업로드해주세요.')
      return
    }

    if (!formData.mobile_image) {
      showError('모바일 이미지를 업로드해주세요.')
      return
    }

    const success = await onSave(formData)
    if (success) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {banner ? '배너 수정' : '배너 추가'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                배너 제목 *
              </label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="배너 제목을 입력하세요"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                링크 URL
              </label>
              <Input
                value={formData.link_url}
                onChange={(e) => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                placeholder="클릭 시 이동할 URL (선택사항)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                정렬 순서
              </label>
              <Input
                type="number"
                min="1"
                value={formData.order_index}
                onChange={(e) => setFormData(prev => ({ ...prev, order_index: parseInt(e.target.value) || 1 }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                활성화 상태
              </label>
              <select
                value={formData.is_active ? 'true' : 'false'}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="true">활성화</option>
                <option value="false">비활성화</option>
              </select>
            </div>
          </div>

          {/* 이미지 업로드 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 데스크톱 이미지 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Monitor className="h-4 w-4 inline mr-1" />
                데스크톱 이미지 (1920x1080) *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                {desktopPreview ? (
                  <div className="relative">
                    <img
                      src={desktopPreview}
                      alt="데스크톱 배너 미리보기"
                      className="w-full h-32 object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setDesktopPreview('')
                        setFormData(prev => ({ ...prev, desktop_image: '' }))
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">
                      1920x1080 크기의 이미지를 업로드하세요
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImageUpload(file, 'desktop')
                      }}
                      className="hidden"
                      id="desktop-upload"
                    />
                    <label
                      htmlFor="desktop-upload"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingDesktop ? '업로드 중...' : '파일 선택'}
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* 모바일 이미지 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Smartphone className="h-4 w-4 inline mr-1" />
                모바일 이미지 *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                {mobilePreview ? (
                  <div className="relative">
                    <img
                      src={mobilePreview}
                      alt="모바일 배너 미리보기"
                      className="w-full h-32 object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMobilePreview('')
                        setFormData(prev => ({ ...prev, mobile_image: '' }))
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">
                      모바일용 이미지를 업로드하세요
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImageUpload(file, 'mobile')
                      }}
                      className="hidden"
                      id="mobile-upload"
                    />
                    <label
                      htmlFor="mobile-upload"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingMobile ? '업로드 중...' : '파일 선택'}
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 안내 메시지 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <ImageIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">이미지 업로드 안내</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>데스크톱 배너는 1920x1080 사이즈를 권장합니다.</li>
                    <li>모바일 배너는 1024px 미만 화면에서 표시됩니다.</li>
                    <li>지원 형식: JPG, PNG, WEBP (최대 10MB)</li>
                    <li>RSL 정책은 전체 공개로 설정됩니다.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updating || uploadingDesktop || uploadingMobile}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={updating || uploadingDesktop || uploadingMobile || !formData.desktop_image || !formData.mobile_image}
            >
              {updating ? '저장 중...' : (banner ? '수정' : '추가')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
