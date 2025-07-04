'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { X } from 'lucide-react'
import dynamic from 'next/dynamic'

// TinyMCE 에디터를 동적으로 로드 (SSR 방지)
const Editor = dynamic(() => import('@tinymce/tinymce-react').then(mod => ({ default: mod.Editor })), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
    <span className="text-gray-500">에디터 로딩 중...</span>
  </div>
})

interface NoticeModalProps {
  notice?: any
  onSave: (data: { title: string; content: string; is_pinned: boolean }) => void
  onCancel: () => void
}

export function NoticeModal({ notice, onSave, onCancel }: NoticeModalProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (notice) {
      setTitle(notice.title)
      setContent(notice.content)
      setIsPinned(notice.is_pinned)
    }
  }, [notice])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !content.trim()) return

    setLoading(true)
    try {
      await onSave({
        title: title.trim(),
        content: content.trim(),
        is_pinned: isPinned
      })
    } catch (error) {
      console.error('저장 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">
            {notice ? '공지사항 수정' : '공지사항 작성'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              작성자
            </label>
            <Input
              type="text"
              value="루소"
              disabled
              className="bg-gray-50 text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제목 *
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="공지사항 제목을 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              내용 *
            </label>
            <div className="border border-gray-300 rounded-lg">
              <Editor
                apiKey="0t68kcm68pz2n5zz8rrifdmdazpfevqcgfuysgy7ku94iut4"
                value={content}
                onEditorChange={(content) => setContent(content)}
                init={{
                  height: 400,
                  menubar: false,
                  language: 'ko_KR',
                  plugins: [
                    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                    'insertdatetime', 'media', 'table', 'help', 'wordcount'
                  ],
                  toolbar: 'undo redo | blocks | ' +
                    'bold italic forecolor | alignleft aligncenter ' +
                    'alignright alignjustify | bullist numlist outdent indent | ' +
                    'removeformat | image link | help',
                  content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:14px }',
                  branding: false,
                  placeholder: '공지사항 내용을 입력하세요...',
                  statusbar: false
                }}
              />
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isPinned"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isPinned" className="ml-2 block text-sm text-gray-700">
              상단 고정
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
              disabled={loading || !title.trim() || !content.trim()}
            >
              {loading ? '저장 중...' : '저장'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
} 