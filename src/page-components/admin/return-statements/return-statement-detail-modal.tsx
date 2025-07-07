'use client'

import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Button } from '@/shared/ui/button'
import { CheckCircle, XCircle } from 'lucide-react'

interface ReturnStatement {
  id: string
  statement_number: string
  order_id: string
  order_number: string
  company_name: string
  customer_grade: string
  return_reason: string
  return_type: 'defect' | 'size_issue' | 'color_issue' | 'customer_change' | 'other'
  created_at: string
  processed_at: string | null
  refunded: boolean
  refund_amount: number
  refund_method: 'mileage' | 'card' | 'bank_transfer'
  status: 'pending' | 'approved' | 'refunded' | 'rejected'
  items: {
    product_name: string
    color: string
    size: string
    return_quantity: number
    unit_price: number
    total_price: number
  }[]
  total_amount: number
  email_sent: boolean
  email_sent_at: string | null
}

interface ReturnStatementDetailModalProps {
  statement: ReturnStatement
  isOpen: boolean
  onClose: () => void
  onApprove: (statementId: string) => void
  onReject: (statementId: string) => void
  getReturnTypeText: (type: string) => string
  getReturnTypeColor: (type: string) => string
  getStatusText: (status: string) => string
  getStatusColor: (status: string) => string
}

export default function ReturnStatementDetailModal({
  statement,
  isOpen,
  onClose,
  onApprove,
  onReject,
  getReturnTypeText,
  getReturnTypeColor,
  getStatusText,
  getStatusColor
}: ReturnStatementDetailModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">반품명세서 상세보기</h3>
          <Button
            variant="outline"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            닫기
          </Button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-3">반품 정보</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">명세서 번호:</span> {statement.statement_number}</div>
                  <div><span className="font-medium">주문번호:</span> {statement.order_number}</div>
                  <div><span className="font-medium">생성일:</span> {format(new Date(statement.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}</div>
                  <div>
                    <span className="font-medium">반품 유형:</span>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getReturnTypeColor(statement.return_type)}`}>
                      {getReturnTypeText(statement.return_type)}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">상태:</span>
                    <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(statement.status)}`}>
                      {getStatusText(statement.status)}
                    </span>
                  </div>
                  <div><span className="font-medium">반품 사유:</span> {statement.return_reason}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-3">고객 정보</h4>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">회사명:</span> {statement.company_name}</div>
                  <div><span className="font-medium">환불 방법:</span> {statement.refund_method === 'mileage' ? '마일리지' : statement.refund_method === 'card' ? '카드' : '계좌이체'}</div>
                  <div><span className="font-medium">환불 금액:</span> {statement.refund_amount.toLocaleString()}원</div>
                  <div><span className="font-medium">이메일 발송:</span> {statement.email_sent ? '발송완료' : '미발송'}</div>
                  {statement.email_sent_at && (
                    <div><span className="font-medium">발송일시:</span> {format(new Date(statement.email_sent_at), 'yyyy-MM-dd HH:mm', { locale: ko })}</div>
                  )}
                </div>
              </div>
            </div>

            {/* 반품 상품 목록 */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">반품 상품 목록</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">상품명</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">색상/사이즈</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">수량</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">단가</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">총액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {statement.items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-gray-900 border-r">{item.product_name}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 border-r">
                          {item.color && item.size ? `${item.color} / ${item.size}` : '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 border-r">{item.return_quantity}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 border-r">{item.unit_price.toLocaleString()}원</td>
                        <td className="px-4 py-2 text-sm text-gray-900 font-medium">{item.total_price.toLocaleString()}원</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right text-sm font-medium text-gray-900 border-r">
                        총 환불 금액:
                      </td>
                      <td className="px-4 py-2 text-sm font-bold text-blue-600">
                        {statement.refund_amount.toLocaleString()}원
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          {statement.status === 'pending' && (
            <>
              <Button
                onClick={() => {
                  onClose()
                  onReject(statement.id)
                }}
                variant="outline"
                className="text-red-600 hover:text-red-700"
              >
                <XCircle className="h-4 w-4 mr-2" />
                반품 거절
              </Button>
              <Button
                onClick={() => {
                  onClose()
                  onApprove(statement.id)
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                반품 승인
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={onClose}
          >
            닫기
          </Button>
        </div>
      </div>
    </div>
  )
} 