'use client'

import { useState } from 'react'
import { UserList } from '@/features/admin/user-management/ui/user-list'
import { UserDetailModal } from '@/features/admin/user-management/ui/user-detail-modal'
import { useUserManagement } from '@/features/admin/user-management/model/use-user-management'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Download, Search, Filter } from 'lucide-react'

export function UsersPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const {
    users,
    loading,
    selectedUser,
    pagination,
    approveUser,
    rejectUser,
    deactivateUser,
    activateUser,
    deleteUser,
    selectUser,
    closeUserDetail,
    refreshUsers,
  } = useUserManagement({
    page,
    limit: 10,
    search,
    status,
    sortBy,
    sortOrder
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1) // 검색 시 첫 페이지로
  }

  const handleStatusFilter = (newStatus: string) => {
    setStatus(newStatus)
    setPage(1) // 필터 변경 시 첫 페이지로
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleExportExcel = () => {
    // TODO: 엑셀 다운로드 구현
    console.log('엑셀 다운로드')
  }

  if (loading && users.length === 0) {
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
            <select
              value={status}
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-sm"
            >
              <option value="">전체 상태</option>
              <option value="pending">승인 대기</option>
              <option value="approved">승인 완료</option>
              <option value="rejected">반려</option>
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-')
                setSortBy(newSortBy)
                setSortOrder(newSortOrder as 'asc' | 'desc')
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-sm"
            >
              <option value="created_at-desc">최신 가입순</option>
              <option value="created_at-asc">오래된 가입순</option>
              <option value="company_name-asc">회사명 순</option>
              <option value="representative_name-asc">대표자명 순</option>
            </select>

            <Button variant="outline" onClick={refreshUsers} className="border-gray-200 text-gray-600 hover:bg-gray-50">
              <Filter className="h-4 w-4 mr-2" />
              새로고침
            </Button>

            <Button variant="outline" onClick={handleExportExcel} className="border-gray-200 text-gray-600 hover:bg-gray-50">
              <Download className="h-4 w-4 mr-2" />
              엑셀 다운로드
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
          <div className="text-sm font-medium text-gray-500 mb-1">승인 거부</div>
          <div className="text-2xl font-bold text-red-500">
            {users?.filter(u => u.approval_status === 'rejected').length || 0}
          </div>
        </div>
      </div>

      <UserList
        users={users}
        loading={loading}
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
      />
    </div>
  )
} 