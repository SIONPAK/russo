-- 🚀 add_physical_stock RPC 함수 생성
-- 물리적 재고 추가/차감 함수

CREATE OR REPLACE FUNCTION add_physical_stock(
  p_product_id UUID,
  p_color VARCHAR DEFAULT NULL,
  p_size VARCHAR DEFAULT NULL,
  p_additional_stock INTEGER DEFAULT 0,
  p_reason TEXT DEFAULT ''
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  current_product RECORD;
  target_option RECORD;
  new_physical_stock INTEGER;
  new_stock_quantity INTEGER;
  new_allocated_stock INTEGER;
BEGIN
  -- 상품 정보 조회
  SELECT * INTO current_product
  FROM products
  WHERE id = p_product_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION '상품을 찾을 수 없습니다: %', p_product_id;
  END IF;
  
  -- 옵션별 재고 관리인 경우
  IF p_color IS NOT NULL AND p_size IS NOT NULL THEN
    -- 해당 옵션 찾기
    SELECT * INTO target_option
    FROM (
      SELECT 
        jsonb_array_elements(inventory_options) as option
      FROM products
      WHERE id = p_product_id
    ) t
    WHERE (option->>'color') = p_color AND (option->>'size') = p_size;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION '해당 옵션을 찾을 수 없습니다: %/%', p_color, p_size;
    END IF;
    
    -- 새로운 물리적 재고 계산
    new_physical_stock := (target_option.option->>'physical_stock')::INTEGER + p_additional_stock;
    new_stock_quantity := new_physical_stock; -- 물리적 재고와 동일하게 설정
    new_allocated_stock := 0; -- allocated_stock 초기화
    
    -- 옵션별 재고 업데이트
    UPDATE products
    SET inventory_options = jsonb_set(
      inventory_options,
      array[
        (SELECT ordinality - 1 FROM jsonb_array_elements(inventory_options) WITH ORDINALITY 
         WHERE (value->>'color') = p_color AND (value->>'size') = p_size)
      ]::text[],
      jsonb_build_object(
        'color', p_color,
        'size', p_size,
        'physical_stock', new_physical_stock,
        'stock_quantity', new_stock_quantity,
        'allocated_stock', new_allocated_stock,
        'additional_price', (target_option.option->>'additional_price')::INTEGER
      )
    )
    WHERE id = p_product_id;
    
  ELSE
    -- 전체 재고 관리인 경우
    new_physical_stock := current_product.stock_quantity + p_additional_stock;
    new_stock_quantity := new_physical_stock;
    
    -- 전체 재고 업데이트
    UPDATE products
    SET 
      stock_quantity = new_stock_quantity,
      physical_stock = new_physical_stock
    WHERE id = p_product_id;
  END IF;
  
  -- 재고 변동 이력 기록
  INSERT INTO stock_movements (
    product_id,
    movement_type,
    quantity,
    color,
    size,
    notes,
    created_at
  ) VALUES (
    p_product_id,
    CASE 
      WHEN p_additional_stock > 0 THEN 'inbound'
      WHEN p_additional_stock < 0 THEN 'outbound'
      ELSE 'adjustment'
    END,
    p_additional_stock,
    p_color,
    p_size,
    p_reason,
    NOW()
  );
  
  RETURN TRUE;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '재고 조정 중 오류 발생: %', SQLERRM;
END;
$$;
