-- 물리적 재고 조정 함수 수정 (notes 컬럼 사용)
CREATE OR REPLACE FUNCTION adjust_physical_stock(
    p_product_id UUID,
    p_color VARCHAR,
    p_size VARCHAR,
    p_quantity_change INTEGER,
    p_reason VARCHAR DEFAULT 'manual_adjustment'
) RETURNS BOOLEAN AS $$
DECLARE
    product_record RECORD;
    updated_options JSONB;
    option_record JSONB;
    current_physical INTEGER;
    current_allocated INTEGER;
    new_physical INTEGER;
BEGIN
    -- 상품 정보 조회
    SELECT id, inventory_options INTO product_record
    FROM products WHERE id = p_product_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    updated_options := '[]'::jsonb;
    
    -- 각 옵션 처리
    FOR option_record IN 
        SELECT * FROM jsonb_array_elements(product_record.inventory_options)
    LOOP
        IF option_record->>'color' = p_color AND option_record->>'size' = p_size THEN
            current_physical := COALESCE((option_record->>'physical_stock')::integer, 0);
            current_allocated := COALESCE((option_record->>'allocated_stock')::integer, 0);
            new_physical := GREATEST(current_physical + p_quantity_change, 0);
            
            -- 물리적 재고 조정
            updated_options := updated_options || jsonb_build_array(
                jsonb_build_object(
                    'size', option_record->>'size',
                    'color', option_record->>'color',
                    'physical_stock', new_physical,
                    'allocated_stock', current_allocated,
                    'stock_quantity', GREATEST(new_physical - current_allocated, 0),
                    'additional_price', COALESCE((option_record->>'additional_price')::integer, 0)
                )
            );
            
            -- 재고 변동 이력 기록 (notes 컬럼 사용)
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
                CASE WHEN p_quantity_change > 0 THEN 'inbound' ELSE 'outbound' END,
                p_quantity_change,
                p_color,
                p_size,
                p_reason,
                NOW()
            );
        ELSE
            -- 다른 옵션은 그대로 유지
            updated_options := updated_options || jsonb_build_array(option_record);
        END IF;
    END LOOP;
    
    -- 업데이트
    UPDATE products 
    SET inventory_options = updated_options,
        stock_quantity = (
            SELECT SUM((option->>'stock_quantity')::integer)
            FROM jsonb_array_elements(updated_options) AS option
        )
    WHERE id = p_product_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql; 