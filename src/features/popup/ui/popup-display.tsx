'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { usePopupDisplay } from '../model/use-popup-display'

export function PopupDisplay() {
  const { activePopups, hidePopupForToday, closePopup } = usePopupDisplay()
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({})

  if (activePopups.length === 0) return null

  const handleDragStart = (e: React.DragEvent, popupId: string) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    
    e.dataTransfer?.setData('text/plain', JSON.stringify({ popupId, offsetX, offsetY }))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'))
      const { popupId, offsetX, offsetY } = data
      
      const newX = e.clientX - offsetX
      const newY = e.clientY - offsetY
      
      setDragPositions(prev => ({
        ...prev,
        [popupId]: { x: newX, y: newY }
      }))
    } catch (error) {
      console.error('드래그 처리 실패:', error)
    }
  }

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-50"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {activePopups.map((popup, index) => {
        const position = dragPositions[popup.id] || { 
          x: 50 + (index * 20), 
          y: 50 + (index * 20) 
        }

        return (
          <div
            key={popup.id}
            className="absolute pointer-events-auto bg-white rounded-lg shadow-2xl border overflow-hidden cursor-move"
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
              width: `${popup.width + 10}px`,
              height: `${popup.height + 40}px`, // 헤더 높이 추가
              zIndex: 1000 + index
            }}
            draggable
            onDragStart={(e) => handleDragStart(e, popup.id)}
          >
            {/* 팝업 헤더 */}
           

            {/* 팝업 이미지 */}
            <div 
              className="w-full overflow-hidden"
              style={{ height: `${popup.height + 10}px` }}
            >
              <img
                src={popup.image_url}
                alt={popup.title}
                className="w-full h-full"
                draggable={false}
              />
            </div>

            <div className="flex items-center justify-between cursor-move">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => hidePopupForToday(popup.id)}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                  title="오늘 하루 보지 않음"
                >
                  오늘 하루 보지 않음
                </button>
                <button
                  onClick={() => closePopup(popup.id)}
                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded"
                  title="닫기"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
} 