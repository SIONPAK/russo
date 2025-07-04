'use client'

import { useState, useRef } from 'react'
import { Button } from './button'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { FILE_UPLOAD } from '@/shared/constants'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  onFileRemove?: () => void
  currentImageUrl?: string
  accept?: string
  maxSize?: number
  className?: string
  disabled?: boolean
  label?: string
  description?: string
}

export function FileUpload({
  onFileSelect,
  onFileRemove,
  currentImageUrl,
  accept = FILE_UPLOAD.ALLOWED_TYPES.join(','),
  maxSize = FILE_UPLOAD.MAX_SIZE,
  className = '',
  disabled = false,
  label = '이미지 업로드',
  description = `JPG, PNG, WebP 파일만 가능 (최대 ${maxSize / (1024 * 1024)}MB)`
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    // 파일 크기 검증
    if (file.size > maxSize) {
      alert(`파일 크기는 ${maxSize / (1024 * 1024)}MB를 초과할 수 없습니다.`)
      return
    }

    // 파일 타입 검증
    if (!FILE_UPLOAD.ALLOWED_TYPES.includes(file.type)) {
      alert('지원하지 않는 파일 형식입니다. (JPG, PNG, WebP만 가능)')
      return
    }

    // 미리보기 생성
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    onFileSelect(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setDragOver(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleRemove = () => {
    setPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onFileRemove?.()
  }

  const displayImage = preview || currentImageUrl

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 라벨 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <p className="text-xs text-gray-500">{description}</p>
      </div>

      {/* 업로드 영역 */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-6 text-center transition-all
          ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        {displayImage ? (
          // 이미지 미리보기
          <div className="relative">
            <img
              src={displayImage}
              alt="업로드된 이미지"
              className="max-w-full max-h-64 mx-auto rounded-lg shadow-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="absolute top-2 right-2 bg-white hover:bg-gray-50"
              onClick={(e) => {
                e.stopPropagation()
                handleRemove()
              }}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          // 업로드 안내
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-gray-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">
                이미지를 드래그하여 업로드하거나 클릭하여 선택하세요
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                파일 선택
              </Button>
            </div>
          </div>
        )}

        {/* 숨겨진 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />
      </div>
    </div>
  )
} 