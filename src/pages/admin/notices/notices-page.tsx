'use client'

import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Plus, Search, Edit, Trash2, Pin, PinOff, Eye } from 'lucide-react'
import { useNoticeManagement } from '@/features/admin/notice-management/model/use-notice-management'
import { NoticeModal } from '@/features/admin/notice-management/ui/notice-modal'

export function NoticesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedNotice, setSelectedNotice] = useState<any>(null)

  const {
    notices,
    loading,
    createNotice,
    updateNotice,
    deleteNotice,
    togglePin
  } = useNoticeManagement()

  const filteredNotices = notices.filter(notice =>
    notice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notice.content.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreate = () => {
    setSelectedNotice(null)
    setShowModal(true)
  }

  const handleEdit = (notice: any) => {
    setSelectedNotice(notice)
    setShowModal(true)
  }

  const handleView = (notice: any) => {
    setSelectedNotice(notice)
    setShowDetail(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('정말로 이 공지사항을 삭제하시겠습니까?')) {
      await deleteNotice(id)
    }
  }

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    await togglePin(id, !isPinned)
  }

  const handleSave = async (data: any) => {
    if (selectedNotice) {
      await updateNotice(selectedNotice.id, data)
    } else {
      await createNotice(data)
    }
    setShowModal(false)
    setSelectedNotice(null)
  }

  // 상세보기 모달
  const DetailModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">공지사항 상세보기</h2>
          <button
            onClick={() => setShowDetail(false)}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              {selectedNotice?.is_pinned && (
                <span className="bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded-full">
                  📌 고정
                </span>
              )}
              <span className="text-sm text-gray-500">
                작성일: {new Date(selectedNotice?.created_at).toLocaleDateString()}
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              {selectedNotice?.title}
            </h3>
          </div>
          
          <div className="border-t pt-4">
            <div 
              className="prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: selectedNotice?.content || '' }}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-2 p-6 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setShowDetail(false)
              handleEdit(selectedNotice)
            }}
          >
            수정
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowDetail(false)}
          >
            닫기
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">공지사항 관리</h1>
        <Button onClick={handleCreate} className="flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>공지사항 작성</span>
        </Button>
      </div>

      {/* 검색 */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="제목 또는 내용으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* 게시판 스타일 공지사항 목록 */}
      <div className="bg-white rounded-lg shadow">
        {/* 헤더 */}
        <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-b font-semibold text-sm text-gray-700">
          <div className="col-span-1 text-center">번호</div>
          <div className="col-span-6">제목</div>
          <div className="col-span-2 text-center">작성자</div>
          <div className="col-span-2 text-center">작성일</div>
          <div className="col-span-1 text-center">관리</div>
        </div>
        
        {/* 내용 */}
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              로딩 중...
            </div>
          ) : filteredNotices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              공지사항이 없습니다.
            </div>
          ) : (
            filteredNotices.map((notice, index) => (
              <div key={notice.id} className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-50 transition-colors">
                <div className="col-span-1 text-center text-sm text-gray-600">
                  {notice.is_pinned ? '공지' : filteredNotices.length - index}
                </div>
                <div className="col-span-6">
                  <div className="flex items-center gap-2">
                    {notice.is_pinned && (
                      <Pin className="w-4 h-4 text-red-500" />
                    )}
                    <button
                      onClick={() => handleView(notice)}
                      className="text-left hover:text-blue-600 transition-colors"
                    >
                      <div className="font-medium text-gray-900 hover:underline">
                        {notice.title}
                      </div>
                      <div className="text-sm text-gray-500 truncate max-w-md">
                        {notice.content.replace(/<[^>]*>/g, '').substring(0, 50)}...
                      </div>
                    </button>
                  </div>
                </div>
                <div className="col-span-2 text-center text-sm text-gray-600">
                  루소
                </div>
                <div className="col-span-2 text-center text-sm text-gray-600">
                  {new Date(notice.created_at).toLocaleDateString()}
                </div>
                <div className="col-span-1 text-center">
                  <div className="flex justify-center space-x-1">
                    <button
                      onClick={() => handleView(notice)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="상세보기"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleTogglePin(notice.id, notice.is_pinned)}
                      className={`p-1 rounded hover:bg-gray-100 ${
                        notice.is_pinned ? 'text-red-600' : 'text-gray-400'
                      }`}
                      title={notice.is_pinned ? '고정 해제' : '상단 고정'}
                    >
                      {notice.is_pinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => handleEdit(notice)}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                      title="수정"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(notice.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="삭제"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 공지사항 작성/수정 모달 */}
      {showModal && (
        <NoticeModal
          notice={selectedNotice}
          onSave={handleSave}
          onCancel={() => {
            setShowModal(false)
            setSelectedNotice(null)
          }}
        />
      )}

      {/* 상세보기 모달 */}
      {showDetail && <DetailModal />}
    </div>
  )
} 