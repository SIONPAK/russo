'use client'

import { useState, useCallback } from 'react'
import { UserList } from '@/features/admin/user-management/ui/user-list'
import { UserDetailModal } from '@/features/admin/user-management/ui/user-detail-modal'
import { UserEditModal } from '@/features/admin/user-management/ui/user-edit-modal'
import { useUserManagement } from '@/features/admin/user-management/model/use-user-management'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Download, Search, Filter, RefreshCw, Clock } from 'lucide-react'
import { showSuccess, showError } from '@/shared/lib/toast'

export function UsersPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [grade, setGrade] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  const {
    users,
    loading: userListLoading,
    selectedUser,
    pagination,
    approveUser,
    rejectUser,
    updateUser,
    updateCustomerGrade,
    deactivateUser,
    activateUser,
    deleteUser,
    toggleDormant,
    processDormantAccounts,
    downloadExcel,
    selectUser,
    closeUserDetail,
    refreshUsers,
    updateCompanyName,
  } = useUserManagement({
    page,
    limit: 10,
    search,
    status,
    grade,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder
  })

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    setPage(1) // 검색 시 첫 페이지로
  }, [])

  const handleStatusFilter = useCallback((newStatus: string) => {
    setStatus(newStatus)
    setPage(1) // 필터 변경 시 첫 페이지로
  }, [])

  const handleGradeFilter = useCallback((newGrade: string) => {
    setGrade(newGrade)
    setPage(1)
  }, [])

  const handleDateFromChange = useCallback((newDateFrom: string) => {
    setDateFrom(newDateFrom)
    setPage(1)
  }, [])

  const handleDateToChange = useCallback((newDateTo: string) => {
    setDateTo(newDateTo)
    setPage(1)
  }, [])

  const handleResetFilters = useCallback(() => {
    setSearch('')
    setStatus('')
    setGrade('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }, [])

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage)
  }, [])

  const handleEditUser = () => {
    setIsEditModalOpen(true)
  }

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false)
  }

  const handleExportExcel = async () => {
    try {
      setLoading(true)
      
      // 현재 필터 조건으로 모든 사용자 데이터 가져오기
      const response = await fetch(`/api/admin/users/export?${new URLSearchParams({
        search: search || '',
        status: status || '',
        grade: grade || '',
        dateFrom: dateFrom || '',
        dateTo: dateTo || ''
      })}`)
      
      if (!response.ok) {
        throw new Error('엑셀 다운로드에 실패했습니다.')
      }
      
      const result = await response.json()
      
      if (result.success) {
        // Base64 데이터를 Blob으로 변환
        const base64Data = result.data.fileData
        const byteCharacters = atob(base64Data)
        const byteNumbers = new Array(byteCharacters.length)
        
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        })
        
        // 파일 다운로드
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.href = url
        link.download = result.data.fileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        
        showSuccess('엑셀 파일이 다운로드되었습니다.')
      } else {
        throw new Error(result.error || '엑셀 다운로드에 실패했습니다.')
      }
    } catch (error) {
      console.error('엑셀 다운로드 실패:', error)
      showError(error instanceof Error ? error.message : '엑셀 다운로드 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (userListLoading && users.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">사용자 목록을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">전체 회원 관리</h1>
        <p className="text-gray-600 mt-2">전체 회원 관리 및 승인 처리</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <form onSubmit={handleSearch} className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="회사명, 대표자명, 이메일, 사업자번호 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 border-gray-200 focus:border-blue-300 focus:ring-blue-100"
              />
            </div>
          </form>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <Filter className="h-4 w-4 mr-2" />
              상세 필터
            </Button>

            <Button
              variant="outline"
              onClick={processDormantAccounts}
              className="border-orange-200 text-orange-600 hover:bg-orange-50"
            >
              <Clock className="h-4 w-4 mr-2" />
              휴면 계정 처리
            </Button>

            <Button variant="outline" onClick={refreshUsers} className="border-gray-200 text-gray-600 hover:bg-gray-50">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>

            <Button variant="outline" onClick={handleExportExcel} className="border-green-200 text-green-600 hover:bg-green-50">
              <Download className="h-4 w-4 mr-2" />
              엑셀 다운로드
            </Button>
          </div>
        </div>

        {/* 상세 필터 */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-4 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">승인 상태</label>
              <select
                value={status}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-sm"
              >
                <option value="">전체</option>
                <option value="pending">승인 대기</option>
                <option value="approved">승인 완료</option>
                <option value="rejected">반려</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">고객 등급</label>
              <select
                value={grade}
                onChange={(e) => handleGradeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-sm"
              >
                <option value="">전체</option>
                <option value="premium">우수업체</option>
                <option value="general">일반</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">가입일 시작</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">가입일 종료</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleDateToChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-sm"
              />
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={handleResetFilters} className="w-full">
                초기화
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">전체 회원</div>
          <div className="text-2xl font-bold text-gray-900">{pagination?.totalCount || 0}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">승인 대기</div>
          <div className="text-2xl font-bold text-orange-500">
            {users?.filter(u => u.approval_status === 'pending').length || 0}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">승인 완료</div>
          <div className="text-2xl font-bold text-green-500">
            {users?.filter(u => u.approval_status === 'approved').length || 0}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">우수업체</div>
          <div className="text-2xl font-bold text-blue-500">
            {users?.filter(u => u.customer_grade === 'premium').length || 0}
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm font-medium text-gray-500 mb-1">휴면 계정</div>
          <div className="text-2xl font-bold text-gray-500">
            {users?.filter(u => u.is_dormant).length || 0}
          </div>
        </div>
      </div>

      <UserList
        users={users}
        loading={userListLoading}
        onUserSelect={selectUser}
        onApprove={approveUser}
        onReject={rejectUser}
      />

      {(pagination?.totalPages || 0) > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            총 {pagination?.totalCount || 0}개 중 {((page - 1) * 10) + 1}-{Math.min(page * 10, pagination?.totalCount || 0)}개 표시
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={!pagination?.hasPrevPage}
            >
              이전
            </Button>
            
            {Array.from({ length: Math.min(5, pagination?.totalPages || 1) }, (_, i) => {
              const pageNum = Math.max(1, Math.min((pagination?.totalPages || 1) - 4, page - 2)) + i
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              )
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={!pagination?.hasNextPage}
            >
              다음
            </Button>
          </div>
        </div>
      )}

      <UserDetailModal
        user={selectedUser}
        isOpen={!!selectedUser}
        onClose={closeUserDetail}
        onApprove={approveUser}
        onReject={rejectUser}
        onDeactivate={deactivateUser}
        onActivate={activateUser}
        onDelete={deleteUser}
        onUpdateGrade={updateCustomerGrade}
        onDormantToggle={toggleDormant}
        onUpdateCompanyName={updateCompanyName}
        onEdit={handleEditUser}
      />

      <UserEditModal
        user={selectedUser}
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        onSave={updateUser}
      />
    </div>
  )
} 