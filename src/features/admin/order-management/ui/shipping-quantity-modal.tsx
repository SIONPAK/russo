'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { X, Package, AlertTriangle } from 'lucide-react'
import { formatCurrency } from '@/shared/lib/utils'
import { showSuccess, showError } from '@/shared/lib/toast'

interface OrderItem {
  id: string
  product_name: string
  color: string
  size: string
  quantity: number
  shipped_quantity?: number
  unit_price: number
  total_price: number
}

interface Order {
  id: string
  order_number: string
  order_items: OrderItem[]
  users?: {
    company_name: string
    representative_name: string
  }
}

interface ShippingQuantityModalProps {
  isOpen: boolean
  onClose: () => void
  order: Order | null
  onUpdate: (orderId: string, items: Array<{ id: string; shipped_quantity: number }>) => Promise<boolean>
}

export function ShippingQuantityModal({
  isOpen,
  onClose,
  order,
  onUpdate
}: ShippingQuantityModalProps) {
  const [shippedQuantities, setShippedQuantities] = useState<{ [itemId: string]: number }>({})
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    if (order && isOpen) {
      // 기존 출고 수량 또는 주문 수량으로 초기화
      const initialQuantities: { [itemId: string]: number } = {}
      order.order_items.forEach(item => {
        initialQuantities[item.id] = item.shipped_quantity || item.quantity
      })
      setShippedQuantities(initialQuantities)
    }
  }, [order, isOpen])

  if (!isOpen || !order) return null

  const handleQuantityChange = (itemId: string, value: string) => {
    const numValue = parseInt(value) || 0
    setShippedQuantities(prev => ({
      ...prev,
      [itemId]: numValue
    }))
  }

  const handleUpdate = async () => {
    try {
      setUpdating(true)
      
      const items = order.order_items.map(item => ({
        id: item.id,
        shipped_quantity: shippedQuantities[item.id] || 0
      }))
      
      const success = await onUpdate(order.id, items)
      
      if (success) {
        onClose()
      }
    } catch (error) {
      console.error('출고 수량 업데이트 실패:', error)
      showError('출고 수량 업데이트에 실패했습니다.')
    } finally {
      setUpdating(false)
    }
  }

  const getTotalShippedAmount = () => {
    return order.order_items.reduce((total, item) => {
      const shippedQty = shippedQuantities[item.id] || 0
      return total + (item.unit_price * shippedQty)
    }, 0)
  }

  const hasChanges = () => {
    return order.order_items.some(item => {
      const currentShipped = shippedQuantities[item.id] || 0
      const originalShipped = item.shipped_quantity || item.quantity
      return currentShipped !== originalShipped
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              출고 수량 관리
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              주문번호: {order.order_number} | {order.users?.company_name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 안내 메시지 */}
        <div className="p-4 bg-yellow-50 border-b border-yellow-200">
          <div className="flex items-center text-yellow-800">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span className="text-sm">
              실제 출고되는 수량을 입력하세요. 재고 부족 등으로 주문 수량과 다를 수 있습니다.
            </span>
          </div>
        </div>

        {/* 상품 목록 */}
        <div className="p-6 overflow-y-auto max-h-96">
          <div className="space-y-4">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {item.product_name}
                  </div>
                  <div className="text-sm text-gray-600">
                    색상: {item.color} | 사이즈: {item.size}
                  </div>
                  <div className="text-sm text-gray-500">
                    단가: {formatCurrency(item.unit_price)}
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <div className="text-sm text-gray-500">주문 수량</div>
                    <div className="font-medium">{item.quantity}개</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-sm text-gray-500">출고 수량</div>
                    <Input
                      type="number"
                      min="0"
                      max={item.quantity}
                      value={shippedQuantities[item.id] || 0}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      className="w-20 text-center"
                    />
                  </div>
                  
                  <div className="text-center">
                    <div className="text-sm text-gray-500">출고 금액</div>
                    <div className="font-medium">
                      {formatCurrency(item.unit_price * (shippedQuantities[item.id] || 0))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 합계 */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              총 출고 금액
            </div>
            <div className="text-lg font-bold text-gray-900">
              {formatCurrency(getTotalShippedAmount())}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            출고 수량을 수정하면 거래명세서에 반영됩니다.
          </div>
          
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={updating}
            >
              취소
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updating || !hasChanges()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updating ? '처리중...' : '출고 수량 저장'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 