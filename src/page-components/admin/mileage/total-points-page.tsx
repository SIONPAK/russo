'use client'

import { useTotalPoints } from '@/features/admin/total-points/model/use-total-points'
import { Button } from '@/shared/ui/button'
import { RefreshCw, TrendingUp, TrendingDown, Users, Building2 } from 'lucide-react'

export function TotalPointsPage() {
  const { totalPoints, loading, error, refresh } = useTotalPoints()

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num)
  }

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num) + '원'
  }

  const getPointsColor = (points: number) => {
    if (points > 0) return 'text-green-600'
    if (points < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const totalSummary = totalPoints.reduce(
    (acc, company) => ({
      total_points: acc.total_points + company.total_points,
      total_earned: acc.total_earned + company.total_earned,
      total_spent: acc.total_spent + company.total_spent,
      total_companies: acc.total_companies + 1,
      total_users: acc.total_users + company.user_count
    }),
    { total_points: 0, total_earned: 0, total_spent: 0, total_companies: 0, total_users: 0 }
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={refresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            다시 시도
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <Building2 className="w-8 h-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">총 회사 수</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(totalSummary.total_companies)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-purple-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">총 회원 수</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(totalSummary.total_users)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">총 적립액</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalSummary.total_earned)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <TrendingDown className="w-8 h-8 text-red-500 mr-3" />
            <div>
              <p className="text-sm font-medium text-gray-600">총 사용액</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalSummary.total_spent)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
              totalSummary.total_points >= 0 ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <span className={`text-sm font-bold ${
                totalSummary.total_points >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ₩
              </span>
            </div>
                          <div>
                <p className="text-sm font-medium text-gray-600">총 잔액</p>
                <p className={`text-2xl font-bold ${getPointsColor(totalSummary.total_points)}`}>
                  {totalSummary.total_points < 0 ? '-' : ''}{formatCurrency(Math.abs(totalSummary.total_points))}
                </p>
              </div>
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900">회사별 마일리지 현황</h2>
        <Button onClick={refresh} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* 회사별 포인트 테이블 */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  순위
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  회사명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  대표자명
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  회원 수
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  총 적립액
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  총 사용액
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  현재 잔액
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {totalPoints.map((company, index) => (
                <tr key={company.company_name} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${
                        index < 3 
                          ? index === 0 ? 'bg-yellow-100 text-yellow-800' 
                            : index === 1 ? 'bg-gray-100 text-gray-800'
                            : 'bg-orange-100 text-orange-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {index + 1}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{company.company_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {company.representative_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatNumber(company.user_count)}명
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 text-right font-medium">
                    {formatCurrency(company.total_earned)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 text-right font-medium">
                    {formatCurrency(company.total_spent)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold">
                    <span className={getPointsColor(company.total_points)}>
                      {company.total_points < 0 ? '-' : ''}{formatCurrency(Math.abs(company.total_points))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPoints.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">등록된 회사가 없습니다.</p>
        </div>
      )}
    </div>
  )
} 