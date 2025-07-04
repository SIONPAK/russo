'use client'

import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { X, Upload, Download, FileText } from 'lucide-react'
import { Order } from '../model/use-order-management'

interface BulkTrackingModalProps {
  isOpen: boolean
  onClose: () => void
  selectedOrders: Order[]
  onUpdate: (orderIds: string[], status: Order['status'], trackingNumbers: string[]) => Promise<boolean>
}

export function BulkTrackingModal({
  isOpen,
  onClose,
  selectedOrders,
  onUpdate
}: BulkTrackingModalProps) {
  const [trackingNumbers, setTrackingNumbers] = useState<{ [orderId: string]: string }>({})
  const [updating, setUpdating] = useState(false)

  if (!isOpen) return null

  const handleTrackingNumberChange = (orderId: string, value: string) => {
    setTrackingNumbers(prev => ({
      ...prev,
      [orderId]: value
    }))
  }

  const handleBulkUpdate = async () => {
    try {
      setUpdating(true)
      
      const orderIds = selectedOrders.map(order => order.id)
      const trackingNumbersArray = selectedOrders.map(order => 
        trackingNumbers[order.id] || ''
      )
      
      const success = await onUpdate(orderIds, 'shipped', trackingNumbersArray)
      
      if (success) {
        onClose()
        setTrackingNumbers({})
      }
    } catch (error) {
      console.error('일괄 업데이트 실패:', error)
    } finally {
      setUpdating(false)
    }
  }

  const handleExcelUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // TODO: 엑셀 파일 파싱 로직 구현
    console.log('엑셀 파일 업로드:', file.name)
  }

  const downloadTemplate = () => {
    // 템플릿 엑셀 파일 다운로드
    const csvContent = [
      ['주문번호', '운송장번호'],
      ...selectedOrders.map(order => [order.order_number, ''])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `운송장_템플릿_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              운송장 번호 일괄 등록
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              선택된 {selectedOrders.length}건의 주문에 운송장 번호를 등록하고 배송중 상태로 변경합니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* 액션 버튼 */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              템플릿 다운로드
            </Button>
            
            <div className="relative">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button variant="outline" className="flex items-center">
                <Upload className="h-4 w-4 mr-2" />
                엑셀 업로드
              </Button>
            </div>
            
            <div className="text-sm text-gray-600">
              <FileText className="h-4 w-4 inline mr-1" />
              Excel/CSV 파일로 일괄 등록 가능
            </div>
          </div>
        </div>

        {/* 주문 목록 */}
        <div className="p-6 overflow-y-auto max-h-96">
          <div className="space-y-4">
            {selectedOrders.map((order) => (
              <div key={order.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {order.order_number}
                  </div>
                  <div className="text-sm text-gray-600">
                    {order.users?.company_name} - {order.shipping_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    상품 {order.order_items.length}개 - {order.total_amount.toLocaleString()}원
                  </div>
                </div>
                
                <div className="w-64">
                  <Input
                    placeholder="운송장 번호 입력"
                    value={trackingNumbers[order.id] || ''}
                    onChange={(e) => handleTrackingNumberChange(order.id, e.target.value)}
                    className="text-center"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            운송장 번호를 입력하지 않은 주문은 운송장 없이 배송중 상태로만 변경됩니다.
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
              onClick={handleBulkUpdate}
              disabled={updating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updating ? '처리중...' : '일괄 업데이트'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
} 