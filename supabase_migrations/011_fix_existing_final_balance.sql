-- 🚀 기존 final_balance 데이터 수정
-- 모든 마일리지 레코드의 final_balance를 올바르게 재계산

-- 1. 모든 사용자의 final_balance를 올바르게 재계산
UPDATE mileage 
SET final_balance = (
  SELECT COALESCE(SUM(
    CASE 
      WHEN type = 'earn' THEN ABS(amount)
      WHEN type = 'spend' THEN -ABS(amount)
      ELSE 0
    END
  ), 0)
  FROM mileage m2 
  WHERE m2.user_id = mileage.user_id 
  AND m2.status = 'completed'
  AND m2.created_at <= mileage.created_at
)
WHERE status = 'completed';

-- 2. 사용자 테이블의 mileage_balance도 업데이트
UPDATE users 
SET mileage_balance = (
  SELECT COALESCE(SUM(
    CASE 
      WHEN type = 'earn' THEN ABS(amount)
      WHEN type = 'spend' THEN -ABS(amount)
      ELSE 0
    END
  ), 0)
  FROM mileage 
  WHERE mileage.user_id = users.id 
  AND mileage.status = 'completed'
);

-- 3. 결과 확인
SELECT 
  u.company_name,
  u.mileage_balance as user_balance,
  COUNT(m.id) as mileage_count,
  MAX(m.final_balance) as max_final_balance
FROM users u
LEFT JOIN mileage m ON u.id = m.user_id AND m.status = 'completed'
GROUP BY u.id, u.company_name, u.mileage_balance
ORDER BY u.mileage_balance DESC
LIMIT 10;
