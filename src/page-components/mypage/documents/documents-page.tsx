'use client'

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { formatDateTime } from '@/shared/lib/utils'
import { 
  FileText, 
  Download, 
  Search, 
  Calendar,
  Eye,
  Receipt,
  CreditCard
} from 'lucide-react'

interface Document {
  id: string
  title: string
  type: string
  description?: string
  filename: string
  file_url: string
  amount?: number
  order_number?: string
  created_at: string
  orders?: {
    order_number: string
  }
}

export function DocumentsPage() {
  const { isAuthenticated, user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'statement' | 'invoice'>('statement')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // 문서 목록 조회
  const fetchDocuments = async (params?: {
    search?: string
    type?: string
    page?: number
  }) => {
    if (!user?.id) return

    setLoading(true)
    try {
      const searchParams = new URLSearchParams({
        userId: user.id,
        page: (params?.page || currentPage).toString(),
        limit: '10'
      })

      if (params?.search) {
        searchParams.append('search', params.search)
      }

      if (params?.type) {
        searchParams.append('type', params.type)
      }

      const response = await fetch(`/api/documents?${searchParams}`)
      const result = await response.json()

      if (result.success) {
        setDocuments(result.data)
        setTotalPages(result.pagination.totalPages)
        setTotalCount(result.pagination.total)
        if (params?.page) {
          setCurrentPage(params.page)
        }
      } else {
        console.error('문서 조회 실패:', result.error)
      }
    } catch (error) {
      console.error('문서 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  // 초기 데이터 로드
  useEffect(() => {
    if (user?.id) {
      fetchDocuments({ 
        type: activeTab,
        page: 1
      })
    }
  }, [user?.id, activeTab])

  // 탭 변경 시 데이터 다시 로드
  const handleTabChange = (tab: 'statement' | 'invoice') => {
    setActiveTab(tab)
    setCurrentPage(1)
    setSearchTerm('')
    fetchDocuments({ 
      type: tab,
      page: 1
    })
  }

  // 검색 실행
  const handleSearch = () => {
    setCurrentPage(1)
    fetchDocuments({
      search: searchTerm,
      type: activeTab,
      page: 1
    })
  }

  // 페이지 변경
  const handlePageChange = (page: number) => {
    fetchDocuments({
      search: searchTerm,
      type: activeTab,
      page: page
    })
  }

  // 문서 다운로드
  const handleDownload = async (documentId: string, filename: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/download`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        alert('파일 다운로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('파일 다운로드 중 오류가 발생했습니다.')
    }
  }

  // 문서 미리보기
  const handlePreview = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/preview`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        window.open(url, '_blank')
        window.URL.revokeObjectURL(url)
      } else {
        alert('미리보기에 실패했습니다.')
      }
    } catch (error) {
      console.error('Preview error:', error)
      alert('미리보기 중 오류가 발생했습니다.')
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h1>
          <p className="text-gray-600">문서 관리를 하려면 로그인해주세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">문서 관리</h1>
        <p className="text-gray-600">거래명세서와 세금계산서를 분리하여 관리하실 수 있습니다.</p>
      </div>

      {/* 탭 메뉴 */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => handleTabChange('statement')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'statement'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <FileText className="w-4 h-4 mr-2 inline" />
              거래명세서
            </button>
            <button
              onClick={() => handleTabChange('invoice')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'invoice'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Receipt className="w-4 h-4 mr-2 inline" />
              세금계산서
            </button>
          </nav>
        </div>
      </div>

      {/* 검색 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="문서명, 주문번호로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          <Button onClick={handleSearch} className="w-full md:w-auto">
            <Search className="w-4 h-4 mr-2" />
            검색
          </Button>
        </div>
      </div>

      {/* 문서 목록 */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">문서 목록을 불러오는 중...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>
              {activeTab === 'statement' ? '거래명세서' : '세금계산서'}가 없습니다.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {documents.map((document) => (
              <div key={document.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        activeTab === 'statement' 
                          ? 'text-purple-600 bg-purple-100' 
                          : 'text-green-600 bg-green-100'
                      }`}>
                        {activeTab === 'statement' ? '거래명세서' : '세금계산서'}
                      </span>
                      <h3 className="text-lg font-medium text-gray-900">
                        {document.title}
                      </h3>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>발행일: {formatDateTime(document.created_at)}</span>
                      </div>
                      {document.orders?.order_number && (
                        <div>주문번호: {document.orders.order_number}</div>
                      )}
                      {document.amount && (
                        <div>금액: {document.amount.toLocaleString()}원</div>
                      )}
                    </div>

                    {document.description && (
                      <p className="text-gray-600 text-sm mb-3">{document.description}</p>
                    )}
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePreview(document.id)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      미리보기
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(document.id, document.filename)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      다운로드
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                총 {totalCount}개의 문서
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  이전
                </Button>
                <span className="px-3 py-1 text-sm text-gray-700">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  다음
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 