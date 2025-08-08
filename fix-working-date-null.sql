-- working_date NULL 허용으로 임시 변경

-- 1. NOT NULL 제약조건 제거
ALTER TABLE orders ALTER COLUMN working_date DROP NOT NULL;

-- 2. 트리거가 제대로 작동하는지 확인
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'orders';

-- 3. 함수가 제대로 생성되었는지 확인
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'calculate_working_date';

-- 4. 테스트용 주문 생성 (트리거 작동 확인)
-- 이 쿼리는 실제로 실행하지 말고 참고용으로만 사용
/*
INSERT INTO orders (
  user_id,
  order_number,
  order_type,
  total_amount,
  shipping_fee,
  status,
  shipping_name,
  shipping_phone,
  shipping_address,
  shipping_postal_code
) VALUES (
  'test-user-id',
  'TEST-ORDER-001',
  'normal',
  10000,
  0,
  'pending',
  '테스트',
  '010-1234-5678',
  '테스트 주소',
  '12345'
);
*/ 