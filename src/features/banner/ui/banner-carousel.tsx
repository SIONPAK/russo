'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useBanners } from '../model/use-banners'

export function BannerCarousel() {
  const { banners, loading } = useBanners()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  // 화면 크기 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 자동 슬라이드
  useEffect(() => {
    if (banners.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length)
    }, 5000) // 5초마다 변경

    return () => clearInterval(interval)
  }, [banners.length])

  if (loading) {
    return (
      <div className="relative w-full h-[300px] md:h-[400px] lg:h-[500px] xl:h-[600px] bg-gray-200 animate-pulse">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-400">배너 로딩 중...</div>
        </div>
      </div>
    )
  }

  if (banners.length === 0) {
    return (
      <div className="relative w-full h-[300px] md:h-[400px] lg:h-[500px] xl:h-[600px] bg-gray-100 flex items-center justify-center">
        <div className="text-gray-400">등록된 배너가 없습니다</div>
      </div>
    )
  }

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + banners.length) % banners.length)
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % banners.length)
  }

  const handleBannerClick = (banner) => {
    if (banner.link_url) {
      window.open(banner.link_url, '_blank')
    }
  }

  const currentBanner = banners[currentIndex]

  return (
    <div className="relative w-full h-[300px] md:h-[400px] lg:h-[500px] xl:h-[600px] overflow-hidden">
      {/* 배너 이미지 */}
      <div className="relative w-full h-full">
        <img
          src={isMobile ? currentBanner.mobile_image : currentBanner.desktop_image}
          alt={currentBanner.title}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            currentBanner.link_url ? 'cursor-pointer' : ''
          }`}
          onClick={() => handleBannerClick(currentBanner)}
        />
        
        {/* 오버레이 (링크가 있는 경우) */}
        {currentBanner.link_url && (
          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-300 flex items-center justify-center opacity-0 hover:opacity-100">
            <div className="bg-white bg-opacity-90 px-4 py-2 rounded-lg text-gray-900 font-medium">
              클릭하여 이동
            </div>
          </div>
        )}
      </div>

      {/* 이전/다음 버튼 (배너가 2개 이상일 때만) */}
      {banners.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all duration-200"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all duration-200"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* 인디케이터 (배너가 2개 이상일 때만) */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-3 h-3 rounded-full transition-all duration-200 ${
                index === currentIndex
                  ? 'bg-white'
                  : 'bg-white bg-opacity-50 hover:bg-opacity-75'
              }`}
            />
          ))}
        </div>
      )}

      {/* 배너 제목 (선택사항) */}
      {currentBanner.title && (
        <div className="absolute bottom-16 left-4 right-4 text-center">
          <h2 className="text-white text-lg md:text-xl lg:text-2xl font-bold drop-shadow-lg">
            {currentBanner.title}
          </h2>
        </div>
      )}
    </div>
  )
}
