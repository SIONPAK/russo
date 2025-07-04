'use client'

import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Mileage } from '@/shared/types'
import { formatCurrency, formatDateTime } from '@/shared/lib/utils'
import { 
  Search, 
  Filter, 
  Plus,
  Download,
  Eye,
  CheckCircle,
  XCircle
} from 'lucide-react'

interface MileageListProps {
  mileages: Mileage[]
  onMileageSelect: (mileage: Mileage) => void
  onApprove: (mileageId: string) => void
  onReject: (mileageId: string) => void
  onAddMileage: () => void
}

export function MileageList({ mileages, onMileageSelect, onApprove, onReject, onAddMileage }: MileageListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')

  const filteredMileages = mileages.filter(mileage => {
    const matchesSearch = searchTerm === '' || 
      mileage.description.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || mileage.status === statusFilter
    const matchesType = typeFilter === 'all' || mileage.type === typeFilter
    const matchesSource = sourceFilter === 'all' || mileage.source === sourceFilter

    return matchesSearch && matchesStatus && matchesType && matchesSource
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100'
      case 'cancelled': return 'text-red-600 bg-red-100'
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return '완료'
      case 'cancelled': return '취소'
      case 'pending': return '대기'
      default: return '알 수 없음'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'earn': return 'text-blue-600 bg-blue-100'
      case 'spend': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getTypeText = (type: string) => {
    switch (type) {
      case 'earn': return '적립'
      case 'spend': return '차감'
      default: return '알 수 없음'
    }
  }

  const getSourceText = (source: string) => {
    switch (source) {
      case 'manual': return '수동'
      case 'auto': return '자동'
      case 'order': return '주문'
      case 'refund': return '환불'
      default: return '기타'
    }
  }

  return (
    <div className="space-y-6">
      {/* 검색 및 필터 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="설명 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">전체 상태</option>
              <option value="pending">대기</option>
              <option value="completed">완료</option>
              <option value="cancelled">취소</option>
            </select>
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">전체 유형</option>
            <option value="earn">적립</option>
            <option value="spend">차감</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">전체 소스</option>
            <option value="manual">수동</option>
            <option value="auto">자동</option>
            <option value="order">주문</option>
            <option value="refund">환불</option>
          </select>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => {
              setSearchTerm('')
              setStatusFilter('all')
              setTypeFilter('all')
              setSourceFilter('all')
            }}>
              초기화
            </Button>
          </div>

          <div className="flex space-x-2">
            <Button onClick={onAddMileage}>
              <Plus className="h-4 w-4 mr-2" />
              수동 등록
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              엑셀
            </Button>
          </div>
        </div>
      </div>

      {/* 마일리지 목록 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            마일리지 내역 ({filteredMileages.length}개)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  날짜
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  업체명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  유형
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  금액
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  소스
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  설명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMileages.map((mileage) => (
                <tr key={mileage.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDateTime(mileage.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">{mileage.user?.company_name || '알 수 없음'}</div>
                      <div className="text-xs text-gray-500">{mileage.user?.representative_name || ''}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(mileage.type)}`}>
                      {getTypeText(mileage.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={mileage.type === 'earn' ? 'text-blue-600' : 'text-red-600'}>
                      {mileage.type === 'earn' ? '+' : '-'}{formatCurrency(Math.abs(mileage.amount))}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getSourceText(mileage.source)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {mileage.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(mileage.status)}`}>
                      {getStatusText(mileage.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onMileageSelect(mileage)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {mileage.status === 'pending' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => onApprove(mileage.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onReject(mileage.id)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
} 