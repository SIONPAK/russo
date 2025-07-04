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
  // Format: XXX-XX-XXXXX
  return businessNumber.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3')
}

export function validateBusinessNumber(businessNumber: string) {
  const cleaned = businessNumber.replace(/-/g, '')
  if (cleaned.length !== 10) return '사업자등록번호는 10자리여야 합니다'
  
  // 테스트용으로 길이만 체크
  return true
}

export function formatDate(date: Date | string) {
  const d = new Date(date)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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
  })
} 