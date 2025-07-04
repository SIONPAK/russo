'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { formatCurrency } from '@/shared/lib/utils'
import { showWarning, showError, showSuccess } from '@/shared/lib/toast'
import { X, Plus, Minus, DollarSign, Search } from 'lucide-react'

interface AddMileageModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    user_id: string
    type: 'earn' | 'spend'
    amount: number
    description: string
  }) => Promise<void>
}

interface User {
  id: string
  company_name: string
  representative_name: string
  email: string
}

export function AddMileageModal({ isOpen, onClose, onSubmit }: AddMileageModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [type, setType] = useState<'earn' | 'spend'>('earn')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  // 검색 기능
  const searchUsers = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    setSearchLoading(true)
    try {
      const response = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}&limit=10`)
      const result = await response.json()

      if (result.success) {
        setSearchResults(result.data || [])
        setShowSearchResults(true)
      } else {
        setSearchResults([])
        setShowSearchResults(false)
      }
    } catch (error) {
      console.error('사용자 검색 오류:', error)
      setSearchResults([])
      setShowSearchResults(false)
    } finally {
      setSearchLoading(false)
    }
  }

  // 검색어 변경 시 자동 검색
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchUsers(searchTerm)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  // 사용자 선택
  const handleUserSelect = (user: User) => {
    setSelectedUser(user)
    setSearchTerm(user.company_name)
    setShowSearchResults(false)
  }

  // 선택된 사용자 제거
  const handleUserClear = () => {
    setSelectedUser(null)
    setSearchTerm('')
    setShowSearchResults(false)
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedUser || !amount || !description) {
      showWarning('모든 필드를 입력해주세요.')
      return
    }

    const numAmount = parseInt(amount.replace(/,/g, ''))
    if (isNaN(numAmount) || numAmount <= 0) {
      showWarning('올바른 금액을 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      await onSubmit({
        user_id: selectedUser.id,
        type,
        amount: numAmount,
        description
      })
      
      // 폼 초기화
      setSelectedUser(null)
      setSearchTerm('')
      setType('earn')
      setAmount('')
      setDescription('')
      onClose()
    } catch (error) {
      console.error('마일리지 등록 오류:', error)
      showError('마일리지 등록 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d]/g, '')
    const numValue = parseInt(value)
    if (!isNaN(numValue)) {
      setAmount(numValue.toLocaleString())
    } else {
      setAmount('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold">마일리지 수동 등록</h3>
          <Button variant="ghost" onClick={onClose}>
            ✕
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 회사명 검색 */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              회사명 검색 *
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="회사명을 입력하세요"
                className="pl-10 pr-10"
                required
              />
              {selectedUser && (
                <button
                  type="button"
                  onClick={handleUserClear}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            {/* 검색 결과 */}
            {showSearchResults && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                {searchLoading ? (
                  <div className="p-3 text-center text-gray-500">검색 중...</div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleUserSelect(user)}
                      className="w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                    >
                      <div className="font-medium text-gray-900">{user.company_name}</div>
                      <div className="text-sm text-gray-500">
                        {user.representative_name} · {user.email}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center text-gray-500">검색 결과가 없습니다</div>
                )}
              </div>
            )}
            
            {/* 선택된 사용자 정보 */}
            {selectedUser && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-sm font-medium text-blue-900">{selectedUser.company_name}</div>
                <div className="text-xs text-blue-700">
                  {selectedUser.representative_name} · {selectedUser.email}
                </div>
              </div>
            )}
          </div>

          {/* 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              유형 *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('earn')}
                className={`p-3 rounded-md border ${
                  type === 'earn'
                    ? 'bg-blue-50 border-blue-300 text-blue-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                적립
              </button>
              <button
                type="button"
                onClick={() => setType('spend')}
                className={`p-3 rounded-md border ${
                  type === 'spend'
                    ? 'bg-red-50 border-red-300 text-red-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                차감
              </button>
            </div>
          </div>

          {/* 금액 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              금액 *
            </label>
            <Input
              value={amount}
              onChange={handleAmountChange}
              placeholder="0"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              금액은 숫자만 입력가능합니다
            </p>
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명 *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="마일리지 처리 사유를 입력하세요"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* 미리보기 */}
          {selectedUser && amount && description && (
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="text-sm font-medium text-gray-700 mb-2">처리 내역 미리보기</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>회사: {selectedUser.company_name}</p>
                <p>대표자: {selectedUser.representative_name}</p>
                <p>유형: {type === 'earn' ? '적립' : '차감'}</p>
                <p className={type === 'earn' ? 'text-blue-600' : 'text-red-600'}>
                  금액: {type === 'earn' ? '+' : '-'}{formatCurrency(parseInt(amount.replace(/,/g, '')) || 0)}
                </p>
                <p>설명: {description}</p>
              </div>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? '처리 중...' : '등록'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              취소
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
} 