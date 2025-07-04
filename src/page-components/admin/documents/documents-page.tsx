'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { showSuccess, showError } from '@/shared/lib/toast'
import { 
  Search, 
  Calendar, 
  Download, 
  FileText, 
  Eye, 
  Receipt,
  RefreshCw
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
  user_id: string
  created_at: string
  orders?: {
    order_number: string
    total_amount: number
    users: {
      company_name: string
      representative_name: string
    }
  }
}

export function AdminDocumentsPage() {
  const [activeTab, setActiveTab] = useState<'statement' | 'invoice'>('statement')
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // 문서 목록 조회
  const fetchDocuments = async (params?: {
    search?: string
    type?: string
    page?: number
    startDate?: string
    endDate?: string
  }) => {
    setLoading(true)
    try {
      const searchParams = new URLSearchParams({
        page: (params?.page || currentPage).toString(),
        limit: '20'
      })

      if (params?.search) {
        searchParams.append('search', params.search)
      }

      if (params?.type) {
        searchParams.append('type', params.type)
      }

      if (params?.startDate) {
        searchParams.append('startDate', params.startDate)
      }

      if (params?.endDate) {
        searchParams.append('endDate', params.endDate)
      }

      const response = await fetch(`/api/documents?${searchParams}`)
      const result = await response.json()

      if (result.success) {
        setDocuments(result.data)
        setTotalPages(result.pagination.totalPages || Math.ceil(result.pagination.total / 20))
        setTotalCount(result.pagination.total)
        if (params?.page) {
          setCurrentPage(params.page)
        }
      } else {
        showError(result.error || '문서 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('문서 조회 오류:', error)
      showError('문서 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 초기 데이터 로드
  useEffect(() => {
    fetchDocuments({ 
      type: activeTab,
      page: 1
    })
  }, [activeTab])

  // 탭 변경 시 데이터 다시 로드
  const handleTabChange = (tab: 'statement' | 'invoice') => {
    setActiveTab(tab)
    setCurrentPage(1)
    setSearchTerm('')
    setStartDate('')
    setEndDate('')
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
      startDate,
      endDate,
      page: 1
    })
  }

  // 초기화
  const handleReset = () => {
    setSearchTerm('')
    setStartDate('')
    setEndDate('')
    setCurrentPage(1)
    fetchDocuments({ 
      type: activeTab,
      page: 1
    })
  }

  // 페이지 변경
  const handlePageChange = (page: number) => {
    fetchDocuments({
      search: searchTerm,
      type: activeTab,
      startDate,
      endDate,
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
        showSuccess('파일이 다운로드되었습니다.')
      } else {
        showError('파일 다운로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('Download error:', error)
      showError('파일 다운로드 중 오류가 발생했습니다.')
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
        showError('미리보기에 실패했습니다.')
      }
    } catch (error) {
      console.error('Preview error:', error)
      showError('미리보기 중 오류가 발생했습니다.')
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">문서 관리</h1>
        <p className="text-gray-600">거래명세서와 세금계산서를 관리합니다.</p>
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
              거래명세서 ({activeTab === 'statement' ? totalCount : 0})
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
              세금계산서 ({activeTab === 'invoice' ? totalCount : 0})
            </button>
          </nav>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="문서명, 주문번호, 회사명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="date"
              placeholder="시작일"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="date"
              placeholder="종료일"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex space-x-2">
            <Button onClick={handleSearch} className="flex-1">
              <Search className="w-4 h-4 mr-2" />
              검색
            </Button>
            <Button onClick={handleReset} variant="outline">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
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
          <>
            {/* 테이블 헤더 */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-500">
                <div className="col-span-3">문서명</div>
                <div className="col-span-2">회사명</div>
                <div className="col-span-2">주문번호</div>
                <div className="col-span-2">금액</div>
                <div className="col-span-2">발행일</div>
                <div className="col-span-1">액션</div>
              </div>
            </div>

            {/* 문서 목록 */}
            <div className="divide-y divide-gray-200">
              {documents.map((document) => (
                <div key={document.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3">
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          activeTab === 'statement' 
                            ? 'text-purple-600 bg-purple-100' 
                            : 'text-green-600 bg-green-100'
                        }`}>
                          {activeTab === 'statement' ? '거래명세서' : '세금계산서'}
                        </span>
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {document.title}
                        </span>
                      </div>
                    </div>
                    
                    <div className="col-span-2">
                      <div className="text-sm text-gray-900">
                        {document.orders?.users?.company_name || '-'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {document.orders?.users?.representative_name || ''}
                      </div>
                    </div>
                    
                    <div className="col-span-2">
                      <span className="text-sm text-gray-900">
                        {document.orders?.order_number || document.order_number || '-'}
                      </span>
                    </div>
                    
                    <div className="col-span-2">
                      <span className="text-sm font-medium text-gray-900">
                        {document.orders?.total_amount 
                          ? `${document.orders.total_amount.toLocaleString()}원`
                          : document.amount 
                          ? `${document.amount.toLocaleString()}원`
                          : '-'
                        }
                      </span>
                    </div>
                    
                    <div className="col-span-2">
                      <span className="text-sm text-gray-500">
                        {formatDateTime(document.created_at)}
                      </span>
                    </div>
                    
                    <div className="col-span-1">
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreview(document.id)}
                          className="p-1"
                          title="미리보기"
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(document.id, document.filename)}
                          className="p-1"
                          title="다운로드"
                        >
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
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