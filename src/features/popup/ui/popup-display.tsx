'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { usePopupDisplay } from '../model/use-popup-display'

export function PopupDisplay() {
  const { activePopups, hidePopupForToday, closePopup } = usePopupDisplay()
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (activePopups.length === 0) return null

  const handleDragStart = (e: React.DragEvent, popupId: string) => {
    if (isMobile) return // 모바일에서는 드래그 비활성화
    
    const rect = (e.target as HTMLElement).getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    
    e.dataTransfer?.setData('text/plain', JSON.stringify({ popupId, offsetX, offsetY }))
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (isMobile) return
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    if (isMobile) return
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
        // 모바일에서는 중앙 정렬, 데스크톱에서는 기존 위치
        const defaultPosition = isMobile 
          ? { x: 20, y: 20 + (index * 20) } // 모바일: 좌상단에서 시작
          : { x: 50 + (index * 20), y: 50 + (index * 20) }
        
        const position = dragPositions[popup.id] || defaultPosition

        // 모바일에서는 모바일 전용 크기 사용, 없으면 데스크탑 크기 사용
        const popupWidth = isMobile 
          ? Math.min(popup.mobile_width || popup.width, window.innerWidth - 40) // 좌우 여백 20px씩
          : popup.width + 10
        
        const popupHeight = isMobile
          ? Math.min((popup.mobile_height || popup.height) + 40, window.innerHeight - 40) // 상하 여백 20px씩
          : popup.height + 40

        return (
          <div
            key={popup.id}
            className={`absolute pointer-events-auto bg-white rounded-lg shadow-2xl border overflow-hidden ${
              isMobile ? '' : 'cursor-move'
            }`}
            style={{
              left: isMobile ? '20px' : `${position.x}px`,
              top: isMobile ? `${20 + (index * 20)}px` : `${position.y}px`,
              width: `${popupWidth}px`,
              height: `${popupHeight}px`,
              zIndex: 1000 + index,
              maxWidth: isMobile ? 'calc(100vw - 40px)' : 'none',
              maxHeight: isMobile ? 'calc(100vh - 40px)' : 'none'
            }}
            draggable={!isMobile}
            onDragStart={(e) => handleDragStart(e, popup.id)}
          >
            {/* 팝업 헤더 */}
           

            {/* 팝업 이미지 */}
            <div 
              className="w-full overflow-hidden"
              style={{ height: isMobile ? `${popup.mobile_height || popup.height}px` : `${popup.height + 10}px` }}
            >
              <img
                src={isMobile && popup.mobile_image_url ? popup.mobile_image_url : popup.image_url}
                alt={popup.title}
                className="w-full h-full object-contain"
                draggable={false}
              />
            </div>

            <div className={`flex items-center justify-between ${isMobile ? '' : 'cursor-move'} p-2`}>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => hidePopupForToday(popup.id)}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                  title="오늘 하루 보지 않음"
                >
                  {isMobile ? '오늘 안보기' : '오늘 하루 보지 않음'}
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