'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'
import { useAuthStore } from '@/entities/auth/model/auth-store'
import { 
  Search, 
  ChevronDown, 
  CreditCard, 
  ArrowUpCircle,
  ArrowDownCircle,
  Calendar,
  Filter
} from 'lucide-react'

interface MileageTransaction {
  id: string
  created_at: string
  type: 'earn' | 'spend'
  amount: number
  description: string
  order_id?: string
  status: string
  source: string
}

interface MileageSummary {
  currentBalance: number
  thisMonthEarned: number
  thisMonthSpent: number
}

const typeLabels = {
  earn: '적립',
  spend: '사용'
}

const typeColors = {
  earn: 'text-green-600',
  spend: 'text-red-600'
}

const typeIcons = {
  earn: ArrowUpCircle,
  spend: ArrowDownCircle
}

export function MileagePage() {
  const { user, isAuthenticated } = useAuthStore()
  const [transactions, setTransactions] = useState<MileageTransaction[]>([])
  const [summary, setSummary] = useState<MileageSummary>({
    currentBalance: 0,
    thisMonthEarned: 0,
    thisMonthSpent: 0
  })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState('3months')

  // 마일리지 데이터 조회
  const fetchMileageData = async () => {
    if (!user?.id) {
    
      setLoading(false)
      return
    }

    

    setLoading(true)
    try {
      const searchParams = new URLSearchParams({
        userId: user.id,
        limit: '50'
      })

      if (typeFilter !== 'all') {
        searchParams.append('type', typeFilter)
      }

      // 날짜 필터 적용
      if (dateFilter !== 'all') {
        const endDate = new Date()
        const startDate = new Date()
        
        switch (dateFilter) {
          case '1month':
            startDate.setMonth(endDate.getMonth() - 1)
            break
          case '3months':
            startDate.setMonth(endDate.getMonth() - 3)
            break
          case '6months':
            startDate.setMonth(endDate.getMonth() - 6)
            break
          case '1year':
            startDate.setFullYear(endDate.getFullYear() - 1)
            break
        }
        
        searchParams.append('startDate', startDate.toISOString().split('T')[0])
        searchParams.append('endDate', endDate.toISOString().split('T')[0])
      }

      
      // 캐시 방지를 위해 타임스탬프 추가
      searchParams.append('_t', new Date().getTime().toString())
      const response = await fetch(`/api/mileage?${searchParams}`)
      const result = await response.json()
      
      console.log('🔍 [마일리지 페이지] API 요청 파라미터:', searchParams.toString())
      console.log('🔍 [마일리지 페이지] API 전체 응답:', result)

      if (result.success) {
        console.log('🔍 [마일리지 페이지] 요약 데이터:', result.data.summary)
        console.log('🔍 [마일리지 페이지] 거래 내역 수:', result.data.mileages?.length || 0)
        
        setTransactions(result.data.mileages || [])
        setSummary(result.data.summary || {
          currentBalance: 0,
          thisMonthEarned: 0,
          thisMonthSpent: 0
        })
      } else {
        console.error('마일리지 조회 실패:', result.error)
        setTransactions([])
      }
    } catch (error) {
      console.error('마일리지 조회 중 오류:', error)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      fetchMileageData()
    } else {
      setLoading(false)
    }
  }, [typeFilter, dateFilter, isAuthenticated, user?.id])

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (transaction.order_id && transaction.order_id.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchesSearch
  })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price)
  }

  const getMileageColor = (balance: number) => {
    return balance < 0 ? 'text-red-600' : 'text-white'
  }

  const formatMileageAmount = (amount: number, showSign: boolean = false) => {
    const isNegative = amount < 0
    const absoluteAmount = Math.abs(amount)
    const formattedAmount = formatPrice(absoluteAmount)
    
    if (showSign) {
      return isNegative ? `-${formattedAmount}` : `${formattedAmount}`
    }
    return `${formattedAmount}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
    })
  }

  const getSourceText = (source: string) => {
    switch (source) {
      case 'manual': return '수동'
      case 'auto': return '자동'
      case 'order': return '주문'
      case 'refund': return '환불'
      case 'bankda': return '뱅크다'
      default: return '기타'
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-black mb-3">로그인이 필요합니다</h1>
          <p className="text-gray-600 mb-6">마일리지 내역을 확인하려면 로그인해주세요.</p>
          <Button 
            onClick={() => window.location.href = '/auth/login'}
            className="bg-black text-white hover:bg-gray-800"
          >
            로그인하러 가기
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600 text-sm">마일리지 내역을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-black mb-2">마일리지</h1>
          <p className="text-gray-600">마일리지 내역을 확인하고 관리하세요</p>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* 보유 마일리지 */}
          <div className={`rounded-lg p-4 ${summary.currentBalance < 0 ? 'bg-red-600' : 'bg-black'} text-white`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">보유 마일리지</h3>
              <CreditCard className="w-5 h-5 opacity-80" />
            </div>
            <p className="text-2xl font-bold text-white">
              {summary.currentBalance < 0 ? '-' : ''}{formatPrice(Math.abs(summary.currentBalance))}원
            </p>
            <p className="text-gray-200 text-xs mt-1">
              {summary.currentBalance < 0 ? '마이너스 잔액' : '사용 가능한 마일리지'}
            </p>
          </div>

          {/* 이번 달 적립 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-black">이번 달 적립</h3>
              <ArrowUpCircle className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">
              +{formatPrice(summary.thisMonthEarned)}원
            </p>
            <p className="text-gray-600 text-xs mt-1">{new Date().getMonth() + 1}월 적립 금액</p>
          </div>

          {/* 이번 달 사용 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-black">이번 달 사용</h3>
              <ArrowDownCircle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-600">
              {formatPrice(summary.thisMonthSpent)}원
            </p>
            <p className="text-gray-600 text-xs mt-1">{new Date().getMonth() + 1}월 사용 금액</p>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>

            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full h-10 px-3 pr-8 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black appearance-none bg-white"
              >
                <option value="all">전체 유형</option>
                <option value="earn">적립</option>
                <option value="spend">사용</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full h-10 px-3 pr-8 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black appearance-none bg-white"
              >
                <option value="1month">최근 1개월</option>
                <option value="3months">최근 3개월</option>
                <option value="6months">최근 6개월</option>
                <option value="1year">최근 1년</option>
                <option value="all">전체</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            <Button 
              onClick={fetchMileageData}
              className="h-10 bg-black text-white hover:bg-gray-800 text-sm"
            >
              조회
            </Button>
          </div>
        </div>

        {/* 마일리지 내역 */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-black text-white px-4 py-3">
            <h2 className="text-lg font-semibold">
              마일리지 내역 ({filteredTransactions.length}건)
            </h2>
          </div>
          
          <div className="divide-y divide-gray-100">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((transaction) => {
                const IconComponent = typeIcons[transaction.type]
                return (
                  <div key={transaction.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-full ${
                          transaction.type === 'earn' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          <IconComponent className={`w-4 h-4 ${typeColors[transaction.type]}`} />
                        </div>
                        <div>
                          <p className="font-medium text-black text-sm">
                            {transaction.description}
                          </p>
                          <div className="flex items-center space-x-3 mt-1">
                            <p className="text-xs text-gray-500">
                              {formatDate(transaction.created_at)}
                            </p>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              transaction.type === 'earn' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {typeLabels[transaction.type]}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs bg-black text-white">
                              {getSourceText(transaction.source)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${
                          transaction.type === 'earn' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'earn' ? '+' : '-'}{formatPrice(Math.abs(transaction.amount))}원
                        </p>
                        <p className="text-xs text-gray-500">
                          {transaction.type === 'earn' ? '적립' : '차감'}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-black mb-2">마일리지 내역이 없습니다</h3>
                <p className="text-gray-600 mb-6 text-sm">아직 마일리지 거래 내역이 없습니다.</p>
                <Button 
                  onClick={() => window.location.href = '/products'}
                  className="bg-black text-white hover:bg-gray-800"
                >
                  쇼핑하러 가기
                </Button>
              </div>
            )}
          </div>
        </div>


      </div>
    </div>
  )
} 