'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { AddressSearch } from '@/shared/ui/address-search'
import { showSuccess, showError } from '@/shared/lib/toast'
import { User, Lock, Eye, EyeOff } from 'lucide-react'

export function ProfilePage() {
  const { user, isAuthenticated } = useAuthStore()
  const [isEditing, setIsEditing] = useState(true)
  const [showPasswordFields, setShowPasswordFields] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    address: '',
    postal_code: ''
  })

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  useEffect(() => {
    if (user) {
      setFormData({
        phone: (user as any).phone || '',
        email: (user as any).email || '',
        address: (user as any).address || '',
        postal_code: (user as any).postal_code || ''
      })
    }
  }, [user])

  const handleSave = async () => {
    try {
      showSuccess('회원정보가 성공적으로 수정되었습니다.')
      setIsEditing(false)
    } catch (error) {
      showError('회원정보 수정에 실패했습니다.')
    }
  }

  const handlePasswordChange = async () => {
    if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) {
      showError('모든 비밀번호 필드를 입력해주세요.')
      return
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      showError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.')
      return
    }

    if (passwordData.new_password.length < 8) {
      showError('새 비밀번호는 8자 이상이어야 합니다.')
      return
    }

    try {
      showSuccess('비밀번호가 성공적으로 변경되었습니다.')
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
      setShowPasswordFields(false)
    } catch (error) {
      showError('비밀번호 변경에 실패했습니다.')
    }
  }

  const handleCancel = () => {
    if (user) {
      setFormData({
        phone: (user as any).phone || '',
        email: (user as any).email || '',
        address: (user as any).address || '',
        postal_code: (user as any).postal_code || ''
      })
    }
    setIsEditing(false)
    setShowPasswordFields(false)
    setPasswordData({
      current_password: '',
      new_password: '',
      confirm_password: ''
    })
  }

  const handleAddressSelect = (addressData: {
    zonecode: string
    address: string
    detailAddress?: string
  }) => {
    setFormData({
      ...formData,
      postal_code: addressData.zonecode,
      address: addressData.address + (addressData.detailAddress ? ' ' + addressData.detailAddress : '')
    })
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h1>
          <p className="text-gray-600">회원정보를 확인하려면 로그인해주세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-10 h-10 text-gray-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">회원정보 수정</h1>
        <p className="text-gray-600">개인정보를 수정하실 수 있습니다.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">기본정보</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  아이디
                </label>
                <Input
                  value={(user as any)?.user_id || ''}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">아이디는 변경할 수 없습니다.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  회사명
                </label>
                <Input
                  value={(user as any)?.company_name || ''}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">회사명은 변경할 수 없습니다.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  대표자명
                </label>
                <Input
                  value={(user as any)?.representative_name || ''}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">대표자명은 변경할 수 없습니다.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사업자등록번호
                </label>
                <Input
                  value={(user as any)?.business_number || ''}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500 mt-1">사업자등록번호는 변경할 수 없습니다.</p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">비밀번호 변경</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPasswordFields(!showPasswordFields)}
              >
                <Lock className="w-4 h-4 mr-2" />
                {showPasswordFields ? '취소' : '비밀번호 변경'}
              </Button>
            </div>
            
            {showPasswordFields && (
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    현재 비밀번호 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordData.current_password}
                      onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                      placeholder="현재 비밀번호를 입력해주세요"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    새 비밀번호 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      placeholder="새 비밀번호를 입력해주세요 (8자 이상)"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    새 비밀번호 확인 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                      placeholder="새 비밀번호를 다시 입력해주세요"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handlePasswordChange} size="sm">
                    비밀번호 변경
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">연락처</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  휴대폰 번호 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="휴대폰 번호를 입력해주세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이메일 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="이메일을 입력해주세요"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">주소정보</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  우편번호
                </label>
                <Input
                  value={formData.postal_code}
                  onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  placeholder="우편번호"
                  className="w-32"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  주소
                </label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="주소를 입력해주세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  주소 검색
                </label>
                <AddressSearch onAddressSelect={handleAddressSelect} />
                <p className="text-xs text-gray-500 mt-1">주소 검색을 통해 새로운 주소로 변경할 수 있습니다.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center space-x-4">
          <Button 
            variant="outline"
            onClick={handleCancel}
            className="px-8 py-2"
          >
            취소
          </Button>
          <Button 
            onClick={handleSave}
            className="px-8 py-2"
          >
            저장
          </Button>
        </div>
      </div>
    </div>
  )
}
