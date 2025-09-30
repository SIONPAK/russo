-- 🚀 간단한 함수 존재 확인

-- 1. 함수 목록 확인
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND (routine_name LIKE '%physical_stock%' OR routine_name LIKE '%stock%')
ORDER BY routine_name;

-- 2. 특정 함수 존재 확인
SELECT 
  'add_physical_stock' as function_name,
  CASE WHEN COUNT(*) > 0 THEN '존재함' ELSE '없음' END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'add_physical_stock'

UNION ALL

SELECT 
  'adjust_physical_stock' as function_name,
  CASE WHEN COUNT(*) > 0 THEN '존재함' ELSE '없음' END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'adjust_physical_stock';
