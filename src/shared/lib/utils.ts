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
  const d = new Date(date)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul'
  })
}

export function formatDateTime(date: Date | string) {
  const d = new Date(date)
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Seoul'
  })
}

export function formatDateTimeWithSeconds(date: Date | string) {
  const d = new Date(date)
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Seoul'
  })
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

export function getKoreaDate(): string {
  const koreaTime = new Date(Date.now() + (9 * 60 * 60 * 1000)) // UTC + 9시간
  return koreaTime.toISOString().split('T')[0]
}

export function getKoreaDateFormatted(): string {
  const koreaTime = new Date(Date.now() + (9 * 60 * 60 * 1000)) // UTC + 9시간
  return koreaTime.toISOString().split('T')[0].replace(/-/g, '')
} 