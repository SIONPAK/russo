'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { formatCurrency, formatDateTime } from '@/shared/lib/utils'
import { downloadSampleShippingExcel } from '@/shared/lib/excel-utils'
import { 
  Search, 
  Filter, 
  Eye,
  Send,
  Undo,
  Download,
  Plus,
  Package,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Upload,
  FileText,
  X
} from 'lucide-react'

export function SamplesPage() {
  const [samples, setSamples] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })
  const [filters, setFilters] = useState({
    search: '',
    status: 'all'
  })
  const [selectedSamples, setSelectedSamples] = useState<string[]>([])
  const [showTrackingModal, setShowTrackingModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [selectedSampleDetail, setSelectedSampleDetail] = useState<any>(null)
  
  const fetchSamples = async (params: {
    page?: number
    status?: string
    search?: string
  } = {}) => {
    setLoading(true)
    try {
      const searchParams = new URLSearchParams({
        page: (params.page || pagination.page).toString(),
        limit: pagination.limit.toString(),
      })

      if (params.status && params.status !== 'all') searchParams.append('status', params.status)
      if (params.search) searchParams.append('search', params.search)

      const response = await fetch(`/api/admin/samples?${searchParams}`)
      const result = await response.json()

      if (result.success) {
        setSamples(result.data || [])
        setPagination(result.pagination)
      } else {
        console.error('샘플 조회 실패:', result.error)
        setSamples([])
      }
    } catch (error) {
      console.error('샘플 조회 중 오류:', error)
      setSamples([])
    } finally {
      setLoading(false)
    }
  }

  const handleBulkStatusUpdate = async (status: string, trackingData?: { sampleId: string, trackingNumber: string }[]) => {
    try {
      const response = await fetch('/api/admin/samples', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'bulk_status_update',
          sampleIds: selectedSamples,
          status,
          trackingData
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert(`${selectedSamples.length}개 샘플의 상태가 업데이트되었습니다.`)
        await fetchSamples(filters)
        setSelectedSamples([])
        setShowTrackingModal(false)
      } else {
        alert(result.error || '상태 업데이트에 실패했습니다.')
      }
    } catch (error) {
      console.error('일괄 상태 업데이트 중 오류:', error)
      alert('상태 업데이트 중 오류가 발생했습니다.')
    }
  }

  const handleStatusUpdate = async (sampleId: string, newStatus: string, trackingNumber?: string) => {
    try {
      const response = await fetch('/api/admin/samples', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sampleId,
          status: newStatus,
          trackingNumber,
          outgoingDate: newStatus === 'shipped' ? new Date().toISOString() : undefined
        }),
      })

      const result = await response.json()

      if (result.success) {
        alert('샘플 상태가 업데이트되었습니다.')
        await fetchSamples(filters)
      } else {
        alert(result.error || '상태 업데이트에 실패했습니다.')
      }
    } catch (error) {
      console.error('상태 업데이트 중 오류:', error)
      alert('상태 업데이트 중 오류가 발생했습니다.')
    }
  }

  // 개별 상태 변경 함수들
  const handleApprove = async (sampleId: string) => {
    console.log('handleApprove called with:', sampleId)
    if (confirm('이 샘플 요청을 승인하시겠습니까?')) {
      await handleStatusUpdate(sampleId, 'approved')
    }
  }

  const handleReject = async (sampleId: string) => {
    console.log('handleReject called with:', sampleId)
    if (confirm('이 샘플 요청을 거절하시겠습니까?')) {
      await handleStatusUpdate(sampleId, 'rejected')
    }
  }

  const handlePrepare = async (sampleId: string) => {
    console.log('handlePrepare called with:', sampleId)
    if (confirm('이 샘플을 준비 상태로 변경하시겠습니까?')) {
      await handleStatusUpdate(sampleId, 'preparing')
    }
  }

  const handleShip = async (sampleId: string) => {
    console.log('handleShip called with:', sampleId)
    const trackingNumber = prompt('운송장 번호를 입력하세요:')
    if (trackingNumber) {
      await handleStatusUpdate(sampleId, 'shipped', trackingNumber)
    }
  }

  const handleDeliver = async (sampleId: string) => {
    console.log('handleDeliver called with:', sampleId)
    if (confirm('이 샘플을 배송완료 상태로 변경하시겠습니까?')) {
      await handleStatusUpdate(sampleId, 'delivered')
    }
  }

  const handleReturn = async (sampleId: string) => {
    console.log('handleReturn called with:', sampleId)
    if (confirm('이 샘플을 회수완료 상태로 변경하시겠습니까?')) {
      await handleStatusUpdate(sampleId, 'returned')
    }
  }

  // 상세보기 함수
  const handleViewDetail = (sample: any) => {
    console.log('handleViewDetail called with:', sample)
    setSelectedSampleDetail(sample)
    setShowDetailModal(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-orange-600 bg-orange-100'
      case 'approved': return 'text-blue-600 bg-blue-100'
      case 'preparing': return 'text-yellow-600 bg-yellow-100'
      case 'shipped': return 'text-purple-600 bg-purple-100'
      case 'delivered': return 'text-green-600 bg-green-100'
      case 'returned': return 'text-green-600 bg-green-100'
      case 'overdue': return 'text-red-600 bg-red-100'
      case 'charged': return 'text-purple-600 bg-purple-100'
      case 'rejected': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '승인 대기'
      case 'approved': return '승인됨'
      case 'preparing': return '배송 준비'
      case 'shipped': return '배송 중'
      case 'delivered': return '배송 완료'
      case 'returned': return '회수 완료'
      case 'overdue': return '기한 초과'
      case 'charged': return '청구 완료'
      case 'rejected': return '거절됨'
      default: return status
    }
  }

  const getDaysRemainingColor = (days: number) => {
    if (days > 7) return 'text-green-600'
    if (days > 3) return 'text-yellow-600'
    if (days > 0) return 'text-orange-600'
    return 'text-red-600'
  }

  // 초기 데이터 로드
  useEffect(() => {
    fetchSamples()
  }, [])

  // 필터 변경 시 자동 검색 (상태 변경만)
  useEffect(() => {
    if (filters.status !== 'all') {
      fetchSamples({ ...filters, page: 1 })
    } else {
      fetchSamples({ search: filters.search, page: 1 })
    }
  }, [filters.status])

  const handleSearch = () => {
    fetchSamples(filters)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSamples(samples.map(s => s.id))
    } else {
      setSelectedSamples([])
    }
  }

  const handleSelectSample = (sampleId: string, checked: boolean) => {
    if (checked) {
      setSelectedSamples([...selectedSamples, sampleId])
    } else {
      setSelectedSamples(selectedSamples.filter(id => id !== sampleId))
    }
  }

  // 배송 정보 엑셀 다운로드 함수
  const handleDownloadShippingExcel = () => {
    try {
      downloadSampleShippingExcel(samples)
      alert('샘플 배송 정보가 다운로드되었습니다.')
    } catch (error) {
      console.error('Sample shipping Excel download error:', error)
      alert('배송 정보 다운로드 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">샘플 관리</h1>
          <p className="text-gray-600">촬영용 샘플 출고 및 회수 관리</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={handleDownloadShippingExcel}>
            <Download className="h-4 w-4 mr-2" />
            배송 정보 다운로드
          </Button>
          <Button variant="outline" onClick={() => setShowTrackingModal(true)}>
            <Upload className="h-4 w-4 mr-2" />
            운송장 일괄 등록
          </Button>
          <Button>
            <Package className="h-4 w-4 mr-2" />
            일괄 처리
          </Button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">승인 대기</p>
              <p className="text-2xl font-bold text-blue-600">
                {samples.filter(s => s.status === 'pending').length}건
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-purple-500">
          <div className="flex items-center">
            <Send className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">배송 중</p>
              <p className="text-2xl font-bold text-purple-600">
                {samples.filter(s => s.status === 'shipped').length}건
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">기한 초과</p>
              <p className="text-2xl font-bold text-red-600">
                {samples.filter(s => s.status === 'overdue').length}건
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">회수 완료</p>
              <p className="text-2xl font-bold text-green-600">
                {samples.filter(s => s.status === 'returned').length}건
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="샘플번호, 고객명, 상품명 검색"
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="pl-10 border-gray-200 focus:border-blue-300 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <select 
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300 text-sm"
            >
              <option value="all">전체 상태</option>
              <option value="pending">승인 대기</option>
              <option value="approved">승인됨</option>
              <option value="preparing">배송 준비</option>
              <option value="shipped">배송 중</option>
              <option value="delivered">배송 완료</option>
              <option value="returned">회수 완료</option>
              <option value="overdue">기한 초과</option>
              <option value="charged">청구 완료</option>
              <option value="rejected">거절됨</option>
            </select>

            <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
              <Search className="h-4 w-4 mr-2" />
              검색
            </Button>
          </div>
        </div>
      </div>

      {/* 일괄 처리 버튼 */}
      {selectedSamples.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-blue-800 font-medium">
              {selectedSamples.length}개 샘플 선택됨
            </span>
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkStatusUpdate('approved')}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                일괄 승인
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkStatusUpdate('preparing')}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                일괄 준비
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkStatusUpdate('delivered')}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                일괄 배송완료
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkStatusUpdate('returned')}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                일괄 회수
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 샘플 목록 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-12 px-4 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={selectedSamples.length === samples.length && samples.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="w-64 px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  샘플 정보
                </th>
                <th className="w-32 px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  고객
                </th>
                <th className="w-28 px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  주문일
                </th>
                <th className="w-24 px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  남은 기간
                </th>
                <th className="w-20 px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="w-28 px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  운송장
                </th>
                <th className="w-32 px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {samples.map((sample) => (
                <tr key={sample.id} className="hover:bg-gray-50">
                  <td className="w-12 px-4 py-4">
                    <input
                      type="checkbox"
                      checked={selectedSamples.includes(sample.id)}
                      onChange={(e) => handleSelectSample(sample.id, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="w-64 px-4 py-4">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-900 break-words">
                        {sample.sample_number}
                      </div>
                      <div className="text-sm text-gray-500 break-words line-clamp-2">
                        {sample.product_name}
                      </div>
                      <div className="text-xs text-gray-400 break-words">
                        {sample.product_options} × {sample.quantity}개
                      </div>
                    </div>
                  </td>
                  <td className="w-32 px-4 py-4">
                    <div className="text-sm font-medium text-gray-900 break-words">
                      {sample.customer_name}
                    </div>
                  </td>
                  <td className="w-28 px-4 py-4">
                    <div className="text-sm text-gray-900 break-words">
                      {sample.created_at ? formatDateTime(sample.created_at) : '-'}
                    </div>
                  </td>
                  <td className="w-24 px-4 py-4">
                    <div className={`text-sm break-words ${getDaysRemainingColor(sample.days_remaining || 0)}`}>
                      {sample.outgoing_date ? (
                        sample.days_remaining > 0 ? `${sample.days_remaining}일 남음` :
                        sample.days_remaining === 0 ? '오늘 마감' : `${Math.abs(sample.days_remaining)}일 초과`
                      ) : '-'}
                    </div>
                  </td>
                  <td className="w-20 px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sample.status)}`}>
                      {getStatusText(sample.status)}
                    </span>
                  </td>
                  <td className="w-28 px-4 py-4">
                    <div className="text-sm text-gray-900 break-words">
                      {sample.tracking_number || '-'}
                    </div>
                  </td>
                  <td className="w-32 px-4 py-4 text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {/* 상태 변경 드롭다운 */}
                      <select
                        value={sample.status}
                        onChange={(e) => {
                          const newStatus = e.target.value
                          if (newStatus === sample.status) return
                          
                          if (newStatus === 'shipped') {
                            const trackingNumber = prompt('운송장 번호를 입력하세요:')
                            if (trackingNumber) {
                              handleStatusUpdate(sample.id, newStatus, trackingNumber)
                            }
                          } else {
                            const statusLabels: {[key: string]: string} = {
                              'pending': '승인 대기',
                              'approved': '승인됨', 
                              'preparing': '배송 준비',
                              'shipped': '배송 중',
                              'delivered': '배송 완료',
                              'returned': '회수 완료',
                              'rejected': '거절됨'
                            }
                            if (confirm(`상태를 "${statusLabels[newStatus]}"로 변경하시겠습니까?`)) {
                              handleStatusUpdate(sample.id, newStatus)
                            }
                          }
                        }}
                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="pending">승인 대기</option>
                        <option value="approved">승인됨</option>
                        <option value="preparing">배송 준비</option>
                        <option value="shipped">배송 중</option>
                        <option value="delivered">배송 완료</option>
                        <option value="returned">회수 완료</option>
                        <option value="rejected">거절됨</option>
                      </select>
                      
                      {/* 상세보기 버튼 */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-600 hover:bg-gray-50 p-1 h-7 w-7"
                        onClick={() => handleViewDetail(sample)}
                        title="상세보기"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* 로딩 상태 */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {/* 데이터 없음 */}
        {!loading && samples.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">등록된 샘플이 없습니다.</p>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSamples({ ...filters, page: pagination.page - 1 })}
            disabled={pagination.page <= 1}
            className="text-gray-600 border-gray-200"
          >
            이전
          </Button>
          
          <div className="flex space-x-1">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const page = i + 1
              return (
                <Button
                  key={page}
                  variant={pagination.page === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => fetchSamples({ ...filters, page })}
                  className={pagination.page === page ? "bg-blue-600 text-white" : "text-gray-600 border-gray-200"}
                >
                  {page}
                </Button>
              )
            })}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSamples({ ...filters, page: pagination.page + 1 })}
            disabled={pagination.page >= pagination.totalPages}
            className="text-gray-600 border-gray-200"
          >
            다음
          </Button>
        </div>
      )}

      {/* 운송장 일괄 등록 모달 */}
      {showTrackingModal && (
        <TrackingBulkModal
          selectedSamples={selectedSamples}
          samples={samples}
          onClose={() => setShowTrackingModal(false)}
          onSubmit={handleBulkStatusUpdate}
        />
      )}

      {/* 샘플 상세보기 모달 */}
      {showDetailModal && selectedSampleDetail && (
        <SampleDetailModal
          sample={selectedSampleDetail}
          onClose={() => {
            setShowDetailModal(false)
            setSelectedSampleDetail(null)
          }}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
    </div>
  )
}

// 샘플 상세보기 모달 컴포넌트
function SampleDetailModal({ sample, onClose, onStatusUpdate }: any) {
  const [adminNotes, setAdminNotes] = useState(sample.admin_notes || '')

  const handleSaveNotes = async () => {
    try {
      const response = await fetch('/api/admin/samples', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sampleId: sample.id,
          status: sample.status,
          adminNotes
        }),
      })

      const result = await response.json()
      if (result.success) {
        alert('관리자 메모가 저장되었습니다.')
      } else {
        alert('메모 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('메모 저장 중 오류:', error)
      alert('메모 저장 중 오류가 발생했습니다.')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-800'
      case 'approved': return 'bg-blue-100 text-blue-800'
      case 'preparing': return 'bg-yellow-100 text-yellow-800'
      case 'shipped': return 'bg-purple-100 text-purple-800'
      case 'delivered': return 'bg-green-100 text-green-800'
      case 'returned': return 'bg-green-100 text-green-800'
      case 'overdue': return 'bg-red-100 text-red-800'
      case 'charged': return 'bg-purple-100 text-purple-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '승인 대기'
      case 'approved': return '승인됨'
      case 'preparing': return '배송 준비'
      case 'shipped': return '배송 중'
      case 'delivered': return '배송 완료'
      case 'returned': return '회수 완료'
      case 'overdue': return '기한 초과'
      case 'charged': return '청구 완료'
      case 'rejected': return '거절됨'
      default: return status
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold">샘플 상세 정보</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3">기본 정보</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">샘플 번호:</span>
                  <span className="font-medium">{sample.sample_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">샘플 유형:</span>
                  <span className="font-medium">
                    {sample.sample_type === 'photography' ? '촬영용 (무료)' : '판매용 (유료)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">상태:</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sample.status)}`}>
                    {getStatusText(sample.status)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">생성일:</span>
                  <span className="font-medium">{formatDateTime(sample.created_at)}</span>
                </div>
              </div>
            </div>

            {/* 고객 정보 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3">고객 정보</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">회사명:</span>
                  <span className="font-medium">{sample.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">고객 ID:</span>
                  <span className="font-medium text-xs">{sample.customer_id}</span>
                </div>
              </div>
            </div>

            {/* 배송 정보 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3">배송 정보</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">주문일:</span>
                  <span className="font-medium">
                    {sample.created_at ? formatDateTime(sample.created_at) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">운송장 번호:</span>
                  <span className="font-medium">{sample.tracking_number || '-'}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-gray-600">배송 주소:</span>
                  <div className="font-medium text-sm bg-white p-2 rounded border">
                    {sample.delivery_address || '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 상품 정보 */}
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3">상품 정보</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">상품명:</span>
                  <span className="font-medium">{sample.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">옵션:</span>
                  <span className="font-medium">{sample.product_options || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">수량:</span>
                  <span className="font-medium">{sample.quantity}개</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">청구 금액:</span>
                  <span className="font-medium">
                    {sample.sample_type === 'photography' ? '₩0 (무료)' : `₩${sample.charge_amount?.toLocaleString() || '0'}`}
                  </span>
                </div>
              </div>
            </div>

            {/* 일정 정보 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3">일정 정보</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">승인일:</span>
                  <span className="font-medium">
                    {sample.approved_at ? formatDateTime(sample.approved_at) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">배송일:</span>
                  <span className="font-medium">
                    {sample.shipped_at ? formatDateTime(sample.shipped_at) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">배송완료일:</span>
                  <span className="font-medium">
                    {sample.delivered_at ? formatDateTime(sample.delivered_at) : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">반납일:</span>
                  <span className="font-medium">
                    {sample.return_date ? formatDateTime(sample.return_date) : '-'}
                  </span>
                </div>
              </div>
            </div>

            {/* 메모 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3">메모</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600">고객 메모:</label>
                  <p className="text-sm bg-white p-2 rounded border mt-1">
                    {sample.notes || '없음'}
                  </p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">관리자 메모:</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="w-full p-2 border rounded mt-1 text-sm"
                    rows={3}
                    placeholder="관리자 메모를 입력하세요..."
                  />
                  <Button 
                    size="sm" 
                    onClick={handleSaveNotes}
                    className="mt-2 bg-blue-600 hover:bg-blue-700"
                  >
                    메모 저장
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          {sample.status === 'pending' && (
            <>
              <Button 
                onClick={() => {
                  onStatusUpdate(sample.id, 'approved')
                  onClose()
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                승인
              </Button>
              <Button 
                onClick={() => {
                  onStatusUpdate(sample.id, 'rejected')
                  onClose()
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                거절
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// 운송장 일괄 등록 모달 컴포넌트
function TrackingBulkModal({ selectedSamples, samples, onClose, onSubmit }: any) {
  const [trackingData, setTrackingData] = useState<{[key: string]: string}>({})

  const selectedSampleData = samples.filter((s: any) => selectedSamples.includes(s.id))

  const handleSubmit = () => {
    const trackingArray = Object.entries(trackingData)
      .filter(([_, trackingNumber]) => trackingNumber.trim())
      .map(([sampleId, trackingNumber]) => ({ sampleId, trackingNumber }))

    if (trackingArray.length === 0) {
      alert('운송장 번호를 입력해주세요.')
      return
    }

    onSubmit('shipped', trackingArray)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold">운송장 번호 일괄 등록</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <div className="mb-4 text-sm text-gray-600">
          선택된 {selectedSampleData.length}개의 샘플에 운송장 번호를 등록하고 배송 상태로 변경합니다.
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {selectedSampleData.map((sample: any) => (
            <div key={sample.id} className="flex items-center space-x-4 p-4 border rounded-lg bg-gray-50">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{sample.sample_number}</div>
                <div className="text-sm text-gray-600">{sample.customer_name}</div>
                <div className="text-xs text-gray-500">{sample.product_name} × {sample.quantity}개</div>
              </div>
              <div className="flex-1">
                <Input
                  placeholder="운송장 번호 입력"
                  value={trackingData[sample.id] || ''}
                  onChange={(e) => setTrackingData({
                    ...trackingData,
                    [sample.id]: e.target.value
                  })}
                  className="w-full"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-600 hover:bg-blue-700">
            <Send className="h-4 w-4 mr-2" />
            운송장 등록 및 배송 시작
          </Button>
        </div>
      </div>
    </div>
  )
} 