-- 기존 함수들 삭제
DROP FUNCTION IF EXISTS calculate_available_stock(uuid,character varying,character varying);
DROP FUNCTION IF EXISTS allocate_stock(uuid,character varying,character varying,integer);
DROP FUNCTION IF EXISTS deallocate_stock(uuid,character varying,character varying,integer);

-- 가용 재고 계산 함수
CREATE OR REPLACE FUNCTION calculate_available_stock(
    p_product_id UUID,
    p_color VARCHAR,
    p_size VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    physical_stock INTEGER := 0;
    allocated_stock INTEGER := 0;
    available_stock INTEGER := 0;
    option_record JSONB;
    product_record RECORD;
BEGIN
    -- 상품 정보 조회
    SELECT id, inventory_options INTO product_record
    FROM products WHERE id = p_product_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    -- 옵션별 재고 확인
    FOR option_record IN 
        SELECT * FROM jsonb_array_elements(product_record.inventory_options)
    LOOP
        IF option_record->>'color' = p_color AND option_record->>'size' = p_size THEN
            physical_stock := COALESCE((option_record->>'physical_stock')::integer, 0);
            allocated_stock := COALESCE((option_record->>'allocated_stock')::integer, 0);
            available_stock := GREATEST(physical_stock - allocated_stock, 0);
            RETURN available_stock;
        END IF;
    END LOOP;
    
    -- 매칭되는 옵션이 없으면 0 반환
    RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- 재고 할당 함수
CREATE OR REPLACE FUNCTION allocate_stock(
    p_product_id UUID,
    p_quantity INTEGER,
    p_color VARCHAR,
    p_size VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    product_record RECORD;
    updated_options JSONB;
    option_record JSONB;
    current_physical INTEGER;
    current_allocated INTEGER;
    available_stock INTEGER;
    new_allocated INTEGER;
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
            available_stock := GREATEST(current_physical - current_allocated, 0);
            
            -- 할당 가능한 수량 확인
            IF available_stock >= p_quantity THEN
                new_allocated := current_allocated + p_quantity;
                
                -- 할당된 재고 업데이트
                updated_options := updated_options || jsonb_build_array(
                    jsonb_build_object(
                        'size', option_record->>'size',
                        'color', option_record->>'color',
                        'physical_stock', current_physical,
                        'allocated_stock', new_allocated,
                        'stock_quantity', GREATEST(current_physical - new_allocated, 0),
                        'additional_price', COALESCE((option_record->>'additional_price')::integer, 0)
                    )
                );
                
                p_quantity := 0; -- 할당 완료
            ELSE
                -- 할당 불가능한 경우 그대로 유지
                updated_options := updated_options || jsonb_build_array(option_record);
            END IF;
        ELSE
            -- 다른 옵션은 그대로 유지
            updated_options := updated_options || jsonb_build_array(option_record);
        END IF;
    END LOOP;
    
    -- 할당이 완료되지 않은 경우 실패
    IF p_quantity > 0 THEN
        RETURN FALSE;
    END IF;
    
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

-- 재고 할당 해제 함수
CREATE OR REPLACE FUNCTION deallocate_stock(
    p_product_id UUID,
    p_quantity INTEGER,
    p_color VARCHAR,
    p_size VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    product_record RECORD;
    updated_options JSONB;
    option_record JSONB;
    current_physical INTEGER;
    current_allocated INTEGER;
    new_allocated INTEGER;
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
            
            -- 할당 해제
            new_allocated := GREATEST(current_allocated - p_quantity, 0);
            
            -- 할당 해제된 재고 업데이트
            updated_options := updated_options || jsonb_build_array(
                jsonb_build_object(
                    'size', option_record->>'size',
                    'color', option_record->>'color',
                    'physical_stock', current_physical,
                    'allocated_stock', new_allocated,
                    'stock_quantity', GREATEST(current_physical - new_allocated, 0),
                    'additional_price', COALESCE((option_record->>'additional_price')::integer, 0)
                )
            );
            
            p_quantity := GREATEST(p_quantity - current_allocated, 0);
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