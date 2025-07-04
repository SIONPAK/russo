'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '@/widgets/layout/main-layout'
import { Button } from '@/shared/ui/button'
import { ArrowLeft, Pin, Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/shared/lib/supabase'

interface Notice {
  id: string
  title: string
  content: string
  is_pinned: boolean
  created_at: string
  updated_at: string
  created_by: string
}

interface NoticeDetailPageProps {
  noticeId: string
}

export function NoticeDetailPage({ noticeId }: NoticeDetailPageProps) {
  const [notice, setNotice] = useState<Notice | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchNotice = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('notices')
          .select('*')
          .eq('id', noticeId)
          .single()

        if (error) throw error
        setNotice(data)
      } catch (error) {
        console.error('공지사항 조회 실패:', error)
      } finally {
        setLoading(false)
      }
    }

    if (noticeId) {
      fetchNotice()
    }
  }, [noticeId])

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-50 py-12">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              로딩 중...
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!notice) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-gray-50 py-12">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">공지사항을 찾을 수 없습니다</h2>
              <Button onClick={() => router.push('/community')}>
                목록으로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* 상단 네비게이션 */}
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => router.push('/community')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              목록으로
            </Button>
          </div>

          {/* 공지사항 상세 */}
          <div className="bg-white rounded-lg shadow-sm ">
            {/* 헤더 */}
            <div className="border-b bg-gray-50 p-6">
              <div className="flex items-center gap-2 mb-3">
                {notice.is_pinned && (
                  <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded-full">
                    <Pin className="w-3 h-3" />
                    고정
                  </span>
                )}
                <span className="text-sm text-gray-500">공지사항</span>
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 mb-4">
                {notice.title}
              </h1>
              
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(notice.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
                <div>작성자: 루소</div>
              </div>
            </div>

            {/* 내용 */}
            <div className="p-6">
              <div 
                className="prose prose-lg max-w-none text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: notice.content }}
              />
            </div>
          </div>

          {/* 하단 네비게이션 */}
          <div className="mt-6 flex justify-between">
            <Button
              variant="outline"
              onClick={() => router.push('/community')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              목록으로
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  )
} 