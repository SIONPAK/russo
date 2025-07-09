'use client'

import { useState, useEffect } from 'react'
import { User, PaginatedResponse } from '@/shared/types'
import { showSuccess, showError } from '@/shared/lib/toast'
import { getKoreaDate } from '@/shared/lib/utils'

interface UseUserManagementOptions {
  page?: number
  limit?: number
  search?: string
  status?: string
  grade?: string
  dateFrom?: string
  dateTo?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

interface UserFilters {
  search: string
  status: string
  grade: string
  dateFrom: string
  dateTo: string
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
  
  const [filters, setFilters] = useState<UserFilters>({
    search: options.search || '',
    status: options.status || '',
    grade: options.grade || '',
    dateFrom: options.dateFrom || '',
    dateTo: options.dateTo || ''
  })

  const {
    page = 1,
    limit = 10,
    search = filters.search,
    status = filters.status,
    grade = filters.grade,
    dateFrom = filters.dateFrom,
    dateTo = filters.dateTo,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = options

  const fetchUsers = async (currentPage?: number) => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: (currentPage || page).toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder
      })

      if (search) params.append('search', search)
      if (status) params.append('status', status)
      if (grade) params.append('grade', grade)
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)

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
  }, [page, limit, search, status, grade, dateFrom, dateTo, sortBy, sortOrder])

  const approveUser = async (userId: string, notes?: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'approve', notes })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '승인 처리에 실패했습니다.')
      }

      if (result.success) {
        // 사용자 목록 업데이트
        setUsers(prev => prev.map(user => 
          user.id === userId 
            ? { ...user, approval_status: 'approved' as const, is_active: true }
            : user
        ))
        
        // 선택된 사용자도 업데이트
        if (selectedUser?.id === userId) {
          setSelectedUser(prev => prev ? { ...prev, approval_status: 'approved' as const, is_active: true } : null)
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
            ? { ...user, approval_status: 'rejected' as const, is_active: false }
            : user
        ))
        
        // 선택된 사용자도 업데이트
        if (selectedUser?.id === userId) {
          setSelectedUser(prev => prev ? { ...prev, approval_status: 'rejected' as const, is_active: false } : null)
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

  const updateCustomerGrade = async (userId: string, grade: 'premium' | 'general') => {
    try {
      await updateUser(userId, { customer_grade: grade })
      const gradeText = grade === 'premium' ? '우수업체' : '일반'
      showSuccess(`고객 등급이 '${gradeText}'로 변경되었습니다.`)
    } catch (error) {
      throw error
    }
  }

  const deactivateUser = async (userId: string, reason?: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/deactivate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '사용자 비활성화에 실패했습니다.')
      }

      if (result.success) {
        // 사용자 목록 업데이트
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, is_active: false } : user
        ))
        
        // 선택된 사용자도 업데이트
        if (selectedUser?.id === userId) {
          setSelectedUser(prev => prev ? { ...prev, is_active: false } : null)
        }

        showSuccess(result.message || '사용자가 비활성화되었습니다.')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('사용자 비활성화 오류:', error)
      showError(error instanceof Error ? error.message : '사용자 비활성화 중 오류가 발생했습니다.')
      throw error
    }
  }

  const activateUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '사용자 활성화에 실패했습니다.')
      }

      if (result.success) {
        // 사용자 목록 업데이트
        setUsers(prev => prev.map(user => 
          user.id === userId ? { ...user, is_active: true, is_dormant: false } : user
        ))
        
        // 선택된 사용자도 업데이트
        if (selectedUser?.id === userId) {
          setSelectedUser(prev => prev ? { ...prev, is_active: true, is_dormant: false } : null)
        }

        showSuccess(result.message || '사용자가 활성화되었습니다.')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('사용자 활성화 오류:', error)
      showError(error instanceof Error ? error.message : '사용자 활성화 중 오류가 발생했습니다.')
      throw error
    }
  }

  const toggleDormant = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/dormant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '휴면 처리에 실패했습니다.')
      }

      if (result.success) {
        // 사용자 목록 업데이트
        setUsers(prev => prev.map(user => 
          user.id === userId ? result.data : user
        ))
        
        // 선택된 사용자도 업데이트
        if (selectedUser?.id === userId) {
          setSelectedUser(result.data)
        }

        showSuccess(result.message || '휴면 처리가 완료되었습니다.')
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('휴면 처리 오류:', error)
      showError(error instanceof Error ? error.message : '휴면 처리 중 오류가 발생했습니다.')
      throw error
    }
  }

  const processDormantAccounts = async () => {
    try {
      const response = await fetch('/api/admin/users/dormant-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '휴면 계정 처리에 실패했습니다.')
      }

      if (result.success) {
        showSuccess(result.message || `${result.count}개의 계정이 휴면 처리되었습니다.`)
        fetchUsers() // 목록 새로고침
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('휴면 계정 처리 오류:', error)
      showError(error instanceof Error ? error.message : '휴면 계정 처리 중 오류가 발생했습니다.')
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

  const downloadExcel = async () => {
    try {
      const response = await fetch('/api/admin/users/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          search,
          status,
          grade,
          dateFrom,
          dateTo
        })
      })

      if (!response.ok) {
        throw new Error('엑셀 다운로드에 실패했습니다.')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users_${getKoreaDate()}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      showSuccess('엑셀 파일이 다운로드되었습니다.')
    } catch (error) {
      console.error('엑셀 다운로드 오류:', error)
      showError(error instanceof Error ? error.message : '엑셀 다운로드 중 오류가 발생했습니다.')
    }
  }

  const updateFilters = (newFilters: Partial<UserFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  const performSearch = () => {
    fetchUsers(1)
  }

  const resetFilters = () => {
    setFilters({
      search: '',
      status: '',
      grade: '',
      dateFrom: '',
      dateTo: ''
    })
  }

  const setCurrentPage = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }))
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
    filters,
    currentPage: pagination.currentPage,
    totalPages: pagination.totalPages,
    totalUsers: pagination.totalCount,
    fetchUsers,
    approveUser,
    rejectUser,
    updateUser,
    updateCustomerGrade,
    deactivateUser,
    activateUser,
    toggleDormant,
    processDormantAccounts,
    deleteUser,
    downloadExcel,
    updateFilters,
    performSearch,
    resetFilters,
    setCurrentPage,
    selectUser,
    closeUserDetail,
    refreshUsers
  }
} 