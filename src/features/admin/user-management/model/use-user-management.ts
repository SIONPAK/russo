import { useState, useEffect } from 'react'
import { User, PaginatedResponse } from '@/shared/types'
import { showSuccess, showError } from '@/shared/lib/toast'

interface UseUserManagementOptions {
  page?: number
  limit?: number
  search?: string
  status?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export function useUserManagement(options: UseUserManagementOptions = {}) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false
  })

  const {
    page = 1,
    limit = 10,
    search = '',
    status = '',
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = options

  const fetchUsers = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder
      })

      if (search) params.append('search', search)
      if (status) params.append('status', status)

      const response = await fetch(`/api/admin/users?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '사용자 목록을 불러오는데 실패했습니다.')
      }

      if (result.success) {
        setUsers(result.data || [])
        setPagination(result.pagination)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('사용자 목록 조회 오류:', error)
      showError(error instanceof Error ? error.message : '사용자 목록을 불러오는데 실패했습니다.')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [page, limit, search, status, sortBy, sortOrder])

  const approveUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'approve' })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '승인 처리에 실패했습니다.')
      }

      if (result.success) {
        // 사용자 목록 업데이트
        setUsers(prev => prev.map(user => 
          user.id === userId 
            ? { ...user, approval_status: 'approved' as const }
            : user
        ))
        
        // 선택된 사용자도 업데이트
        if (selectedUser?.id === userId) {
          setSelectedUser(prev => prev ? { ...prev, approval_status: 'approved' as const } : null)
        }

        showSuccess(result.message || '사용자가 승인되었습니다.')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('승인 처리 오류:', error)
      showError(error instanceof Error ? error.message : '승인 처리 중 오류가 발생했습니다.')
    }
  }

  const rejectUser = async (userId: string, reason?: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'reject', reason })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '반려 처리에 실패했습니다.')
      }

      if (result.success) {
        // 사용자 목록 업데이트
        setUsers(prev => prev.map(user => 
          user.id === userId 
            ? { ...user, approval_status: 'rejected' as const }
            : user
        ))
        
        // 선택된 사용자도 업데이트
        if (selectedUser?.id === userId) {
          setSelectedUser(prev => prev ? { ...prev, approval_status: 'rejected' as const } : null)
        }

        showSuccess(result.message || '사용자가 반려되었습니다.')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('반려 처리 오류:', error)
      showError(error instanceof Error ? error.message : '반려 처리 중 오류가 발생했습니다.')
    }
  }

  const updateUser = async (userId: string, userData: Partial<User>) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '사용자 정보 수정에 실패했습니다.')
      }

      if (result.success) {
        // 사용자 목록 업데이트
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, ...result.data } : user
        ))
        
        // 선택된 사용자도 업데이트
        if (selectedUser?.id === userId) {
          setSelectedUser(result.data)
        }

        showSuccess(result.message || '사용자 정보가 수정되었습니다.')
        return result.data
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('사용자 정보 수정 오류:', error)
      showError(error instanceof Error ? error.message : '사용자 정보 수정 중 오류가 발생했습니다.')
      throw error
    }
  }

  const deactivateUser = async (userId: string, reason?: string) => {
    try {
      await updateUser(userId, { is_active: false })
    } catch (error) {
      // updateUser에서 이미 에러 처리됨
      throw error
    }
  }

  const activateUser = async (userId: string) => {
    try {
      await updateUser(userId, { is_active: true })
    } catch (error) {
      // updateUser에서 이미 에러 처리됨
      throw error
    }
  }

  const deleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '사용자 삭제에 실패했습니다.')
      }

      if (result.success) {
        // 사용자 목록에서 제거
        setUsers(prev => prev.filter(user => user.id !== userId))
        
        // 선택된 사용자가 삭제된 사용자면 닫기
        if (selectedUser?.id === userId) {
          setSelectedUser(null)
        }

        showSuccess(result.message || '사용자가 삭제되었습니다.')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('사용자 삭제 오류:', error)
      showError(error instanceof Error ? error.message : '사용자 삭제 중 오류가 발생했습니다.')
      throw error
    }
  }

  const selectUser = (user: User) => {
    setSelectedUser(user)
  }

  const closeUserDetail = () => {
    setSelectedUser(null)
  }

  const refreshUsers = () => {
    fetchUsers()
  }

  return {
    users,
    loading,
    selectedUser,
    pagination,
    approveUser,
    rejectUser,
    updateUser,
    deactivateUser,
    activateUser,
    deleteUser,
    selectUser,
    closeUserDetail,
    refreshUsers
  }
} 