import { useState, useEffect } from 'react'
import { Mileage } from '@/shared/types'

export function useMileageManagement() {
  const [mileages, setMileages] = useState<Mileage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMileage, setSelectedMileage] = useState<Mileage | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingMileage, setEditingMileage] = useState<Mileage | null>(null)
  const [userBalances, setUserBalances] = useState<{[userId: string]: number}>({})
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [cumulativeBalances, setCumulativeBalances] = useState<{[mileageId: string]: number}>({})
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  // 시점별 누적 잔액 계산 - 전체 마일리지 내역을 고려하여 정확한 계산
  const calculateCumulativeBalances = async (currentMileages: any[]) => {
    try {
      // 현재 페이지의 사용자들의 ID 목록 생성
      const userIds = [...new Set(currentMileages.map(m => m.user_id))]
      
      const userCumulativeBalances: {[mileageId: string]: number} = {}
      
      // 각 사용자별로 전체 마일리지 내역을 조회하여 정확한 누적 잔액 계산
      for (const userId of userIds) {
        try {
          // 해당 사용자의 전체 마일리지 내역 조회 (시간순 정렬)
          const response = await fetch(`/api/admin/mileage?userId=${userId}&limit=10000&type=all&status=all`)
          const result = await response.json()
          
          if (result.success && result.data) {
            // 시간순으로 정렬 (오래된 것부터)
            const allUserMileages = result.data.sort((a: any, b: any) => 
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )
            
            let runningBalance = 0
            
            // 각 마일리지별로 누적 잔액 계산
            allUserMileages.forEach((mileage: any) => {
              // 해당 마일리지 적용 (완료된 마일리지만 계산에 포함)
              if (mileage.status === 'completed') {
                if (mileage.type === 'earn') {
                  runningBalance += Math.abs(mileage.amount)
                } else if (mileage.type === 'spend') {
                  runningBalance -= Math.abs(mileage.amount)
                }
              }
              
              // 현재 페이지에 표시된 마일리지라면 누적 잔액 저장
              const currentPageMileage = currentMileages.find(cm => cm.id === mileage.id)
              if (currentPageMileage) {
                userCumulativeBalances[mileage.id] = runningBalance
              }
            })
          }
        } catch (error) {
          console.error(`사용자 ${userId}의 마일리지 계산 오류:`, error)
        }
      }
      
      setCumulativeBalances(userCumulativeBalances)
    } catch (error) {
      console.error('누적 잔액 계산 오류:', error)
    }
  }

  // 사용자 마일리지 잔액 조회 (현재 잔액용 - 참고용)
  const fetchUserBalance = async (userId: string, companyName: string) => {
    try {
      const response = await fetch(`/api/mileage?userId=${userId}&limit=1000`)
      const result = await response.json()

      if (result.success && result.data.summary) {
        setUserBalances(prev => ({
          ...prev,
          [userId]: result.data.summary.currentBalance
        }))
        setSelectedUser(companyName)
      }
    } catch (error) {
      console.error('사용자 잔액 조회 중 오류:', error)
    }
  }

  const fetchMileages = async (params: {
    page?: number
    status?: string
    type?: string
    userId?: string
    search?: string
    source?: string
    dateFrom?: string
    dateTo?: string
  } = {}) => {
    setLoading(true)
    try {
      const searchParams = new URLSearchParams({
        page: (params.page || pagination.page).toString(),
        limit: pagination.limit.toString(),
      })

      if (params.status) searchParams.append('status', params.status)
      if (params.type) searchParams.append('type', params.type)
      if (params.userId) searchParams.append('userId', params.userId)
      if (params.search) searchParams.append('search', params.search)
      if (params.source) searchParams.append('source', params.source)
      if (params.dateFrom) searchParams.append('dateFrom', params.dateFrom)
      if (params.dateTo) searchParams.append('dateTo', params.dateTo)

      const response = await fetch(`/api/admin/mileage?${searchParams}`)
      const result = await response.json()

      if (result.success) {
        // API 응답을 Mileage 형태로 변환
        const transformedMileages = result.data.map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          type: item.type,
          amount: item.amount,
          description: item.description,
          source: item.source,
          status: item.status,
          order_id: item.order_id,
          processed_by: item.processed_by,
          created_at: item.created_at,
          updated_at: item.updated_at,
          user: item.users ? {
            id: item.users.id,
            company_name: item.users.company_name,
            representative_name: item.users.representative_name,
            email: item.users.email
          } : undefined
        }))
        
        setMileages(transformedMileages)
        setPagination(result.pagination)

        // 시점별 누적 잔액 계산
        if (transformedMileages.length > 0) {
          await calculateCumulativeBalances(transformedMileages)
        } else {
          // 결과가 없으면 잔액 정보 초기화
          setCumulativeBalances({})
          setUserBalances({})
          setSelectedUser('')
        }
      } else {
        console.error('마일리지 조회 실패:', result.error)
        setMileages([])
      }
    } catch (error) {
      console.error('마일리지 조회 중 오류:', error)
      setMileages([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMileages()
  }, [])

  const approveMileage = async (mileageId: string) => {
    try {
      const response = await fetch('/api/admin/mileage', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mileageIds: [mileageId],
          status: 'completed'
        }),
      })

      const result = await response.json()

      if (result.success) {
        await fetchMileages() // 목록 새로고침
        alert('마일리지가 승인되었습니다.')
      } else {
        alert(result.error || '마일리지 승인에 실패했습니다.')
      }
    } catch (error) {
      console.error('마일리지 승인 중 오류:', error)
      alert('마일리지 승인 중 오류가 발생했습니다.')
    }
  }

  const rejectMileage = async (mileageId: string) => {
    try {
      const response = await fetch('/api/admin/mileage', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mileageIds: [mileageId],
          status: 'cancelled'
        }),
      })

      const result = await response.json()

      if (result.success) {
        await fetchMileages() // 목록 새로고침
        alert('마일리지가 반려되었습니다.')
      } else {
        alert(result.error || '마일리지 반려에 실패했습니다.')
      }
    } catch (error) {
      console.error('마일리지 반려 중 오류:', error)
      alert('마일리지 반려 중 오류가 발생했습니다.')
    }
  }

  const addMileage = async (mileageData: {
    user_id: string
    type: 'earn' | 'spend'
    amount: number
    description: string
    source?: string
  }) => {
    try {
      const response = await fetch('/api/admin/mileage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mileageData),
      })

      const result = await response.json()

      if (result.success) {
        await fetchMileages() // 목록 새로고침
        setShowAddModal(false)
        alert('마일리지가 성공적으로 추가되었습니다.')
      } else {
        alert(result.error || '마일리지 추가에 실패했습니다.')
        throw new Error(result.error || '마일리지 추가에 실패했습니다.')
      }
    } catch (error) {
      console.error('마일리지 추가 중 오류:', error)
      alert('마일리지 추가 중 오류가 발생했습니다.')
      throw error
    }
  }

  const selectMileage = (mileage: Mileage) => {
    setSelectedMileage(mileage)
  }

  const closeMileageDetail = () => {
    setSelectedMileage(null)
  }

  const openAddModal = () => {
    setShowAddModal(true)
  }

  const closeAddModal = () => {
    setShowAddModal(false)
  }

  const openEditModal = (mileage: Mileage) => {
    setEditingMileage(mileage)
    setShowEditModal(true)
  }

  const closeEditModal = () => {
    setShowEditModal(false)
    setEditingMileage(null)
  }

  const editMileage = async (mileageId: string, mileageData: {
    type: 'earn' | 'spend'
    amount: number
    description: string
  }) => {
    try {
      const response = await fetch(`/api/admin/mileage/${mileageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mileageData),
      })

      const result = await response.json()

      if (result.success) {
        await fetchMileages() // 목록 새로고침
        setShowEditModal(false)
        setEditingMileage(null)
        alert('마일리지가 성공적으로 수정되었습니다.')
      } else {
        alert(result.error || '마일리지 수정에 실패했습니다.')
        throw new Error(result.error || '마일리지 수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('마일리지 수정 중 오류:', error)
      alert('마일리지 수정 중 오류가 발생했습니다.')
      throw error
    }
  }

  const deleteMileage = async (mileageId: string) => {
    try {
      const response = await fetch(`/api/admin/mileage/${mileageId}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (result.success) {
        await fetchMileages() // 목록 새로고침
        alert('마일리지가 성공적으로 삭제되었습니다.')
      } else {
        alert(result.error || '마일리지 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('마일리지 삭제 중 오류:', error)
      alert('마일리지 삭제 중 오류가 발생했습니다.')
    }
  }

  // 필터 변경 처리 함수 추가
  const handleFilterChange = async (filters: {
    search?: string
    status?: string
    type?: string
    source?: string
    dateFrom?: string
    dateTo?: string
  }) => {
    await fetchMileages({
      page: 1, // 필터 변경 시 첫 페이지로
      ...filters
    })
  }

  // 페이지 변경 처리 함수 추가
  const handlePageChange = async (page: number) => {
    await fetchMileages({ page })
  }

  return {
    mileages,
    loading,
    selectedMileage,
    showAddModal,
    showEditModal,
    editingMileage,
    userBalances,
    selectedUser,
    cumulativeBalances,
    pagination,
    approveMileage,
    rejectMileage,
    addMileage,
    editMileage,
    deleteMileage,
    selectMileage,
    closeMileageDetail,
    openAddModal,
    closeAddModal,
    openEditModal,
    closeEditModal,
    fetchMileages,
    handleFilterChange,
    handlePageChange
  }
} 