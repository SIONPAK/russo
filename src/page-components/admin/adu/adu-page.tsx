'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { TrendingUp, Search, Download, Filter } from 'lucide-react'

interface ADUData {
  productId: string
  productCode: string
  productName: string
  color: string
  size: string
  adu7: number    // 7일 평균
  adu30: number   // 30일 평균
  adu60: number   // 60일 평균
  adu180: number  // 180일 평균
  total7: number  // 7일 총합
  total30: number // 30일 총합
  total60: number // 60일 총합
  total180: number // 180일 총합
}

export function ADUPage() {
  const [aduData, setAduData] = useState<ADUData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('adu7')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // ADU 데이터 조회
  const fetchADUData = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        search: searchTerm,
        sortBy,
        sortOrder
      })
      
      const response = await fetch(`/api/admin/adu?${params}`)
      const result = await response.json()
      
      if (result.success) {
        setAduData(result.data)
      } else {
        console.error(result.message || 'ADU 데이터를 불러오는데 실패했습니다.')
      }
    } catch (error) {
      console.error('ADU 데이터 조회 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 정렬 처리
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  useEffect(() => {
    fetchADUData()
  }, [searchTerm, sortBy, sortOrder])

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            일평균주문량(ADU) 분석
          </h1>
          <p className="text-gray-600 mt-2">
            제품별 옵션별 일평균주문량을 분석하여 재고 관리 및 구매 계획에 활용하세요.
          </p>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
        <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          검색 및 필터
        </h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              상품명/코드 검색
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="상품명이나 상품코드를 입력하세요"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <Button onClick={fetchADUData} disabled={isLoading}>
            {isLoading ? '조회 중...' : '조회'}
          </Button>
        </div>
      </div>

      {/* ADU 데이터 테이블 */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium">일평균주문량(ADU) 분석 결과</h3>
          <p className="text-sm text-gray-600 mt-1">
            클릭하여 정렬할 수 있습니다. 현재 정렬: {sortBy} ({sortOrder === 'desc' ? '내림차순' : '오름차순'})
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상품코드
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  상품명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  색상
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  사이즈
                </th>
                <th 
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('adu7')}
                >
                  7일 ADU
                  {sortBy === 'adu7' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                </th>
                <th 
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('adu30')}
                >
                  30일 ADU
                  {sortBy === 'adu30' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                </th>
                <th 
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('adu60')}
                >
                  60일 ADU
                  {sortBy === 'adu60' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                </th>
                <th 
                  className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('adu180')}
                >
                  180일 ADU
                  {sortBy === 'adu180' && (sortOrder === 'desc' ? ' ↓' : ' ↑')}
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  7일 총합
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  30일 총합
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  60일 총합
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  180일 총합
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-8 text-center text-gray-500">
                    데이터를 불러오는 중...
                  </td>
                </tr>
              ) : aduData.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-8 text-center text-gray-500">
                    조회된 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                aduData.map((item, index) => (
                  <tr key={`${item.productId}-${item.color}-${item.size}`} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">{item.productCode}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.productName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.color}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.size}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center text-gray-900">{item.adu7.toFixed(1)}개</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center text-gray-900">{item.adu30.toFixed(1)}개</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center text-gray-900">{item.adu60.toFixed(1)}개</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center text-gray-900">{item.adu180.toFixed(1)}개</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{item.total7}개</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{item.total30}개</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{item.total60}개</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{item.total180}개</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {aduData.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              총 {aduData.length}개의 상품 옵션이 조회되었습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
} 