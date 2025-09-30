-- 🚀 Supabase에서 RPC 함수 존재 여부 확인

-- 1. 모든 사용자 정의 함수 목록 확인
SELECT 
  routine_name,
  routine_type,
  data_type as return_type,
  routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%physical_stock%'
ORDER BY routine_name;

-- 2. 특정 함수 존재 여부 확인
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'add_physical_stock'
    ) THEN 'add_physical_stock 함수 존재함'
    ELSE 'add_physical_stock 함수 없음'
  END as add_physical_stock_status;

SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'adjust_physical_stock'
    ) THEN 'adjust_physical_stock 함수 존재함'
    ELSE 'adjust_physical_stock 함수 없음'
  END as adjust_physical_stock_status;

-- 3. 함수 파라미터 정보 확인
SELECT 
  p.specific_name,
  p.parameter_name,
  p.data_type,
  p.parameter_mode
FROM information_schema.parameters p
WHERE p.specific_schema = 'public'
AND p.specific_name IN (
  SELECT specific_name 
  FROM information_schema.routines 
  WHERE routine_schema = 'public' 
  AND routine_name IN ('add_physical_stock', 'adjust_physical_stock')
)
ORDER BY p.specific_name, p.ordinal_position;

-- 4. 함수 실행 테스트 (에러가 나면 함수가 없거나 파라미터가 틀림)
-- SELECT add_physical_stock('00000000-0000-0000-0000-000000000000', null, null, 0, '테스트');
-- SELECT adjust_physical_stock('00000000-0000-0000-0000-000000000000', null, null, 0, '테스트');
