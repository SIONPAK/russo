-- 기존 반품명세서들의 company_name 업데이트
UPDATE return_statements 
SET company_name = COALESCE(
  orders.shipping_name,
  orders.shipping_address,
  users.company_name,
  '업체명 미확인'
)
FROM orders
LEFT JOIN users ON orders.user_id = users.id
WHERE return_statements.order_id = orders.id
AND (return_statements.company_name IS NULL OR return_statements.company_name = ''); 