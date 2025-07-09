'use client'

import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Button } from '@/shared/ui/button'
import { CheckCircle, XCircle, Edit2, Save, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { showSuccess, showError } from '@/shared/lib/toast'

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
    total_price?: number
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
  onUpdateItems?: (statementId: string, items: ReturnStatement['items']) => void
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
  onUpdateItems,
  getReturnTypeText,
  getReturnTypeColor,
  getStatusText,
  getStatusColor
}: ReturnStatementDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedItems, setEditedItems] = useState(statement?.items || [])
  const [isSaving, setIsSaving] = useState(false)

  // statement가 변경될 때마다 editedItems 업데이트
  useEffect(() => {
    if (statement?.items) {
      console.log('Statement items:', statement.items)
      console.log('First item structure:', statement.items[0])
      setEditedItems(statement.items)
    }
  }, [statement])

  if (!isOpen || !statement) return null

  // 안전한 데이터 접근 함수들
  const getQuantity = (item: any) => {
    return item.return_quantity || item.quantity || item.shipped_quantity || 0
  }

  const getUnitPrice = (item: any) => {
    return item.unit_price || item.price || 0
  }

  const getTotalPrice = (item: any) => {
    const quantity = getQuantity(item)
    const unitPrice = getUnitPrice(item)
    if (item.total_price) {
      return item.total_price
    }
    // 부가세 포함 계산
    const supplyAmount = quantity * unitPrice
    const vat = Math.floor(supplyAmount * 0.1)
    return supplyAmount + vat
  }

  const handleEditItem = (index: number, field: string, value: string | number) => {
    const newItems = [...editedItems]
    
    // 필드명 매핑 처리
    if (field === 'return_quantity') {
      // quantity 필드로도 저장
      newItems[index] = {
        ...newItems[index],
        return_quantity: Number(value) || 0,
        quantity: Number(value) || 0
      } as any
    } else {
      newItems[index] = {
        ...newItems[index],
        [field]: value
      } as any
    }
    
    // 수량이나 단가가 변경되면 총액 재계산 (부가세 포함)
    if (field === 'return_quantity' || field === 'unit_price') {
      const quantity = field === 'return_quantity' ? Number(value) || 0 : getQuantity(newItems[index])
      const unitPrice = field === 'unit_price' ? Number(value) || 0 : getUnitPrice(newItems[index])
      const supplyAmount = quantity * unitPrice
      const vat = Math.floor(supplyAmount * 0.1)
      const totalPrice = supplyAmount + vat
      newItems[index] = {
        ...newItems[index],
        total_price: totalPrice,
        total_amount: totalPrice
      } as any
    }
    
    setEditedItems(newItems)
  }

  const handleSaveChanges = async () => {
    if (!onUpdateItems || isSaving) return
    
    try {
      setIsSaving(true)
      await onUpdateItems(statement.id, editedItems)
      setIsEditing(false)
    } catch (error) {
      console.error('저장 중 오류:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditedItems(statement.items)
    setIsEditing(false)
  }

  const currentItems = isEditing ? editedItems : statement.items

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        // 저장 중에는 배경 클릭으로 모달 닫기 방지
        if (!isSaving && e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden relative">
        {/* 저장 중 로딩 오버레이 */}
        {isSaving && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-10">
            <div className="bg-white rounded-lg p-6 flex flex-col items-center space-y-3 shadow-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="text-sm font-medium text-gray-700">저장 중입니다...</span>
            </div>
          </div>
        )}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">반품명세서 상세보기</h3>
          <div className="flex items-center space-x-2">
            {!isEditing ? (
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
                disabled={isSaving}
                className="text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                편집
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="text-gray-600 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="h-4 w-4 mr-2" />
                  취소
                </Button>
                <Button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      저장 중...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      저장
                    </>
                  )}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSaving}
              className="text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              닫기
            </Button>
          </div>
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
                  <div><span className="font-medium">환불 금액:</span> {currentItems.reduce((sum, item) => {
                    const quantity = getQuantity(item)
                    const unitPrice = getUnitPrice(item)
                    const supplyAmount = quantity * unitPrice
                    const vat = Math.floor(supplyAmount * 0.1)
                    return sum + supplyAmount + vat
                  }, 0).toLocaleString()}원 (세금포함)</div>
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
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">색상</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">사이즈</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">수량</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">
                        단가<br/>
                        <span className="text-xs text-gray-600">(세금제외)</span>
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 border-r">
                        부가세<br/>
                        <span className="text-xs text-gray-600">(10%)</span>
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                        합계<br/>
                        <span className="text-xs text-blue-600">(단가+부가세)</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentItems.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-gray-900 border-r">{item.product_name}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 border-r">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.color || ''}
                              onChange={(e) => handleEditItem(index, 'color', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            item.color || '-'
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 border-r">
                          {isEditing ? (
                            <input
                              type="text"
                              value={item.size || ''}
                              onChange={(e) => handleEditItem(index, 'size', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            item.size || '-'
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 border-r">
                          {isEditing ? (
                            <input
                              type="number"
                              value={getQuantity(item)}
                              onChange={(e) => handleEditItem(index, 'return_quantity', parseInt(e.target.value) || 0)}
                              disabled={isSaving}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              min="0"
                            />
                          ) : (
                            getQuantity(item)
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 border-r">
                          {isEditing ? (
                            <input
                              type="number"
                              value={getUnitPrice(item)}
                              onChange={(e) => handleEditItem(index, 'unit_price', parseInt(e.target.value) || 0)}
                              disabled={isSaving}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              min="0"
                            />
                          ) : (
                            `${getUnitPrice(item).toLocaleString()}원`
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 border-r">
                          {(() => {
                            const quantity = getQuantity(item)
                            const unitPrice = getUnitPrice(item)
                            const vat = Math.floor(quantity * unitPrice * 0.1)
                            return `${vat.toLocaleString()}원`
                          })()}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 font-medium">
                          {(() => {
                            const quantity = getQuantity(item)
                            const unitPrice = getUnitPrice(item)
                            const supplyAmount = quantity * unitPrice
                            const vat = Math.floor(supplyAmount * 0.1)
                            return `${(supplyAmount + vat).toLocaleString()}원`
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right text-sm font-medium text-gray-900 border-r">
                        합계:
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r">
                        {currentItems.reduce((sum, item) => {
                          const quantity = getQuantity(item)
                          const unitPrice = getUnitPrice(item)
                          return sum + (quantity * unitPrice)
                        }, 0).toLocaleString()}원
                      </td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 border-r">
                        {currentItems.reduce((sum, item) => {
                          const quantity = getQuantity(item)
                          const unitPrice = getUnitPrice(item)
                          const vat = Math.floor(quantity * unitPrice * 0.1)
                          return sum + vat
                        }, 0).toLocaleString()}원
                      </td>
                      <td className="px-4 py-2 text-sm font-bold text-blue-600">
                        {currentItems.reduce((sum, item) => {
                          const quantity = getQuantity(item)
                          const unitPrice = getUnitPrice(item)
                          const supplyAmount = quantity * unitPrice
                          const vat = Math.floor(supplyAmount * 0.1)
                          return sum + supplyAmount + vat
                        }, 0).toLocaleString()}원
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
                disabled={isSaving}
                variant="outline"
                className="text-red-600 hover:text-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle className="h-4 w-4 mr-2" />
                반품 거절
              </Button>
              <Button
                onClick={() => {
                  onClose()
                  onApprove(statement.id)
                }}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                반품 승인
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="disabled:opacity-50 disabled:cursor-not-allowed"
          >
            닫기
          </Button>
        </div>
      </div>
    </div>
  )
} 