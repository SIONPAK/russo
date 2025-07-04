'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { formatDateTime } from '@/shared/lib/utils'
import { 
  FileText, 
  Download, 
  Search, 
  Calendar,
  Eye
} from 'lucide-react'

export function DocumentsPage() {
  const { isAuthenticated, user } = useAuthStore()
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  const fetchDocuments = async (params: {
    page?: number
    search?: string
    type?: string
  } = {}) => {
    if (!user?.id) return
    
    setLoading(true)
    try {
      const searchParams = new URLSearchParams({
        page: (params.page || pagination.page).toString(),
        limit: pagination.limit.toString(),
        userId: user.id
      })

      if (params.search) searchParams.append('search', params.search)
      if (params.type && params.type !== 'all') searchParams.append('type', params.type)

      const response = await fetch(`/api/documents?${searchParams}`)
      const result = await response.json()

      if (result.success) {
        setDocuments(result.data)
        setPagination(result.pagination)
      } else {
        console.error('문서 조회 실패:', result.error)
        setDocuments([])
      }
    } catch (error) {
      console.error('문서 조회 중 오류:', error)
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchDocuments()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, user?.id])

  const handleSearch = () => {
    fetchDocuments({
      search: searchTerm,
      type: typeFilter,
      page: 1
    })
  }

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

  const getDocumentTypeText = (type: string) => {
    const typeMap: { [key: string]: string } = {
      receipt: '영수증',
      invoice: '세금계산서',
      statement: '거래명세서',
      contract: '계약서',
      other: '기타'
    }
    return typeMap[type] || type
  }

  const getDocumentTypeColor = (type: string) => {
    switch (type) {
      case 'receipt': return 'text-blue-600 bg-blue-100'
      case 'invoice': return 'text-green-600 bg-green-100'
      case 'statement': return 'text-purple-600 bg-purple-100'
      case 'contract': return 'text-orange-600 bg-orange-100'
      default: return 'text-gray-600 bg-gray-100'
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
        <p className="text-gray-600">영수증, 세금계산서, 거래명세서 등을 관리하실 수 있습니다.</p>
      </div>

      {/* 검색 및 필터 */}
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
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체 문서</option>
              <option value="receipt">영수증</option>
              <option value="invoice">세금계산서</option>
              <option value="statement">거래명세서</option>
              <option value="contract">계약서</option>
              <option value="other">기타</option>
            </select>
          </div>
          <Button onClick={handleSearch} className="w-full md:w-auto">
            <Search className="w-4 h-4 mr-2" />
            검색
          </Button>
        </div>
      </div>

      {/* 문서 목록 */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">문서 목록</h2>
            <div className="text-sm text-gray-500">
              총 {pagination.total}건
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">문서를 불러오는 중...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">등록된 문서가 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {documents.map((document) => (
              <div key={document.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDocumentTypeColor(document.type)}`}>
                        {getDocumentTypeText(document.type)}
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
                      {document.order_number && (
                        <div>주문번호: {document.order_number}</div>
                      )}
                      {document.amount && (
                        <div>금액: {document.amount.toLocaleString()}원</div>
                      )}
                    </div>

                    {document.description && (
                      <p className="text-gray-600 text-sm mb-3">{document.description}</p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(document.id, document.filename)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      다운로드
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/api/documents/${document.id}/preview`, '_blank')}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      미리보기
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                페이지 {pagination.page} / {pagination.totalPages}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchDocuments({ page: pagination.page - 1, search: searchTerm, type: typeFilter })}
                  disabled={pagination.page <= 1}
                >
                  이전
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchDocuments({ page: pagination.page + 1, search: searchTerm, type: typeFilter })}
                  disabled={pagination.page >= pagination.totalPages}
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