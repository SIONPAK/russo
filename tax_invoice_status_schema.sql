-- 세금계산서 상태 관리 테이블
CREATE TABLE IF NOT EXISTS tax_invoice_status (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  year_month VARCHAR(7) NOT NULL, -- YYYY-MM 형식
  status VARCHAR(1) NOT NULL DEFAULT 'X', -- 'O': 발행완료, 'X': 미발행
  issued_at TIMESTAMPTZ,
  issued_by VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 유니크 제약조건: 회사명과 년월 조합은 유일해야 함
  UNIQUE(company_name, year_month)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_tax_invoice_status_company_name ON tax_invoice_status(company_name);
CREATE INDEX IF NOT EXISTS idx_tax_invoice_status_year_month ON tax_invoice_status(year_month);
CREATE INDEX IF NOT EXISTS idx_tax_invoice_status_status ON tax_invoice_status(status);

-- 코멘트 추가
COMMENT ON TABLE tax_invoice_status IS '세금계산서 발행 상태 관리';
COMMENT ON COLUMN tax_invoice_status.company_name IS '회사명';
COMMENT ON COLUMN tax_invoice_status.year_month IS '년월 (YYYY-MM)';
COMMENT ON COLUMN tax_invoice_status.status IS '발행상태 (O:발행완료, X:미발행)';
COMMENT ON COLUMN tax_invoice_status.issued_at IS '발행일시';
COMMENT ON COLUMN tax_invoice_status.issued_by IS '발행자'; 