-- 마일리지 테이블 성능 최적화를 위한 인덱스 추가

-- 1. 복합 인덱스: user_id + created_at (가장 자주 사용되는 조합)
CREATE INDEX IF NOT EXISTS idx_mileage_user_created_optimized 
ON mileage(user_id, created_at DESC);

-- 2. 복합 인덱스: status + type + created_at (필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_mileage_status_type_created 
ON mileage(status, type, created_at DESC);

-- 3. 복합 인덱스: source + created_at (소스별 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_mileage_source_created 
ON mileage(source, created_at DESC);

-- 4. 날짜 범위 조회 최적화
CREATE INDEX IF NOT EXISTS idx_mileage_created_optimized 
ON mileage(created_at DESC);

-- 5. final_balance 조회 최적화
CREATE INDEX IF NOT EXISTS idx_mileage_final_balance_optimized 
ON mileage(final_balance DESC);

-- 6. 사용자별 final_balance 조회 최적화
CREATE INDEX IF NOT EXISTS idx_mileage_user_final_balance 
ON mileage(user_id, final_balance DESC);

-- 7. 복합 인덱스: 모든 주요 필터 조합
CREATE INDEX IF NOT EXISTS idx_mileage_comprehensive 
ON mileage(user_id, status, type, source, created_at DESC);

-- 8. 부분 인덱스: completed 상태만 (가장 많이 조회되는 데이터)
CREATE INDEX IF NOT EXISTS idx_mileage_completed_optimized 
ON mileage(created_at DESC) 
WHERE status = 'completed';

-- 9. 부분 인덱스: earn 타입만
CREATE INDEX IF NOT EXISTS idx_mileage_earn_optimized 
ON mileage(created_at DESC) 
WHERE type = 'earn';

-- 10. 부분 인덱스: spend 타입만
CREATE INDEX IF NOT EXISTS idx_mileage_spend_optimized 
ON mileage(created_at DESC) 
WHERE type = 'spend';
