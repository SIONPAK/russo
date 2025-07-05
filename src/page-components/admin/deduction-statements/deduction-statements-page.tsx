'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Plus, Download, Mail, Search, Filter, Calendar } from 'lucide-react'

interface DeductionItem {
  id: string
  product_name: string
  color: string
  size: string
  quantity: number
  unit_price: number
  total_amount: number
  reason: string
}

interface DeductionStatement {
  id: string
  statement_number: string
  user_id: string
  total_amount: number
  reason: string
  notes: string
  status: 'draft' | 'issued' | 'sent'
  created_at: string
  updated_at: string
  users: {
    company_name: string
    representative_name: string
    phone: string
    email: string
  }
  deduction_items: DeductionItem[]
}

export function DeductionStatementsPage() {
  const [statements, setStatements] = useState<DeductionStatement[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStatements, setSelectedStatements] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // 차감명세서 목록 조회
  const fetchStatements = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        search: searchTerm,
        status: statusFilter,
        startDate: dateRange.start,
        endDate: dateRange.end
      })

      const response = await fetch(`/api/admin/deduction-statements?${params}`)
      const data = await response.json()

      if (data.success) {
        setStatements(data.data.statements)
        setTotalPages(data.data.pagination.totalPages)
      } else {
        console.error('차감명세서 조회 실패:', data.error)
      }
    } catch (error) {
      console.error('차감명세서 조회 오류:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatements()
  }, [currentPage, searchTerm, statusFilter, dateRange])

  // 체크박스 선택/해제
  const handleSelectStatement = (statementId: string) => {
    setSelectedStatements(prev => 
      prev.includes(statementId) 
        ? prev.filter(id => id !== statementId)
        : [...prev, statementId]
    )
  }

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedStatements.length === statements.length) {
      setSelectedStatements([])
    } else {
      setSelectedStatements(statements.map(s => s.id))
    }
  }

  // 상태 업데이트
  const handleStatusUpdate = async (status: 'issued' | 'sent') => {
    if (selectedStatements.length === 0) {
      alert('선택된 차감명세서가 없습니다.')
      return
    }

    try {
      const response = await fetch('/api/admin/deduction-statements', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          statementIds: selectedStatements,
          status
        })
      })

      const data = await response.json()
      if (data.success) {
        alert(`${data.data.updated}개의 차감명세서 상태가 업데이트되었습니다.`)
        setSelectedStatements([])
        fetchStatements()
      } else {
        alert('상태 업데이트에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      console.error('상태 업데이트 오류:', error)
      alert('상태 업데이트 중 오류가 발생했습니다.')
    }
  }

  // 검색 처리
  const handleSearch = () => {
    setCurrentPage(1)
    fetchStatements()
  }

  // 상태 텍스트 변환
  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return '임시저장'
      case 'issued': return '발행완료'
      case 'sent': return '발송완료'
      default: return status
    }
  }

  // 상태 색상 클래스
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'issued': return 'bg-blue-100 text-blue-800'
      case 'sent': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">차감명세서 관리</h1>
          <p className="text-gray-600 mt-1">
            불량건이나 누락건 등에 대한 차감명세서를 관리합니다.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          차감명세서 생성
        </Button>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white p-4 rounded-lg border space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* 검색 */}
          <div className="flex-1 min-w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              검색
            </label>
            <div className="flex">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="명세서 번호, 업체명, 대표자명 검색"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button
                onClick={handleSearch}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-l-none"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* 상태 필터 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상태
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">전체</option>
              <option value="draft">임시저장</option>
              <option value="issued">발행완료</option>
              <option value="sent">발송완료</option>
            </select>
          </div>

          {/* 날짜 범위 */}
          <div className="flex items-end space-x-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시작일
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료일
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      {selectedStatements.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">
              {selectedStatements.length}개의 차감명세서가 선택되었습니다.
            </span>
            <div className="flex space-x-2">
              <Button
                onClick={() => handleStatusUpdate('issued')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                발행완료 처리
              </Button>
              <Button
                onClick={() => handleStatusUpdate('sent')}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Mail className="w-4 h-4 mr-2" />
                발송완료 처리
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 차감명세서 목록 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={statements.length > 0 && selectedStatements.length === statements.length}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  명세서 번호
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  업체명
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  대표자명
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  차감 금액
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  차감 사유
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  생성일
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    로딩 중...
                  </td>
                </tr>
              ) : statements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    차감명세서가 없습니다.
                  </td>
                </tr>
              ) : (
                statements.map((statement) => (
                  <tr key={statement.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedStatements.includes(statement.id)}
                        onChange={() => handleSelectStatement(statement.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {statement.statement_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {statement.users.company_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {statement.users.representative_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 font-medium">
                      {statement.total_amount.toLocaleString()}원
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {statement.reason}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusClass(statement.status)}`}>
                        {getStatusText(statement.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(statement.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // 차감명세서 다운로드 로직
                            window.open(`/api/admin/deduction-statements/${statement.id}/download`, '_blank')
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            // 차감명세서 상세보기 로직
                          }}
                        >
                          상세
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            이전
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Button
              key={page}
              variant={currentPage === page ? 'default' : 'outline'}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </Button>
          ))}
          <Button
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            다음
          </Button>
        </div>
      )}

      {/* 차감명세서 생성 모달 */}
      {showCreateModal && (
        <DeductionStatementCreateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            fetchStatements()
          }}
        />
      )}
    </div>
  )
}

// 차감명세서 생성 모달 컴포넌트
function DeductionStatementCreateModal({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void
  onSuccess: () => void
}) {
  const [formData, setFormData] = useState({
    userId: '',
    reason: '',
    notes: '',
    items: [
      {
        product_id: '',
        product_name: '',
        color: '',
        size: '',
        quantity: 1,
        unit_price: 0,
        reason: ''
      }
    ]
  })
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState<any[]>([])

  // 사용자 목록 조회
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/admin/users')
        const data = await response.json()
        if (data.success) {
          setUsers(data.data.users)
        }
      } catch (error) {
        console.error('사용자 목록 조회 오류:', error)
      }
    }
    fetchUsers()
  }, [])

  // 아이템 추가
  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: '',
        product_name: '',
        color: '',
        size: '',
        quantity: 1,
        unit_price: 0,
        reason: ''
      }]
    }))
  }

  // 아이템 제거
  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  // 아이템 업데이트
  const updateItem = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  // 차감명세서 생성
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.userId || !formData.reason || formData.items.length === 0) {
      alert('필수 정보를 모두 입력해주세요.')
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/admin/deduction-statements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()
      if (data.success) {
        alert('차감명세서가 성공적으로 생성되었습니다.')
        onSuccess()
      } else {
        alert('차감명세서 생성에 실패했습니다: ' + data.error)
      }
    } catch (error) {
      console.error('차감명세서 생성 오류:', error)
      alert('차감명세서 생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">차감명세서 생성</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  업체 선택 *
                </label>
                <select
                  value={formData.userId}
                  onChange={(e) => setFormData(prev => ({ ...prev, userId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">업체를 선택하세요</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.company_name} ({user.representative_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  차감 사유 *
                </label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="불량, 누락, 기타 등"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* 차감 상품 목록 */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  차감 상품 목록 *
                </label>
                <Button
                  type="button"
                  onClick={addItem}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  상품 추가
                </Button>
              </div>

              <div className="space-y-4">
                {formData.items.map((item, index) => (
                  <div key={index} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium text-gray-900">상품 #{index + 1}</h4>
                      {formData.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          삭제
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          상품명 *
                        </label>
                        <input
                          type="text"
                          value={item.product_name}
                          onChange={(e) => updateItem(index, 'product_name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          색상
                        </label>
                        <input
                          type="text"
                          value={item.color}
                          onChange={(e) => updateItem(index, 'color', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          사이즈
                        </label>
                        <input
                          type="text"
                          value={item.size}
                          onChange={(e) => updateItem(index, 'size', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          수량 *
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          min="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          단가 *
                        </label>
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, 'unit_price', parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          금액
                        </label>
                        <input
                          type="text"
                          value={`${(item.quantity * item.unit_price).toLocaleString()}원`}
                          readOnly
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        개별 차감 사유
                      </label>
                      <input
                        type="text"
                        value={item.reason}
                        onChange={(e) => updateItem(index, 'reason', e.target.value)}
                        placeholder="이 상품의 차감 사유 (선택사항)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 총 차감 금액 */}
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-red-800">총 차감 금액</span>
                <span className="text-lg font-bold text-red-600">
                  -{formData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toLocaleString()}원
                </span>
              </div>
            </div>

            {/* 비고 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비고
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
                placeholder="추가 설명이나 비고사항을 입력하세요"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 버튼 */}
            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                취소
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white"
                disabled={loading}
              >
                {loading ? '생성 중...' : '차감명세서 생성'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 