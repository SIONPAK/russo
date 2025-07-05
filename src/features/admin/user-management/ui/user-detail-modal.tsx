import { Button } from '@/shared/ui/button'
import { User } from '@/shared/types'
import { useState } from 'react'
import { formatDateTime } from '@/shared/lib/utils'

interface UserDetailModalProps {
  user: User | null
  isOpen: boolean
  onClose: () => void
  onApprove: (userId: string) => void
  onReject: (userId: string, reason: string) => void
  onDeactivate: (userId: string, reason: string) => void
  onActivate?: (userId: string) => void
  onDelete?: (userId: string) => void
  onUpdateGrade?: (userId: string, grade: 'premium' | 'general') => void
  onDormantToggle?: (userId: string, isDormant: boolean, reason?: string) => void
}

export function UserDetailModal({ 
  user, 
  isOpen, 
  onClose, 
  onApprove, 
  onReject, 
  onDeactivate,
  onActivate,
  onDelete,
  onUpdateGrade,
  onDormantToggle
}: UserDetailModalProps) {
  const [showGradeChange, setShowGradeChange] = useState(false)
  
  if (!isOpen || !user) return null

  const handleReject = () => {
    const reason = prompt('반려 사유를 입력하세요:')
    if (reason) {
      onReject(user.id, reason)
      onClose()
    }
  }

  const handleDeactivate = () => {
    const reason = prompt('비활성화 사유를 입력하세요:')
    if (reason) {
      onDeactivate(user.id, reason)
      onClose()
    }
  }

  const handleGradeChange = (newGrade: 'premium' | 'general') => {
    if (onUpdateGrade) {
      onUpdateGrade(user.id, newGrade)
      setShowGradeChange(false)
    }
  }

  const handleDormantToggle = () => {
    if (onDormantToggle) {
      const reason = user.is_dormant 
        ? '휴면 해제' 
        : prompt('휴면 처리 사유를 입력하세요:')
      
      if (!user.is_dormant && !reason) return
      
      onDormantToggle(user.id, !user.is_dormant, reason || undefined)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">회원 상세 정보</h3>
          <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </Button>
        </div>
        <div className="p-6 space-y-6">
          {/* 기본 정보 */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">기본 정보</h4>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">회사명</label>
                <p className="text-sm text-gray-900 font-medium">{user.company_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">사업자등록번호</label>
                <p className="text-sm text-gray-900 font-mono">{user.business_number}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">대표자명</label>
                <p className="text-sm text-gray-900">{user.representative_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">이메일</label>
                <p className="text-sm text-gray-900">{user.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">연락처</label>
                <p className="text-sm text-gray-900 font-mono">{user.phone}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">가입일</label>
                <p className="text-sm text-gray-900">
                  {formatDateTime(user.created_at)}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">최종 로그인</label>
                <p className="text-sm text-gray-900">
                  {user.last_login_at 
                    ? formatDateTime(user.last_login_at)
                    : '로그인 기록 없음'
                  }
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">고객 등급</label>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.customer_grade === 'premium' 
                      ? 'text-purple-700 bg-purple-50 border border-purple-200' 
                      : 'text-gray-700 bg-gray-50 border border-gray-200'
                  }`}>
                    {user.customer_grade === 'premium' ? '우수업체' : '일반'}
                  </span>
                  {onUpdateGrade && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowGradeChange(!showGradeChange)}
                      className="text-xs"
                    >
                      변경
                    </Button>
                  )}
                </div>
                {showGradeChange && (
                  <div className="mt-2 flex space-x-2">
                    <Button
                      size="sm"
                      onClick={() => handleGradeChange('premium')}
                      className={`text-xs ${user.customer_grade === 'premium' ? 'bg-purple-500' : 'bg-gray-500'}`}
                    >
                      우수업체
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleGradeChange('general')}
                      className={`text-xs ${user.customer_grade === 'general' ? 'bg-gray-500' : 'bg-purple-500'}`}
                    >
                      일반
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 사업장 소재지 */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">사업장 소재지</h4>
            <div className="grid grid-cols-2 gap-6">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-500 mb-1">주소</label>
                <p className="text-sm text-gray-900">
                  ({user.postal_code}) {user.address}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">수령인</label>
                <p className="text-sm text-gray-900">{user.recipient_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">수령인 연락처</label>
                <p className="text-sm text-gray-900 font-mono">{user.recipient_phone}</p>
              </div>
            </div>
          </div>

          {/* 사업자등록증 */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">사업자등록증</h4>
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
              {user.business_license ? (
                <img 
                  src={user.business_license} 
                  alt="사업자등록증" 
                  className="max-w-full h-auto rounded-lg shadow-sm"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuyCrOyXheyekOuhneyanemyuOymiTwvdGV4dD48L3N2Zz4='
                  }}
                />
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gray-200 rounded-lg flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-sm">사업자등록증이 업로드되지 않았습니다.</p>
                </div>
              )}
            </div>
          </div>

          {/* 승인 이력 */}
          {(user.approved_at || user.rejected_at) && (
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">승인 이력</h4>
              <div className="space-y-2">
                {user.approved_at && (
                  <p className="text-sm text-green-600">
                    승인일: {formatDateTime(user.approved_at)}
                  </p>
                )}
                {user.rejected_at && (
                  <div>
                    <p className="text-sm text-red-600">
                      반려일: {formatDateTime(user.rejected_at)}
                    </p>
                    {user.rejected_reason && (
                      <p className="text-sm text-gray-600 mt-1">
                        반려 사유: {user.rejected_reason}
                      </p>
                    )}
                  </div>
                )}
                {user.approval_notes && (
                  <p className="text-sm text-gray-600">
                    관리자 메모: {user.approval_notes}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 상태 관리 */}
          <div>
            <h4 className="text-md font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">상태 관리</h4>
            <div className="flex flex-wrap gap-3">
              {user.approval_status === 'pending' && (
                <>
                  <Button 
                    onClick={() => {
                      onApprove(user.id)
                      onClose()
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  >
                    승인
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleReject}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    반려
                  </Button>
                </>
              )}
              {user.is_active && (
                <Button 
                  variant="outline"
                  onClick={handleDeactivate}
                  className="border-orange-200 text-orange-600 hover:bg-orange-50"
                >
                  계정 비활성화
                </Button>
              )}
              {!user.is_active && onActivate && (
                <Button 
                  variant="outline"
                  onClick={() => {
                    onActivate(user.id)
                    onClose()
                  }}
                  className="border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  계정 활성화
                </Button>
              )}
              {onDormantToggle && (
                <Button 
                  variant="outline"
                  onClick={handleDormantToggle}
                  className={`${user.is_dormant 
                    ? 'border-green-200 text-green-600 hover:bg-green-50' 
                    : 'border-orange-200 text-orange-600 hover:bg-orange-50'
                  }`}
                >
                  {user.is_dormant ? '휴면 해제' : '휴면 처리'}
                </Button>
              )}
              {onDelete && (
                <Button 
                  variant="outline"
                  onClick={() => {
                    if (confirm('정말로 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
                      onDelete(user.id)
                      onClose()
                    }
                  }}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  계정 삭제
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 