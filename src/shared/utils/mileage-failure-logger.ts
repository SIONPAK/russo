// 마일리지 실패 로그 관련 타입 및 유틸리티
import { createClient } from '@/shared/lib/supabase/server'

export const MILEAGE_FAILURE_REASONS = {
  MEMBER_NOT_FOUND: 'MEMBER_NOT_FOUND',
  API_ERROR: 'API_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  DUPLICATE_TRANSACTION: 'DUPLICATE_TRANSACTION',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
} as const

export type MileageFailureReason = typeof MILEAGE_FAILURE_REASONS[keyof typeof MILEAGE_FAILURE_REASONS]

export interface MileageFailureLog {
  business_name: string
  attempted_amount: number
  reason: MileageFailureReason
  error_details: string
  settlement_type: string
  settlement_date: string
  original_data?: any
}

// 마일리지 실패 로그 기록 함수
export async function logMileageFailure(failureData: MileageFailureLog): Promise<void> {
  try {
    console.log('마일리지 실패 로그 저장:', failureData)
    
    const supabase = await createClient()
    
    // 🔍 완전 중복 방지: 동일한 로그가 이미 존재하면 아예 등록하지 않음
    
    // 1. 완전 동일한 로그 체크 (시간 제한 없음)
    const { data: exactDuplicateLog } = await supabase
      .from('lusso_mileage_failure_logs')
      .select('id, created_at')
      .eq('business_name', failureData.business_name)
      .eq('attempted_amount', failureData.attempted_amount)
      .eq('reason', failureData.reason)
      .eq('error_details', failureData.error_details)
      .eq('settlement_type', failureData.settlement_type)
      .eq('settlement_date', failureData.settlement_date)
      .limit(1)
    
    if (exactDuplicateLog && exactDuplicateLog.length > 0) {
      console.log('🚫 완전 동일한 실패 로그가 이미 존재 - 등록 건너뛰기:', failureData.business_name, exactDuplicateLog[0].created_at)
      return
    }
    
    const { error } = await supabase
      .from('lusso_mileage_failure_logs')
      .insert({
        business_name: failureData.business_name,
        attempted_amount: failureData.attempted_amount,
        reason: failureData.reason,
        error_details: failureData.error_details,
        settlement_type: failureData.settlement_type,
        settlement_date: failureData.settlement_date,
        original_data: failureData.original_data,
        status: 'pending'
      })
    
    if (error) {
      console.error('마일리지 실패 로그 저장 중 오류:', error)
    } else {
      console.log('✅ 마일리지 실패 로그 저장 완료')
    }
    
  } catch (error) {
    console.error('마일리지 실패 로그 저장 중 오류:', error)
  }
}

// 마일리지 제외 로그 기록 함수 (중복 거래 등)
export async function logMileageExclusion(exclusionData: MileageFailureLog): Promise<void> {
  try {
    console.log('마일리지 제외 로그 저장:', exclusionData)
    
    const supabase = await createClient()
    
    // 🔍 완전 중복 방지: 동일한 제외 로그가 이미 존재하면 아예 등록하지 않음
    const { data: exactDuplicateExclusionLog } = await supabase
      .from('lusso_mileage_exclusion_logs')
      .select('id, created_at')
      .eq('business_name', exclusionData.business_name)
      .eq('attempted_amount', exclusionData.attempted_amount)
      .eq('reason', exclusionData.error_details)
      .eq('error_details', exclusionData.error_details)
      .eq('settlement_type', exclusionData.settlement_type)
      .eq('settlement_date', exclusionData.settlement_date)
      .limit(1)
    
    if (exactDuplicateExclusionLog && exactDuplicateExclusionLog.length > 0) {
      console.log('🚫 완전 동일한 제외 로그가 이미 존재 - 등록 건너뛰기:', exclusionData.business_name, exactDuplicateExclusionLog[0].created_at)
      return
    }
    
    const { error } = await supabase
      .from('lusso_mileage_exclusion_logs')
      .insert({
        business_name: exclusionData.business_name,
        attempted_amount: exclusionData.attempted_amount,
        reason: exclusionData.error_details, // 제외 사유
        error_details: exclusionData.error_details,
        settlement_type: exclusionData.settlement_type,
        settlement_date: exclusionData.settlement_date,
        original_data: exclusionData.original_data,
      })
    
    if (error) {
      console.error('마일리지 제외 로그 저장 중 오류:', error)
    } else {
      console.log('✅ 마일리지 제외 로그 저장 완료')
    }
    
  } catch (error) {
    console.error('마일리지 제외 로그 저장 중 오류:', error)
  }
} 