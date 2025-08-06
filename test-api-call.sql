-- API 호출 테스트용 쿼리

-- 1. 2025-08-07 working_date 주문들 확인
SELECT 
  id,
  order_number,
  created_at,
  working_date,
  status,
  total_amount
FROM orders 
WHERE working_date = '2025-08-07'
  AND order_number LIKE 'PO%'
  AND order_type != 'return_only'
  AND status != 'shipped'
ORDER BY created_at DESC;

-- 2. 전체 조건 확인 (API와 동일한 조건)
SELECT 
  id,
  order_number,
  created_at,
  working_date,
  status,
  total_amount
FROM orders 
WHERE working_date = '2025-08-07'
  AND order_number LIKE 'PO%'
  AND order_type != 'return_only'
ORDER BY created_at DESC;

-- 3. 상태별 개수 확인
SELECT 
  status,
  COUNT(*) as count
FROM orders 
WHERE working_date = '2025-08-07'
  AND order_number LIKE 'PO%'
  AND order_type != 'return_only'
GROUP BY status; 