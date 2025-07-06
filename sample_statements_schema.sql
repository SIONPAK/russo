-- 샘플 명세서 테이블 (sample_statements)
CREATE TABLE IF NOT EXISTS sample_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_number VARCHAR(50) UNIQUE NOT NULL, -- 명세서 번호 (SS-YYYYMMDD-XXXX)
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sample_type VARCHAR(20) NOT NULL DEFAULT 'photo', -- photo, sales
    
    -- 명세서 정보
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, shipped, returned, charged
    
    -- 금액 정보
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- 아이템 정보 (JSON)
    items JSONB,
    
    -- 상태별 타임스탬프
    shipped_at TIMESTAMP,
    returned_at TIMESTAMP,
    charged_at TIMESTAMP,
    
    -- 이메일 발송 정보
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    
    -- 메모 및 관리
    admin_notes TEXT,
    
    -- 타임스탬프
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 차감 명세서 테이블 (deduction_statements)
CREATE TABLE IF NOT EXISTS deduction_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_number VARCHAR(50) UNIQUE NOT NULL, -- 명세서 번호 (DS-YYYYMMDD-XXXX)
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    deduction_type VARCHAR(20) NOT NULL DEFAULT 'other', -- return, defect, shortage, damage, other
    
    -- 명세서 정보
    deduction_reason TEXT NOT NULL, -- 차감 사유
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, completed, cancelled
    
    -- 금액 정보
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    mileage_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- 차감 정보
    mileage_deducted BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    
    -- 아이템 정보 (JSON)
    items JSONB,
    
    -- 이메일 발송 정보
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    
    -- 메모 및 관리
    admin_notes TEXT,
    
    -- 타임스탬프
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 반품 명세서 테이블 (return_statements)
CREATE TABLE IF NOT EXISTS return_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    statement_number VARCHAR(50) UNIQUE NOT NULL, -- 명세서 번호 (RS-YYYYMMDD-XXXX)
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    return_type VARCHAR(20) NOT NULL DEFAULT 'defect', -- defect, size_issue, color_issue, customer_change, other
    
    -- 명세서 정보
    return_reason TEXT NOT NULL, -- 반품 사유
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, approved, refunded, rejected
    
    -- 금액 정보
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    refund_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    
    -- 환불 정보
    refund_method VARCHAR(20) DEFAULT 'mileage', -- mileage, card, bank_transfer
    refunded BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    
    -- 아이템 정보 (JSON)
    items JSONB,
    
    -- 이메일 발송 정보
    email_sent BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMP,
    
    -- 메모 및 관리
    admin_notes TEXT,
    
    -- 타임스탬프
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sample_statements_order_id ON sample_statements(order_id);
CREATE INDEX IF NOT EXISTS idx_sample_statements_status ON sample_statements(status);
CREATE INDEX IF NOT EXISTS idx_sample_statements_statement_number ON sample_statements(statement_number);
CREATE INDEX IF NOT EXISTS idx_sample_statements_created_at ON sample_statements(created_at);

CREATE INDEX IF NOT EXISTS idx_deduction_statements_order_id ON deduction_statements(order_id);
CREATE INDEX IF NOT EXISTS idx_deduction_statements_status ON deduction_statements(status);
CREATE INDEX IF NOT EXISTS idx_deduction_statements_statement_number ON deduction_statements(statement_number);
CREATE INDEX IF NOT EXISTS idx_deduction_statements_created_at ON deduction_statements(created_at);

CREATE INDEX IF NOT EXISTS idx_return_statements_order_id ON return_statements(order_id);
CREATE INDEX IF NOT EXISTS idx_return_statements_status ON return_statements(status);
CREATE INDEX IF NOT EXISTS idx_return_statements_statement_number ON return_statements(statement_number);
CREATE INDEX IF NOT EXISTS idx_return_statements_created_at ON return_statements(created_at);

-- 트리거 함수 생성 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_sample_statements_updated_at BEFORE UPDATE ON sample_statements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deduction_statements_updated_at BEFORE UPDATE ON deduction_statements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_return_statements_updated_at BEFORE UPDATE ON return_statements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 명세서 번호 생성 함수
CREATE OR REPLACE FUNCTION generate_statement_number(prefix TEXT)
RETURNS TEXT AS $$
DECLARE
    date_part TEXT;
    sequence_num INTEGER;
    statement_number TEXT;
    table_name TEXT;
BEGIN
    -- 오늘 날짜를 YYYYMMDD 형식으로 변환
    date_part := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
    
    -- 테이블명 결정
    table_name := CASE 
        WHEN prefix = 'SS' THEN 'sample_statements'
        WHEN prefix = 'DS' THEN 'deduction_statements'
        WHEN prefix = 'RS' THEN 'return_statements'
    END;
    
    -- 해당 날짜의 마지막 시퀀스 번호를 조회
    EXECUTE format('SELECT COALESCE(MAX(CAST(SUBSTRING(statement_number FROM %s) AS INTEGER)), 0) + 1 
                   FROM %I 
                   WHERE statement_number LIKE %L',
                   LENGTH(prefix) + 10, -- SS-YYYYMMDD- 이후 부분 (4자리)
                   table_name,
                   prefix || '-' || date_part || '-%'
                  ) INTO sequence_num;
    
    -- 명세서 번호 생성 (SS-YYYYMMDD-0001 형식)
    statement_number := prefix || '-' || date_part || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    RETURN statement_number;
END;
$$ LANGUAGE plpgsql;

-- 샘플 명세서 번호 자동 생성 트리거
CREATE OR REPLACE FUNCTION set_sample_statement_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.statement_number IS NULL OR NEW.statement_number = '' THEN
        NEW.statement_number := generate_statement_number('SS');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_sample_statement_number_trigger
    BEFORE INSERT ON sample_statements
    FOR EACH ROW
    EXECUTE FUNCTION set_sample_statement_number();

-- 차감 명세서 번호 자동 생성 트리거
CREATE OR REPLACE FUNCTION set_deduction_statement_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.statement_number IS NULL OR NEW.statement_number = '' THEN
        NEW.statement_number := generate_statement_number('DS');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_deduction_statement_number_trigger
    BEFORE INSERT ON deduction_statements
    FOR EACH ROW
    EXECUTE FUNCTION set_deduction_statement_number();

-- 반품 명세서 번호 자동 생성 트리거
CREATE OR REPLACE FUNCTION set_return_statement_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.statement_number IS NULL OR NEW.statement_number = '' THEN
        NEW.statement_number := generate_statement_number('RS');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_return_statement_number_trigger
    BEFORE INSERT ON return_statements
    FOR EACH ROW
    EXECUTE FUNCTION set_return_statement_number(); 