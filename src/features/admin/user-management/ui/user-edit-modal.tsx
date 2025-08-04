'use client'

import { Button } from '@/shared/ui/button'
import { User } from '@/shared/types'
import { useState, useEffect } from 'react'

interface UserEditModalProps {
  user: User | null
  isOpen: boolean
  onClose: () => void
  onSave: (userId: string, userData: Partial<User>) => Promise<User>
}

export function UserEditModal({ 
  user, 
  isOpen, 
  onClose, 
  onSave
}: UserEditModalProps) {
  const [formData, setFormData] = useState<Partial<User>>({})
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        email: user.email || '',
        company_name: user.company_name || '',
        business_number: user.business_number || '',
        representative_name: user.representative_name || '',
        phone: user.phone || '',
        address: user.address || '',
        postal_code: user.postal_code || '',
        recipient_name: user.recipient_name || '',
        recipient_phone: user.recipient_phone || '',
        customer_grade: user.customer_grade || 'general'
      })
      setErrors({})
    }
  }, [user, isOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) {
      newErrors.email = '이메일은 필수입니다.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '올바른 이메일 형식이 아닙니다.'
    }

    if (!formData.company_name?.trim()) {
      newErrors.company_name = '회사명은 필수입니다.'
    }

    if (!formData.business_number?.trim()) {
      newErrors.business_number = '사업자등록번호는 필수입니다.'
    } else if (!/^\d{3}-\d{2}-\d{5}$/.test(formData.business_number.trim())) {
      newErrors.business_number = '사업자등록번호 형식이 올바르지 않습니다. (예: 123-45-67890)'
    }

    if (!formData.representative_name?.trim()) {
      newErrors.representative_name = '대표자명은 필수입니다.'
    }

    if (!formData.phone?.trim()) {
      newErrors.phone = '연락처는 필수입니다.'
    } else if (!/^010-\d{4}-\d{4}$/.test(formData.phone.trim())) {
      newErrors.phone = '연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)'
    }

    if (!formData.postal_code?.trim()) {
      newErrors.postal_code = '우편번호는 필수입니다.'
    }

    if (!formData.address?.trim()) {
      newErrors.address = '주소는 필수입니다.'
    }

    if (!formData.recipient_name?.trim()) {
      newErrors.recipient_name = '수령인은 필수입니다.'
    }

    if (!formData.recipient_phone?.trim()) {
      newErrors.recipient_phone = '수령인 연락처는 필수입니다.'
    } else if (!/^010-\d{4}-\d{4}$/.test(formData.recipient_phone.trim())) {
      newErrors.recipient_phone = '수령인 연락처 형식이 올바르지 않습니다. (예: 010-1234-5678)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (field: keyof User, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // 입력시 해당 필드의 에러 제거
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleSave = async () => {
    if (!user || !validateForm()) return

    try {
      setSaving(true)
      await onSave(user.id, formData)
      onClose()
    } catch (error) {
      console.error('저장 실패:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({})
    setErrors({})
    onClose()
  }

  if (!isOpen || !user) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">회원 정보 수정</h3>
          <Button variant="ghost" onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
            ✕
          </Button>
        </div>
        <div className="p-6">
          <form className="space-y-6">
            {/* 기본 정보 */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">기본 정보</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이메일 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="이메일을 입력하세요"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    회사명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.company_name || ''}
                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.company_name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="회사명을 입력하세요"
                  />
                  {errors.company_name && <p className="text-red-500 text-xs mt-1">{errors.company_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    사업자등록번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.business_number || ''}
                    onChange={(e) => handleInputChange('business_number', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.business_number ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="000-00-00000"
                  />
                  {errors.business_number && <p className="text-red-500 text-xs mt-1">{errors.business_number}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    대표자명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.representative_name || ''}
                    onChange={(e) => handleInputChange('representative_name', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.representative_name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="대표자명을 입력하세요"
                  />
                  {errors.representative_name && <p className="text-red-500 text-xs mt-1">{errors.representative_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    연락처 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.phone ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="010-0000-0000"
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">고객 등급</label>
                  <select
                    value={formData.customer_grade || 'general'}
                    onChange={(e) => handleInputChange('customer_grade', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="general">일반</option>
                    <option value="premium">우수업체</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 배송 정보 */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-100">배송 정보</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    우편번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.postal_code || ''}
                    onChange={(e) => handleInputChange('postal_code', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.postal_code ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="우편번호를 입력하세요"
                  />
                  {errors.postal_code && <p className="text-red-500 text-xs mt-1">{errors.postal_code}</p>}
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    주소 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.address ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="주소를 입력하세요"
                  />
                  {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    수령인 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.recipient_name || ''}
                    onChange={(e) => handleInputChange('recipient_name', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.recipient_name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="수령인을 입력하세요"
                  />
                  {errors.recipient_name && <p className="text-red-500 text-xs mt-1">{errors.recipient_name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    수령인 연락처 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.recipient_phone || ''}
                    onChange={(e) => handleInputChange('recipient_phone', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.recipient_phone ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="010-0000-0000"
                  />
                  {errors.recipient_phone && <p className="text-red-500 text-xs mt-1">{errors.recipient_phone}</p>}
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* 버튼 영역 */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={saving}
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  )
} 