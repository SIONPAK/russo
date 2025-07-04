'use client'

import { useState } from 'react'
import { MainLayout } from '@/widgets/layout/main-layout'
import { Input } from '@/shared/ui/input'
import { Search, Pin } from 'lucide-react'
import { useNotices } from '@/features/community/model/use-notices'
import { useRouter } from 'next/navigation'

export function CommunityPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const { notices, loading } = useNotices()
  const router = useRouter()

  const filteredNotices = notices.filter(notice =>
    notice.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notice.content.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const pinnedNotices = filteredNotices.filter(notice => notice.is_pinned)
  const regularNotices = filteredNotices.filter(notice => !notice.is_pinned)

  const handleNoticeClick = (noticeId: string) => {
    router.push(`/community/${noticeId}`)
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">공지사항</h1>
            <p className="text-gray-600">루소의 최신 소식과 공지사항을 확인하세요</p>
          </div>

          

          {/* 게시판 스타일 공지사항 목록 */}
          <div className="bg-white rounded-lg shadow-sm bg-gray-80">
            {/* 헤더 */}
            <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 border-gray-200   font-semibold text-sm text-gray-700">
              <div className="col-span-1 text-center">번호</div>
              <div className="col-span-7">제목</div>
              <div className="col-span-2 text-center">작성자</div>
              <div className="col-span-2 text-center">작성일</div>
            </div>
            
            {/* 내용 */}
            <div className="divide-y divide-gray-200">
              {loading ? (
                <div className="p-12 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
                  로딩 중...
                </div>
              ) : filteredNotices.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  공지사항이 없습니다.
                </div>
              ) : (
                <>
                  {/* 고정 공지사항 */}
                  {pinnedNotices.map((notice, index) => (
                    <div key={notice.id} className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-50 transition-colors">
                      <div className="col-span-1 text-center text-sm font-semibold text-red-600">
                        공지
                      </div>
                      <div className="col-span-7">
                        <button
                          onClick={() => handleNoticeClick(notice.id)}
                          className="text-left w-full hover:text-blue-600 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Pin className="w-4 h-4 text-red-500" />
                            <div className="font-medium text-gray-900 hover:underline">
                              {notice.title}
                            </div>
                          </div>
                        </button>
                      </div>
                      <div className="col-span-2 text-center text-sm text-gray-600">
                        루소
                      </div>
                      <div className="col-span-2 text-center text-sm text-gray-600">
                        {new Date(notice.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}

                  {/* 일반 공지사항 */}
                  {regularNotices.map((notice, index) => (
                    <div key={notice.id} className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-50 transition-colors">
                      <div className="col-span-1 text-center text-sm text-gray-600">
                        {regularNotices.length - index}
                      </div>
                      <div className="col-span-7">
                        <button
                          onClick={() => handleNoticeClick(notice.id)}
                          className="text-left w-full hover:text-blue-600 transition-colors"
                        >
                          <div className="font-medium text-gray-900 hover:underline">
                            {notice.title}
                          </div>
                        </button>
                      </div>
                      <div className="col-span-2 text-center text-sm text-gray-600">
                        루소
                      </div>
                      <div className="col-span-2 text-center text-sm text-gray-600">
                        {new Date(notice.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  )
} 