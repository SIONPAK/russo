/**
 * Supabase 배치 처리 유틸리티 함수
 */

export interface BatchQueryResult<T> {
  data: T[]
  error?: Error
  totalCount: number
  batchCount: number
}

/**
 * Supabase 쿼리를 배치로 실행하여 1000개 제한을 우회합니다.
 * @param query - Supabase 쿼리 객체
 * @param queryName - 로그용 쿼리 이름
 * @param maxBatches - 최대 배치 수 (기본값: 100)
 * @param batchSize - 배치 크기 (기본값: 1000)
 * @returns 배치 처리 결과
 */
export async function executeBatchQuery<T>(
  query: any,
  queryName: string = 'data',
  maxBatches: number = 100,
  batchSize: number = 1000
): Promise<BatchQueryResult<T>> {
  console.log(`📦 ${queryName} 배치 조회 시작`)
  
  const allData: T[] = []
  let offset = 0
  let hasMore = true
  let batchCount = 0

  while (hasMore && batchCount < maxBatches) {
    const { data: batchData, error: batchError } = await query
      .range(offset, offset + batchSize - 1)

    if (batchError) {
      console.error(`배치 ${batchCount + 1} 조회 오류:`, batchError)
      return {
        data: [],
        error: new Error(`${queryName} 배치 조회 오류: ${batchError.message}`),
        totalCount: 0,
        batchCount
      }
    }

    if (!batchData || batchData.length === 0) {
      hasMore = false
      break
    }

    allData.push(...batchData)
    offset += batchSize
    batchCount++

    console.log(`📦 배치 ${batchCount}: ${batchData.length}건 조회 (누적: ${allData.length}건)`)

    // 배치 크기보다 적게 나오면 마지막 배치
    if (batchData.length < batchSize) {
      hasMore = false
    }
  }

  console.log(`✅ ${queryName} 배치 조회 완료: 총 ${allData.length}건 (${batchCount}개 배치)`)
  
  return {
    data: allData,
    totalCount: allData.length,
    batchCount
  }
}

/**
 * 대용량 데이터 처리를 위한 배치 처리 헬퍼 함수
 */
export class BatchProcessor {
  private maxBatches: number
  private batchSize: number
  
  constructor(maxBatches: number = 100, batchSize: number = 1000) {
    this.maxBatches = maxBatches
    this.batchSize = batchSize
  }

  /**
   * 배치 처리 실행
   */
  async execute<T>(
    query: any,
    queryName: string = 'data'
  ): Promise<BatchQueryResult<T>> {
    return await executeBatchQuery<T>(
      query,
      queryName,
      this.maxBatches,
      this.batchSize
    )
  }

  /**
   * 배치 설정 변경
   */
  configure(maxBatches: number, batchSize: number) {
    this.maxBatches = maxBatches
    this.batchSize = batchSize
  }
}

/**
 * 기본 배치 프로세서 인스턴스
 */
export const defaultBatchProcessor = new BatchProcessor() 