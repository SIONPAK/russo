-- 미출고 관리 시스템을 위한 데이터베이스 테이블 생성 스크립트

-- 1. 미출고 명세서 테이블
CREATE TABLE IF NOT EXISTS unshipped_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_number VARCHAR(255) NOT NULL UNIQUE,
    order_id UUID NOT NULL,
    user_id UUID NOT NULL,
    total_unshipped_amount INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 외래키 제약조건
    CONSTRAINT fk_unshipped_statements_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_unshipped_statements_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
);

-- 2. 미출고 아이템 테이블
CREATE TABLE IF NOT EXISTS unshipped_statement_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unshipped_statement_id UUID NOT NULL,
    order_item_id UUID NOT NULL,
    product_id UUID NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    color VARCHAR(50),
    size VARCHAR(50),
    ordered_quantity INTEGER NOT NULL DEFAULT 0,
    shipped_quantity INTEGER NOT NULL DEFAULT 0,
    unshipped_quantity INTEGER NOT NULL DEFAULT 0,
    unit_price INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 외래키 제약조건
    CONSTRAINT fk_unshipped_statement_items_statement
        FOREIGN KEY (unshipped_statement_id) REFERENCES unshipped_statements(id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_unshipped_statement_items_order_item
        FOREIGN KEY (order_item_id) REFERENCES order_items(id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_unshipped_statement_items_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
);

-- 3. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_unshipped_statements_order_id 
    ON unshipped_statements(order_id);

CREATE INDEX IF NOT EXISTS idx_unshipped_statements_user_id 
    ON unshipped_statements(user_id);

CREATE INDEX IF NOT EXISTS idx_unshipped_statements_status 
    ON unshipped_statements(status);

CREATE INDEX IF NOT EXISTS idx_unshipped_statements_created_at 
    ON unshipped_statements(created_at);

CREATE INDEX IF NOT EXISTS idx_unshipped_statement_items_statement_id 
    ON unshipped_statement_items(unshipped_statement_id);

CREATE INDEX IF NOT EXISTS idx_unshipped_statement_items_order_item_id 
    ON unshipped_statement_items(order_item_id);

-- 4. 상태 값 체크 제약조건
ALTER TABLE unshipped_statements 
ADD CONSTRAINT chk_unshipped_statements_status 
CHECK (status IN ('pending', 'notified', 'resolved', 'cancelled'));

-- 5. 수량 유효성 체크 제약조건
ALTER TABLE unshipped_statement_items 
ADD CONSTRAINT chk_unshipped_statement_items_quantities 
CHECK (
    ordered_quantity >= 0 AND 
    shipped_quantity >= 0 AND 
    unshipped_quantity >= 0 AND
    unshipped_quantity = ordered_quantity - shipped_quantity
);

-- 6. 금액 유효성 체크 제약조건
ALTER TABLE unshipped_statement_items 
ADD CONSTRAINT chk_unshipped_statement_items_amounts 
CHECK (
    unit_price >= 0 AND 
    total_amount >= 0 AND
    total_amount = unit_price * unshipped_quantity
);

-- 7. orders 테이블에 미출고 처리 필드 추가 (이미 존재하지 않는 경우)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'orders' 
                   AND column_name = 'unshipped_processed_at') THEN
        ALTER TABLE orders ADD COLUMN unshipped_processed_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- 8. updated_at 자동 업데이트 트리거 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_unshipped_statements_updated_at
    BEFORE UPDATE ON unshipped_statements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. 미출고 명세서 상태 변경 시 주문 상태 자동 업데이트 트리거 (선택사항)
CREATE OR REPLACE FUNCTION update_order_status_on_unshipped_resolved()
RETURNS TRIGGER AS $$
BEGIN
    -- 미출고 명세서가 해결 완료되면 주문 상태를 다시 원래 상태로 복원
    IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
        UPDATE orders 
        SET status = 'confirmed'
        WHERE id = NEW.order_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_order_status_on_unshipped_resolved
    AFTER UPDATE ON unshipped_statements
    FOR EACH ROW
    EXECUTE FUNCTION update_order_status_on_unshipped_resolved();

-- 10. 주석 추가
COMMENT ON TABLE unshipped_statements IS '미출고 명세서 테이블';
COMMENT ON COLUMN unshipped_statements.statement_number IS '미출고 명세서 번호 (예: UNSHIPPED-ORDER001-1234567890)';
COMMENT ON COLUMN unshipped_statements.status IS '상태: pending(대기중), notified(통보완료), resolved(해결완료), cancelled(취소됨)';
COMMENT ON COLUMN unshipped_statements.reason IS '미출고 사유';

COMMENT ON TABLE unshipped_statement_items IS '미출고 아이템 상세 테이블';
COMMENT ON COLUMN unshipped_statement_items.unshipped_quantity IS '미출고 수량 (주문수량 - 출고수량)';
COMMENT ON COLUMN unshipped_statement_items.total_amount IS '미출고 금액 (단가 * 미출고수량)'; 