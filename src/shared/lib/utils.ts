import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
  }).format(amount)
}

export function formatBusinessNumber(businessNumber: string) {
  // 사업자등록번호 형식: 123-45-67890
  if (businessNumber.length === 10) {
    return businessNumber.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3')
  }
  return businessNumber
}

export function validateBusinessNumber(businessNumber: string) {
  const cleaned = businessNumber.replace(/-/g, '')
  if (cleaned.length !== 10) return '사업자등록번호는 10자리여야 합니다'
  
  // 테스트용으로 길이만 체크
  return true
}

// 한국시간 유틸리티 함수들
export function getKoreanTime(date?: Date): Date {
  // UTC+9 (한국시간)으로 변환
  const targetDate = date || new Date()
  return new Date(targetDate.getTime() + (9 * 60 * 60 * 1000))
}

export function getKoreanTimeISO(date?: Date): string {
  // 한국시간을 ISO 문자열로 반환
  return getKoreanTime(date).toISOString()
}

export function formatDate(date: Date | string) {
  // DB에 이미 한국 시간 문자열로 저장되어 있으므로 그대로 사용
  if (typeof date === 'string') {
    // "2025-07-09T11:07:00" 또는 "2025-07-09 11:07:00" 형태에서 날짜만 추출
    const dateMatch = date.match(/(\d{4}-\d{2}-\d{2})/)
    if (dateMatch) {
      return dateMatch[1]
    }
  }
  
  // 백업으로 Date 객체 처리
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

export function formatDateTime(date: Date | string) {
  // DB에 이미 한국 시간 문자열로 저장되어 있으므로 그대로 사용
  if (typeof date === 'string') {
    // "2025-07-09T11:07:00" 또는 "2025-07-09 11:07:00" 형태에서 시분까지만 추출
    const dateTimeMatch = date.match(/(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/)
    if (dateTimeMatch) {
      return `${dateTimeMatch[1]} ${dateTimeMatch[2]}`
    }
    // 날짜만 있는 경우
    const dateMatch = date.match(/(\d{4}-\d{2}-\d{2})/)
    if (dateMatch) {
      return dateMatch[1]
    }
  }
  
  // 백업으로 Date 객체 처리 (하지만 이미 변환된 경우)
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hour}:${minute}`
}

export function formatDateTimeWithSeconds(date: Date | string) {
  // DB에 이미 한국 시간 문자열로 저장되어 있으므로 그대로 사용
  if (typeof date === 'string') {
    // "2025-07-09T11:07:30" 또는 "2025-07-09 11:07:30" 형태에서 초까지 추출
    const dateTimeMatch = date.match(/(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}:\d{2})/)
    if (dateTimeMatch) {
      return `${dateTimeMatch[1]} ${dateTimeMatch[2]}`
    }
    // 초가 없는 경우
    const dateTimeNoSecMatch = date.match(/(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})/)
    if (dateTimeNoSecMatch) {
      return `${dateTimeNoSecMatch[1]} ${dateTimeNoSecMatch[2]}:00`
    }
  }
  
  // 백업으로 Date 객체 처리
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  const second = String(d.getSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

export function formatTimeAgo(date: Date | string) {
  const now = new Date()
  const target = new Date(date)
  const diffInMinutes = Math.floor((now.getTime() - target.getTime()) / (1000 * 60))
  
  if (diffInMinutes < 1) return '방금 전'
  if (diffInMinutes < 60) return `${diffInMinutes}분 전`
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}시간 전`
  return `${Math.floor(diffInMinutes / 1440)}일 전`
}

export function getCurrentKoreanDateString(): string {
  // 한국시간 기준 YYYY-MM-DD 형식
  const koreanTime = getKoreanTime()
  return koreanTime.toISOString().split('T')[0]
}

export function getCurrentKoreanDateTime(): string {
  // 정확한 한국시간 (Asia/Seoul 시간대 사용)
  const now = new Date()
  return now.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T') + '+09:00'
}

export function getCurrentKoreanDateTimeISO(): string {
  // ISO 8601 형식으로 한국시간 반환
  const now = new Date()
  const koreanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  return koreanTime.toISOString()
}

// 한국 시간 헬퍼 함수
export function getKoreaTime(): string {
  const koreaTime = new Date(Date.now() + (9 * 60 * 60 * 1000)) // UTC + 9시간
  return koreaTime.toISOString()
}

// 한국시간 Date 객체 반환 (일관된 방식) - 새로 추가
export function getKoreaTimeDate(): Date {
  const now = new Date()
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
}

export function getKoreaDate(): string {
  const koreaTime = new Date(Date.now() + (9 * 60 * 60 * 1000)) // UTC + 9시간
  return koreaTime.toISOString().split('T')[0]
}

export function getKoreaDateFormatted(): string {
  const koreaTime = new Date(Date.now() + (9 * 60 * 60 * 1000)) // UTC + 9시간
  return koreaTime.toISOString().split('T')[0].replace(/-/g, '')
} 

/**
 * 한국 전화번호를 적절한 형식으로 포맷팅합니다.
 * 지원 형식:
 * - 휴대폰: 010-1234-5678, 011-123-4567 등
 * - 서울: 02-1234-5678, 02-123-4567
 * - 지역번호: 031-123-4567, 070-1234-5678 등
 * 
 * @param value 입력된 전화번호 (숫자와 하이픈 포함 가능)
 * @returns 포맷팅된 전화번호
 */
export function formatPhoneNumber(value: string): string {
  // 숫자만 추출
  const numbersOnly = value.replace(/[^0-9]/g, '')
  
  // 빈 값 처리
  if (!numbersOnly) return ''
  
  // 최대 11자리까지만 허용
  const limitedNumbers = numbersOnly.slice(0, 11)
  const length = limitedNumbers.length
  
  // 길이에 따른 포맷팅
  if (length <= 2) {
    return limitedNumbers
  }
  
  // 서울 지역번호 (02)
  if (limitedNumbers.startsWith('02')) {
    if (length <= 2) return limitedNumbers
    if (length <= 5) return `02-${limitedNumbers.slice(2)}`
    if (length <= 9) return `02-${limitedNumbers.slice(2, 5)}-${limitedNumbers.slice(5)}`
    return `02-${limitedNumbers.slice(2, 6)}-${limitedNumbers.slice(6)}`
  }
  
  // 휴대폰 번호 (01X)
  if (limitedNumbers.startsWith('01')) {
    if (length <= 3) return limitedNumbers
    if (length <= 7) return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3)}`
    return `${limitedNumbers.slice(0, 3)}-${limitedNumbers.slice(3, 7)}-${limitedNumbers.slice(7)}`
  }
  
  // 3자리 지역번호 (031, 032, 070 등)
  if (length >= 3) {
    const areaCode = limitedNumbers.slice(0, 3)
    if (length <= 3) return areaCode
    if (length <= 6) return `${areaCode}-${limitedNumbers.slice(3)}`
    return `${areaCode}-${limitedNumbers.slice(3, 6)}-${limitedNumbers.slice(6)}`
  }
  
  return limitedNumbers
} 