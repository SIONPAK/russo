-- allocated_quantity 마이그레이션
-- 기존 데이터의 allocated_quantity를 shipped_quantity와 동일하게 설정

UPDATE order_items 
SET allocated_quantity = COALESCE(shipped_quantity, 0)
WHERE allocated_quantity IS NULL OR allocated_quantity = 0;

-- 확인 쿼리
SELECT 
  id,
  product_name,
  color,
  size,
  quantity,
  allocated_quantity,
  shipped_quantity,
  CASE 
    WHEN allocated_quantity = shipped_quantity THEN '일치'
    ELSE '불일치'
  END as status
FROM order_items 
WHERE shipped_quantity > 0
ORDER BY id DESC
LIMIT 20; 