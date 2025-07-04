import { useState, useEffect } from 'react'
import { Mileage } from '@/shared/types'

export function useMileageManagement() {
  const [mileages, setMileages] = useState<Mileage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMileage, setSelectedMileage] = useState<Mileage | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  const fetchMileages = async (params: {
    page?: number
    status?: string
    type?: string
    userId?: string
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

  return {
    mileages,
    loading,
    selectedMileage,
    showAddModal,
    pagination,
    approveMileage,
    rejectMileage,
    addMileage,
    selectMileage,
    closeMileageDetail,
    openAddModal,
    closeAddModal,
    fetchMileages
  }
} 