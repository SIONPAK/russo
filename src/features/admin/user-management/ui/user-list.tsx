'use client'

import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { User } from '@/shared/types'
import { formatDate, formatBusinessNumber, formatDateTime } from '@/shared/lib/utils'
import { showWarning } from '@/shared/lib/toast'
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle,
  Download
} from 'lucide-react'

interface UserListProps {
  users: User[]
  loading?: boolean
  onUserSelect: (user: User) => void
  onApprove: (userId: string) => void
  onReject: (userId: string, reason: string) => void
}

export function UserList({ users, loading = false, onUserSelect, onApprove, onReject }: UserListProps) {
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-emerald-700 bg-emerald-50 border border-emerald-200'
      case 'rejected': return 'text-red-700 bg-red-50 border border-red-200'
      case 'pending': return 'text-orange-700 bg-orange-50 border border-orange-200'
      default: return 'text-gray-700 bg-gray-50 border border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return '승인'
      case 'rejected': return '반려'
      case 'pending': return '대기'
      default: return '알 수 없음'
    }
  }

  const handleReject = (user: User) => {
    if (!rejectReason.trim()) {
      showWarning('반려 사유를 입력해주세요.')
      return
    }
    
    onReject(user.id, rejectReason)
    setShowRejectModal(false)
    setRejectReason('')
    setSelectedUserId(null)
  }

  if (loading && users.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">사용자 목록을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* 회원 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            회원 목록 ({users?.length}개)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  업체명
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  이메일
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  사업자번호
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  대표자
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  연락처
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  고객등급
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  사업장 소재지
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  가입일
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  상세보기
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {users?.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                    등록된 회원이 없습니다.
                  </td>
                </tr>
              ) : (
                users?.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{user.company_name}</div>
                      {user.is_dormant && (
                        <span className="text-xs text-orange-500 font-medium">휴면</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {user.business_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.representative_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                      {user.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        user.customer_grade === 'premium' 
                          ? 'text-purple-700 bg-purple-50 border border-purple-200' 
                          : 'text-gray-700 bg-gray-50 border border-gray-200'
                      }`}>
                        {user.customer_grade === 'premium' ? '우수업체' : '일반'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 max-w-xs">
                      <div className="truncate" title={`(${user.postal_code}) ${user.address}`}>
                        {user.address}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {user.postal_code}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(user.approval_status)}`}>
                        {getStatusText(user.approval_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(user.created_at)}
                      {user.last_login_at && (
                        <div className="text-xs text-gray-400">
                          최종: {formatDate(user.last_login_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onUserSelect(user)}
                          className="border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          상세보기
                        </Button>
                        {user.approval_status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => onApprove(user.id)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedUserId(user.id)
                                setShowRejectModal(true)
                              }}
                              className="border-red-200 text-red-600 hover:bg-red-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 반려 사유 입력 모달 */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">반려 사유 입력</h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-500 mb-2">
                  반려 사유 *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="반려 사유를 상세히 입력해주세요"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                />
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={() => {
                    const user = users.find(u => u.id === selectedUserId)
                    if (user) handleReject(user)
                  }}
                  className="bg-red-500 hover:bg-red-600 text-white flex-1"
                  disabled={!rejectReason.trim()}
                >
                  반려 처리
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectModal(false)
                    setRejectReason('')
                    setSelectedUserId(null)
                  }}
                  className="border-gray-200 text-gray-600 hover:bg-gray-50 flex-1"
                >
                  취소
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
} 