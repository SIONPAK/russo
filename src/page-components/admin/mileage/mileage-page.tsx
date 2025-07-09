'use client'

import { useState, useEffect } from 'react'
import { MileageList } from '@/features/admin/mileage-management/ui/mileage-list'
import { AddMileageModal } from '@/features/admin/mileage-management/ui/add-mileage-modal'
import { useMileageManagement } from '@/features/admin/mileage-management/model/use-mileage-management'
import { Button } from '@/shared/ui/button'
import { Plus, Settings, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

export function MileagePage() {
  const {
    mileages,
    loading,
    selectedMileage,
    showAddModal,
    showEditModal,
    editingMileage,
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
    fetchMileages
  } = useMileageManagement()

  const [bankdaSettings, setBankdaSettings] = useState({
    auto_sync: false,
    last_sync: null,
    sync_interval: 24 // 시간 단위
  })
  const [failureLogs, setFailureLogs] = useState([])
  const [showLogs, setShowLogs] = useState(false)
  const [logsLoading, setLogsLoading] = useState(false)
  const [logStatus, setLogStatus] = useState('pending') // 'pending', 'resolved', 'all'

  // 뱅크다 설정 조회
  const fetchBankdaSettings = async () => {
    try {
      const response = await fetch('/api/admin/bankda/settings')
      const result = await response.json()
      if (result.success) {
        setBankdaSettings(result.data)
      }
    } catch (error) {
      console.error('뱅크다 설정 조회 오류:', error)
    }
  }

  // 실패 로그 조회
  const fetchFailureLogs = async () => {
    setLogsLoading(true)
    try {
      const response = await fetch(`/api/admin/mileage/logs?type=failure&status=${logStatus}`)
      const result = await response.json()
      if (result.success) {
        setFailureLogs(result.data)
      }
    } catch (error) {
      console.error('실패 로그 조회 오류:', error)
    } finally {
      setLogsLoading(false)
    }
  }

  // 로그 상태 업데이트
  const updateLogStatus = async (logId: string, status: string) => {
    try {
      const response = await fetch('/api/admin/mileage/logs', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logId, status })
      })

      const result = await response.json()
      if (result.success) {
        alert(result.message)
        fetchFailureLogs() // 목록 새로고침
      } else {
        alert('상태 업데이트에 실패했습니다: ' + result.error)
      }
    } catch (error) {
      console.error('상태 업데이트 오류:', error)
      alert('상태 업데이트 중 오류가 발생했습니다.')
    }
  }

  // 로그 삭제
  const deleteLog = async (logId: string) => {
    if (!confirm('이 로그를 삭제하시겠습니까?')) return

    try {
      const response = await fetch('/api/admin/mileage/logs', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logId })
      })

      const result = await response.json()
      if (result.success) {
        alert(result.message)
        fetchFailureLogs() // 목록 새로고침
      } else {
        alert('삭제에 실패했습니다: ' + result.error)
      }
    } catch (error) {
      console.error('삭제 오류:', error)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  // 뱅크다 자동화 토글
  const toggleBankdaAutoSync = async () => {
    try {
      const response = await fetch('/api/admin/bankda/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auto_sync: !bankdaSettings.auto_sync
        }),
      })

      const result = await response.json()
      if (result.success) {
        setBankdaSettings(prev => ({
          ...prev,
          auto_sync: !prev.auto_sync
        }))
        alert(`뱅크다 자동화가 ${!bankdaSettings.auto_sync ? '활성화' : '비활성화'}되었습니다.`)
      } else {
        alert('설정 변경에 실패했습니다.')
      }
    } catch (error) {
      console.error('뱅크다 설정 변경 오류:', error)
      alert('설정 변경 중 오류가 발생했습니다.')
    }
  }

  // 뱅크다 테스트 동기화
  const testBankdaSync = async () => {
    if (!confirm('뱅크다 테스트 동기화를 실행하시겠습니까?')) return

    try {
      const response = await fetch('/api/admin/bankda/test-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()
      if (result.success) {
        alert(result.message)
        // 마일리지 목록 새로고침
        window.location.reload()
      } else {
        alert('테스트 동기화에 실패했습니다.')
      }
    } catch (error) {
      console.error('뱅크다 테스트 동기화 오류:', error)
      alert('테스트 동기화 중 오류가 발생했습니다.')
    }
  }



  useEffect(() => {
    fetchBankdaSettings()
  }, [])

  useEffect(() => {
    if (showLogs) {
      fetchFailureLogs()
    }
  }, [showLogs, logStatus])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">마일리지 내역을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">마일리지 관리</h1>
        <p className="text-gray-600 mt-2">마일리지 적립/차감 내역 관리 및 수동 처리</p>
      </div>

      {/* 뱅크다 자동화 설정 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          뱅크다 자동화 설정
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">자동 동기화</h3>
              <p className="text-sm text-gray-500">뱅크다 자동 적립 활성화</p>
            </div>
            <button
              onClick={toggleBankdaAutoSync}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                bankdaSettings.auto_sync ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  bankdaSettings.auto_sync ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">상태</h3>
            <div className="flex items-center">
              {bankdaSettings.auto_sync ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mr-2" />
              )}
              <span className={`text-sm ${bankdaSettings.auto_sync ? 'text-green-600' : 'text-red-600'}`}>
                {bankdaSettings.auto_sync ? '활성화됨' : '비활성화됨'}
              </span>
            </div>
            {bankdaSettings.last_sync && (
              <p className="text-xs text-gray-500 mt-1">
                마지막 동기화: {new Date(bankdaSettings.last_sync).toLocaleString('ko-KR')}
              </p>
            )}
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">테스트</h3>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={testBankdaSync}
              className="w-full"
            >
              테스트 동기화
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              테스트 데이터로 동기화 테스트
            </p>
          </div>
        </div>
      </div>

      {/* 실패 로그 섹션 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
            뱅크다 동기화 실패 로그
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLogs(!showLogs)}
          >
            {showLogs ? '숨기기' : '로그 보기'}
          </Button>
        </div>

        {showLogs && (
          <div className="space-y-4">
            {/* 상태 필터 */}
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-700">상태:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setLogStatus('pending')}
                  className={`px-3 py-1 text-xs rounded-full ${
                    logStatus === 'pending' 
                      ? 'bg-orange-100 text-orange-800 border border-orange-300' 
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}
                >
                  대기중
                </button>
                <button
                  onClick={() => setLogStatus('resolved')}
                  className={`px-3 py-1 text-xs rounded-full ${
                    logStatus === 'resolved' 
                      ? 'bg-green-100 text-green-800 border border-green-300' 
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}
                >
                  해결완료
                </button>
                <button
                  onClick={() => setLogStatus('all')}
                  className={`px-3 py-1 text-xs rounded-full ${
                    logStatus === 'all' 
                      ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}
                >
                  전체
                </button>
              </div>
            </div>

            {logsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">로그를 불러오는 중...</p>
              </div>
            ) : failureLogs.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {failureLogs.map((log: any, index) => (
                    <div key={index} className="p-3 bg-white border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              log.status === 'resolved' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-orange-100 text-orange-800'
                            }`}>
                              {log.status === 'resolved' ? '해결완료' : '대기중'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(log.created_at).toLocaleString('ko-KR')}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-800">
                            {log.business_name} | {log.amount?.toLocaleString()}원
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            {log.error_message || '알 수 없는 오류'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          {log.status !== 'resolved' && (
                            <button
                              onClick={() => updateLogStatus(log.id, 'resolved')}
                              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              해결완료
                            </button>
                          )}
                          {log.status === 'resolved' && (
                            <button
                              onClick={() => updateLogStatus(log.id, 'pending')}
                              className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                            >
                              대기중으로
                            </button>
                          )}
                          <button
                            onClick={() => deleteLog(log.id)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>
                  {logStatus === 'pending' ? '대기중인' : logStatus === 'resolved' ? '해결완료된' : ''} 
                  실패 로그가 없습니다.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-end mb-6">
        <Button onClick={openAddModal}>
          <Plus className="h-4 w-4 mr-2" />
          수동 등록
        </Button>
      </div>

      <MileageList
        mileages={mileages}
        onMileageSelect={selectMileage}
        onApprove={approveMileage}
        onReject={rejectMileage}
        onAddMileage={openAddModal}
        onEdit={openEditModal}
        onDelete={deleteMileage}
        pagination={pagination}
        onPageChange={(page) => fetchMileages({ page })}
        onFilterChange={(filters) => fetchMileages({ page: 1, ...filters })}
      />

      <AddMileageModal
        isOpen={showAddModal}
        onClose={closeAddModal}
        onSubmit={addMileage}
      />

      {/* 수정 모달 */}
      {editingMileage && (
        <AddMileageModal
          isOpen={showEditModal}
          onClose={closeEditModal}
          onSubmit={(data) => editMileage(editingMileage.id, data)}
          initialData={{
            user_id: editingMileage.user_id,
            type: editingMileage.type,
            amount: Math.abs(editingMileage.amount),
            description: editingMileage.description,
            user: editingMileage.user
          }}
          title="마일리지 수정"
        />
      )}
    </div>
  )
} 