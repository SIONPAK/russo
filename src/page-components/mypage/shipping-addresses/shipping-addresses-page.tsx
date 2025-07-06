'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { showSuccess, showError } from '@/shared/lib/toast'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { AddressSearch } from '@/shared/ui/address-search'
import { 
  Plus, 
  Edit, 
  Trash2, 
  MapPin,
  Phone,
  User,
  X,
  Check
} from 'lucide-react'

interface ShippingAddress {
  id: string
  recipient_name: string
  phone: string
  address: string
  postal_code: string
  is_default: boolean
}

export function ShippingAddressesPage() {
  const { user, isAuthenticated } = useAuthStore()
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<ShippingAddress | null>(null)
  const [formData, setFormData] = useState({
    recipient_name: '',
    phone: '',
    address: '',
    postal_code: '',
    is_default: false
  })

  // 배송지 목록 조회
  const fetchAddresses = async () => {
    if (!isAuthenticated || !user) return

    try {
      setLoading(true)
      const response = await fetch(`/api/shipping-addresses?userId=${user.id}`)
      const result = await response.json()

      if (result.success) {
        setAddresses(result.data || [])
      } else {
        showError('배송지 목록을 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('배송지 조회 오류:', error)
      showError('배송지 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAddresses()
  }, [isAuthenticated, user])

  // 모달 열기
  const openModal = (address?: ShippingAddress) => {
    if (address) {
      setEditingAddress(address)
      setFormData({
        recipient_name: address.recipient_name,
        phone: address.phone,
        address: address.address,
        postal_code: address.postal_code,
        is_default: address.is_default
      })
    } else {
      setEditingAddress(null)
      setFormData({
        recipient_name: '',
        phone: '',
        address: '',
        postal_code: '',
        is_default: addresses.length === 0 // 첫 번째 배송지는 자동으로 기본 배송지
      })
    }
    setIsModalOpen(true)
  }

  // 모달 닫기
  const closeModal = () => {
    setIsModalOpen(false)
    setEditingAddress(null)
    setFormData({
      recipient_name: '',
      phone: '',
      address: '',
      postal_code: '',
      is_default: false
    })
  }

  // 주소 검색 결과 처리
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

  // 배송지 저장
  const saveAddress = async () => {
    if (!user) return

    if (!formData.recipient_name || !formData.phone || !formData.address || !formData.postal_code) {
      showError('모든 필드를 입력해주세요.')
      return
    }

    try {
      const url = editingAddress 
        ? `/api/shipping-addresses/${editingAddress.id}`
        : '/api/shipping-addresses'
      
      const method = editingAddress ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          ...formData
        })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess(editingAddress ? '배송지가 수정되었습니다.' : '배송지가 추가되었습니다.')
        closeModal()
        fetchAddresses()
      } else {
        showError(result.error || '배송지 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('배송지 저장 오류:', error)
      showError('배송지 저장 중 오류가 발생했습니다.')
    }
  }

  // 배송지 삭제
  const deleteAddress = async (addressId: string) => {
    if (!user) return

    if (!confirm('정말로 이 배송지를 삭제하시겠습니까?')) return

    try {
      const response = await fetch(`/api/shipping-addresses/${addressId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: user.id })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess('배송지가 삭제되었습니다.')
        fetchAddresses()
      } else {
        showError(result.error || '배송지 삭제에 실패했습니다.')
      }
    } catch (error) {
      console.error('배송지 삭제 오류:', error)
      showError('배송지 삭제 중 오류가 발생했습니다.')
    }
  }

  // 기본 배송지 설정
  const setDefaultAddress = async (addressId: string) => {
    if (!user) return

    try {
      const response = await fetch(`/api/shipping-addresses/${addressId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: user.id,
          is_default: true
        })
      })

      const result = await response.json()

      if (result.success) {
        showSuccess('기본 배송지가 설정되었습니다.')
        fetchAddresses()
      } else {
        showError(result.error || '기본 배송지 설정에 실패했습니다.')
      }
    } catch (error) {
      console.error('기본 배송지 설정 오류:', error)
      showError('기본 배송지 설정 중 오류가 발생했습니다.')
    }
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">배송지 관리</h1>
          <p className="text-gray-600">배송지를 추가하고 관리하세요</p>
        </div>
        <Button
          onClick={() => openModal()}
          className="bg-black text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4 mr-2" />
          배송지 추가
        </Button>
      </div>

      {/* 배송지 목록 */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
            <p className="mt-4 text-gray-600">배송지 목록을 불러오는 중...</p>
          </div>
        ) : addresses.length === 0 ? (
          <div className="text-center py-16">
            <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              등록된 배송지가 없습니다
            </h3>
            <p className="text-gray-500 mb-6">
              첫 번째 배송지를 등록해보세요.
            </p>
            <Button
              onClick={() => openModal()}
              className="bg-black text-white hover:bg-gray-800"
            >
              <Plus className="h-4 w-4 mr-2" />
              배송지 추가
            </Button>
          </div>
        ) : (
          addresses.map((address) => (
            <div
              key={address.id}
              className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">
                      {address.recipient_name}
                    </h3>
                    {address.is_default && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        기본 배송지
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2" />
                      {address.phone}
                    </div>
                    <div className="flex items-start">
                      <MapPin className="h-4 w-4 mr-2 mt-0.5" />
                      <div>
                        <div className="font-medium">({address.postal_code})</div>
                        <div>{address.address}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  {!address.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDefaultAddress(address.id)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Check className="h-4 w-4 mr-1" />
                      기본설정
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openModal(address)}
                    className="text-gray-600 hover:text-gray-700"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    수정
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteAddress(address.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    삭제
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 배송지 추가/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">
                {editingAddress ? '배송지 수정' : '배송지 추가'}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeModal}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  수령인명 *
                </label>
                <Input
                  value={formData.recipient_name}
                  onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                  placeholder="수령인명을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  연락처 *
                </label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="연락처를 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  우편번호 *
                </label>
                <div className="flex gap-3">
                  <Input
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="우편번호"
                    className="w-32"
                    readOnly
                  />
                  <AddressSearch
                    onAddressSelect={handleAddressSelect}
                    buttonText="주소검색"
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  주소 *
                </label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="상세주소를 입력하세요"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="is_default" className="text-sm text-gray-700">
                  기본 배송지로 설정
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                variant="outline"
                onClick={closeModal}
              >
                취소
              </Button>
              <Button
                onClick={saveAddress}
                className="bg-black text-white hover:bg-gray-800"
              >
                {editingAddress ? '수정' : '추가'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 