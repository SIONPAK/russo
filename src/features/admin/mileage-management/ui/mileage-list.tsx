'use client'

import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Mileage } from '@/shared/types'
import { formatCurrency, formatDateTime } from '@/shared/lib/utils'
import { 
  Search, 
  Plus,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  RotateCcw,
  Edit,
  Trash2
} from 'lucide-react'

interface MileageListProps {
  mileages: Mileage[]
  onMileageSelect: (mileage: Mileage) => void
  onApprove: (mileageId: string) => void
  onReject: (mileageId: string) => void
  onAddMileage: () => void
  onEdit?: (mileage: Mileage) => void
  onDelete?: (mileageId: string) => void
  userBalances?: {[userId: string]: number} // 사용자별 현재 마일리지 잔액
  selectedUser?: string // 선택된 사용자 이름
  cumulativeBalances?: {[mileageId: string]: number} // 마일리지 ID별 해당 시점 누적 잔액
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  onPageChange?: (page: number) => void
  onFilterChange?: (filters: {
    search?: string
    status?: string
    type?: string
    source?: string
    dateFrom?: string
    dateTo?: string
  }) => void
}

export function MileageList({ 
  mileages, 
  onMileageSelect, 
  onApprove, 
  onReject, 
  onAddMileage,
  onEdit,
  onDelete,
  userBalances,
  selectedUser,
  cumulativeBalances,
  pagination,
  onPageChange,
  onFilterChange
}: MileageListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // 서버 사이드 필터링으로 변경 - 클라이언트 사이드 필터링 제거
  const filteredMileages = mileages

  const applyFilters = () => {
    if (onFilterChange) {
      onFilterChange({
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        source: sourceFilter !== 'all' ? sourceFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      })
    }
  }

  const resetFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setTypeFilter('all')
    setSourceFilter('all')
    setDateFrom('')
    setDateTo('')
    
    // 서버에도 리셋 요청
    if (onFilterChange) {
      onFilterChange({})
    }
  }

  const setQuickDate = (months: number) => {
    const today = new Date()
    const pastDate = new Date(today.getFullYear(), today.getMonth() - months, today.getDate())
    setDateFrom(pastDate.toISOString().split('T')[0])
    setDateTo(today.toISOString().split('T')[0])
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100'
      case 'cancelled': return 'text-red-600 bg-red-100'
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '완료'
      case 'cancelled': return '취소'
      case 'pending': return '대기'
      default: return '알 수 없음'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'earn': return 'text-blue-600 bg-blue-100'
      case 'spend': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getTypeText = (type: string) => {
    switch (type) {
      case 'earn': return '적립'
      case 'spend': return '차감'
      default: return '알 수 없음'
    }
  }

  const getSourceText = (source: string) => {
    switch (source) {
      case 'manual': return '수동'
      case 'auto': return '자동'
      case 'order': return '주문'
      case 'refund': return '환불'
      default: return '기타'
    }
  }

  const handleExcelDownload = async () => {
    try {
      const response = await fetch('/api/admin/mileage/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          search: searchTerm,
          status: statusFilter,
          type: typeFilter,
          source: sourceFilter,
          dateFrom,
          dateTo
        }),
      })

      if (!response.ok) {
        throw new Error('엑셀 다운로드에 실패했습니다.')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mileage_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('엑셀 다운로드 오류:', error)
      alert('엑셀 다운로드 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="space-y-6">
      {/* 검색 및 필터 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="space-y-4">
          {/* 검색 및 필터 */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                업체명 또는 설명 검색
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="업체명 또는 설명 검색"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-10"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                전체 상태
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="all">전체 상태</option>
                <option value="pending">대기</option>
                <option value="completed">완료</option>
                <option value="cancelled">취소</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                전체 유형
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="all">전체 유형</option>
                <option value="earn">적립</option>
                <option value="spend">차감</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                전체 소스
              </label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="all">전체 소스</option>
                <option value="manual">수동</option>
                <option value="auto">자동</option>
                <option value="order">주문</option>
                <option value="refund">환불</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                &nbsp;
              </label>
              <Button onClick={onAddMileage} className="h-10 w-full bg-black text-white hover:bg-gray-800">
                <Plus className="h-4 w-4 mr-2" />
                수동 등록
              </Button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                &nbsp;
              </label>
              <Button variant="outline" onClick={handleExcelDownload} className="h-10 w-full">
                <Download className="h-4 w-4 mr-2" />
                엑셀
              </Button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                &nbsp;
              </label>
              <Button variant="outline" onClick={resetFilters} className="h-10 w-full">
                <RotateCcw className="h-4 w-4 mr-2" />
                초기화
              </Button>
            </div>
          </div>

          {/* 날짜 필터 */}
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시작 날짜
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료 날짜
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full h-10 px-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                &nbsp;
              </label>
              <Button 
                variant="outline" 
                className="h-10 w-full"
                onClick={() => setQuickDate(1)}
              >
                최근 1개월
              </Button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                &nbsp;
              </label>
              <Button 
                variant="outline" 
                className="h-10 w-full"
                onClick={() => setQuickDate(3)}
              >
                최근 3개월
              </Button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                &nbsp;
              </label>
              <Button 
                variant="outline" 
                className="h-10 w-full"
                onClick={() => setQuickDate(6)}
              >
                최근 6개월
              </Button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                &nbsp;
              </label>
              <Button 
                onClick={applyFilters} 
                className="h-10 w-full bg-black text-white hover:bg-gray-800"
              >
                검색
              </Button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                &nbsp;
              </label>
              <Button 
                variant="outline" 
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                }}
                className="h-10 w-full"
              >
                날짜 초기화
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 마일리지 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            마일리지 내역 ({filteredMileages.length}개)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  날짜
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  업체명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  유형
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  금액
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                  최종 마일리지
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  소스
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  설명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMileages.map((mileage) => (
                <tr key={mileage.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDateTime(mileage.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{mileage.user?.company_name || '알 수 없음'}</div>
                      <div className="text-xs text-gray-500">{mileage.user?.representative_name || ''}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(mileage.type)}`}>
                      {getTypeText(mileage.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={mileage.type === 'earn' ? 'text-blue-600' : 'text-red-600'}>
                      {mileage.type === 'earn' ? '+' : '-'}{formatCurrency(Math.abs(mileage.amount))}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 bg-blue-50">
                    {cumulativeBalances && cumulativeBalances[mileage.id] !== undefined ? (
                      <span className={cumulativeBalances[mileage.id] >= 0 ? 'text-blue-600' : 'text-red-600'}>
                        {formatCurrency(cumulativeBalances[mileage.id])}
                      </span>
                    ) : (
                      <span className="text-gray-400">계산중...</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getSourceText(mileage.source)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {mileage.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(mileage.status)}`}>
                      {getStatusText(mileage.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onMileageSelect(mileage)}
                      title="상세 보기"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    {/* 수동 입력한 마일리지에 대해서만 수정/삭제 버튼 표시 */}
                    {mileage.source === 'manual' && (
                      <>
                        {onEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEdit(mileage)}
                            title="수정"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (window.confirm('정말 삭제하시겠습니까?')) {
                                onDelete(mileage.id)
                              }
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="삭제"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                    
                    {/* 대기 상태인 마일리지에 대해서만 승인/거절 버튼 표시 */}
                    {mileage.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => onApprove(mileage.id)}
                          className="bg-green-600 hover:bg-green-700"
                          title="승인"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onReject(mileage.id)}
                          title="거절"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {pagination && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              총 {pagination.total}개 중 {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}개 표시
            </div>
            <div className="flex space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange && onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                이전
              </Button>
              
              {[...Array(pagination.totalPages)].map((_, i) => {
                const pageNum = i + 1
                const isCurrentPage = pageNum === pagination.page
                const isVisible = 
                  pageNum === 1 ||
                  pageNum === pagination.totalPages ||
                  (pageNum >= pagination.page - 2 && pageNum <= pagination.page + 2)

                if (!isVisible) {
                  if (pageNum === pagination.page - 3 || pageNum === pagination.page + 3) {
                    return <span key={pageNum} className="px-2 text-gray-500">...</span>
                  }
                  return null
                }

                return (
                  <Button
                    key={pageNum}
                    variant={isCurrentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange && onPageChange(pageNum)}
                  >
                    {pageNum}
                  </Button>
                )
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={() => onPageChange && onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                다음
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 