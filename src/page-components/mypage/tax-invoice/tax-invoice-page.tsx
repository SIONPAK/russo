'use client'

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { Button } from '@/shared/ui/button'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { 
  FileText, 
  RefreshCw,
  Building,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  XCircle,
  Download
} from 'lucide-react'

interface TaxInvoiceData {
  yearMonth: string
  period: {
    startDate: string
    endDate: string
  }
  companyInfo: {
    companyName: string
    representativeName: string
    businessNumber: string
    address: string
    phone: string
    email: string
  }
  taxInvoiceInfo: {
    totalDeduction: number
    supplyAmount: number
    vatAmount: number
    totalWithVat: number
    status: 'O' | '△' | 'X' // O: 발행완료, △: 진행중, X: 미발행
    issuedAt: string | null
    issuedBy: string | null
  }
  mileageDetails: Array<{
    id: string
    amount: number
    description: string
    orderId: string | null
    createdAt: string
  }>
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
  }
}

export function TaxInvoicePage() {
  const { isAuthenticated, user } = useAuthStore()
  const [taxInvoiceData, setTaxInvoiceData] = useState<TaxInvoiceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`
  })
  const [currentPage, setCurrentPage] = useState(1)

  // 세금계산서 데이터 조회
  const fetchTaxInvoiceData = async () => {
    if (!isAuthenticated || !user || !('company_name' in user) || !(user as any).company_name) return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        companyName: (user as any).company_name,
        yearMonth: selectedMonth,
        page: currentPage.toString(),
        limit: '20'
      })

      const response = await fetch(`/api/tax-invoice?${params}`)
      const data = await response.json()

      if (data.success) {
        setTaxInvoiceData(data.data)
      } else {
        console.error('세금계산서 조회 실패:', data.error)
        setTaxInvoiceData(null)
      }
    } catch (error) {
      console.error('세금계산서 조회 오류:', error)
      setTaxInvoiceData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchTaxInvoiceData()
    }
  }, [isAuthenticated, selectedMonth, currentPage])

  // 월 변경 시 첫 페이지로 이동
  const handleMonthChange = (month: string) => {
    setSelectedMonth(month)
    setCurrentPage(1)
  }

  // 페이지 변경
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  // 상태 텍스트 변환
  const getStatusText = (status: string) => {
    switch (status) {
      case 'O': return '발행완료'
      case '△': return '진행중'
      case 'X': return '미발행'
      default: return '알 수 없음'
    }
  }

  // 상태 색상 클래스
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'O': return 'bg-green-100 text-green-800'
      case '△': return 'bg-yellow-100 text-yellow-800'
      case 'X': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 상태 아이콘
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'O': return <CheckCircle className="w-4 h-4 text-green-600" />
      case '△': return <Clock className="w-4 h-4 text-yellow-600" />
      case 'X': return <XCircle className="w-4 h-4 text-gray-600" />
      default: return <XCircle className="w-4 h-4 text-gray-600" />
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">로그인이 필요합니다</h1>
          <p className="text-gray-600">세금계산서 조회를 하려면 로그인해주세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">세금계산서 조회</h1>
          <p className="text-gray-600">월별 마일리지 사용 내역 및 세금계산서 발행 상태를 확인할 수 있습니다.</p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button onClick={fetchTaxInvoiceData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">세금계산서 정보를 불러오는 중...</p>
        </div>
      ) : taxInvoiceData ? (
        <>
          {/* 업체 정보 카드 */}
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center mb-4">
              <Building className="w-6 h-6 text-blue-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">업체 정보</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">업체명</p>
                <p className="font-medium">{taxInvoiceData.companyInfo.companyName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">대표자명</p>
                <p className="font-medium">{taxInvoiceData.companyInfo.representativeName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">사업자번호</p>
                <p className="font-medium">{taxInvoiceData.companyInfo.businessNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">연락처</p>
                <p className="font-medium">{taxInvoiceData.companyInfo.phone}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600">주소</p>
                <p className="font-medium">{taxInvoiceData.companyInfo.address}</p>
              </div>
            </div>
          </div>

          {/* 세금계산서 정보 카드 */}
          <div className="bg-white p-6 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <FileText className="w-6 h-6 text-blue-600 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">
                  {format(new Date(selectedMonth + '-01'), 'yyyy년 M월', { locale: ko })} 세금계산서
                </h2>
              </div>
              <div className="flex items-center">
                {getStatusIcon(taxInvoiceData.taxInvoiceInfo.status)}
                <span className={`ml-2 px-3 py-1 text-sm font-medium rounded-full ${getStatusClass(taxInvoiceData.taxInvoiceInfo.status)}`}>
                  {getStatusText(taxInvoiceData.taxInvoiceInfo.status)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">총 차감 금액</p>
                <p className="text-xl font-bold text-gray-900">
                  {taxInvoiceData.taxInvoiceInfo.totalDeduction.toLocaleString()}원
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">공급가액</p>
                <p className="text-xl font-bold text-blue-600">
                  {taxInvoiceData.taxInvoiceInfo.supplyAmount.toLocaleString()}원
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">부가세</p>
                <p className="text-xl font-bold text-green-600">
                  {taxInvoiceData.taxInvoiceInfo.vatAmount.toLocaleString()}원
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">합계</p>
                <p className="text-xl font-bold text-purple-600">
                  {taxInvoiceData.taxInvoiceInfo.totalWithVat.toLocaleString()}원
                </p>
              </div>
            </div>

            {taxInvoiceData.taxInvoiceInfo.issuedAt && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-800">
                  발행일: {format(new Date(taxInvoiceData.taxInvoiceInfo.issuedAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                </p>
              </div>
            )}
          </div>

          {/* 마일리지 사용 내역 */}
          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">마일리지 사용 내역</h3>
                <p className="text-sm text-gray-600">
                  총 {taxInvoiceData.pagination.totalItems}건
                </p>
              </div>
            </div>

            {taxInvoiceData.mileageDetails.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>해당 월에 마일리지 사용 내역이 없습니다.</p>
              </div>
            ) : (
              <>
                {/* 테이블 헤더 */}
                <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-500">
                    <div className="col-span-3">사용일시</div>
                    <div className="col-span-4">사용 내역</div>
                    <div className="col-span-2">주문번호</div>
                    <div className="col-span-3">사용 금액</div>
                  </div>
                </div>

                {/* 내역 목록 */}
                <div className="divide-y divide-gray-200">
                  {taxInvoiceData.mileageDetails.map((detail) => (
                    <div key={detail.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-3">
                          <p className="text-sm text-gray-900">
                            {format(new Date(detail.createdAt), 'MM-dd HH:mm', { locale: ko })}
                          </p>
                        </div>
                        <div className="col-span-4">
                          <p className="text-sm text-gray-900">{detail.description}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-sm text-gray-600">{detail.orderId || '-'}</p>
                        </div>
                        <div className="col-span-3">
                          <p className="text-sm font-medium text-red-600">
                            -{detail.amount.toLocaleString()}원
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 페이지네이션 */}
                {taxInvoiceData.pagination.totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        총 {taxInvoiceData.pagination.totalItems}건
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          variant="outline"
                          size="sm"
                        >
                          이전
                        </Button>
                        <span className="px-3 py-1 text-sm text-gray-700">
                          {currentPage} / {taxInvoiceData.pagination.totalPages}
                        </span>
                        <Button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === taxInvoiceData.pagination.totalPages}
                          variant="outline"
                          size="sm"
                        >
                          다음
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="p-12 text-center text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>세금계산서 정보를 불러올 수 없습니다.</p>
        </div>
      )}
    </div>
  )
} 