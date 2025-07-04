    -- 공지사항 테이블
CREATE TABLE notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by VARCHAR(255) DEFAULT '루소'
);

-- 팝업 테이블
CREATE TABLE popups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    image_url TEXT NOT NULL,
    width INTEGER NOT NULL DEFAULT 400,
    height INTEGER NOT NULL DEFAULT 300,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 팝업 숨김 기록 테이블 (사용자별 "오늘 하루 보지 않음" 기능)
CREATE TABLE popup_hidden_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    popup_id UUID REFERENCES popups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    hidden_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(popup_id, user_id)
);

-- RLS 정책 설정
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE popups ENABLE ROW LEVEL SECURITY;
ALTER TABLE popup_hidden_records ENABLE ROW LEVEL SECURITY;

-- 공지사항 RLS 정책
CREATE POLICY "공지사항 읽기 - 모든 사용자" ON notices
    FOR SELECT USING (true);

CREATE POLICY "공지사항 작성 - 관리자만" ON notices
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "공지사항 수정 - 관리자만" ON notices
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "공지사항 삭제 - 관리자만" ON notices
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- 팝업 RLS 정책
CREATE POLICY "팝업 읽기 - 모든 사용자" ON popups
    FOR SELECT USING (true);

CREATE POLICY "팝업 작성 - 관리자만" ON popups
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "팝업 수정 - 관리자만" ON popups
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "팝업 삭제 - 관리자만" ON popups
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- 팝업 숨김 기록 RLS 정책
CREATE POLICY "팝업 숨김 기록 읽기 - 본인만" ON popup_hidden_records
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "팝업 숨김 기록 작성 - 본인만" ON popup_hidden_records
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "팝업 숨김 기록 수정 - 본인만" ON popup_hidden_records
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "팝업 숨김 기록 삭제 - 본인만" ON popup_hidden_records
    FOR DELETE USING (auth.uid() = user_id);

-- 인덱스 생성
CREATE INDEX idx_notices_is_pinned ON notices(is_pinned);
CREATE INDEX idx_notices_created_at ON notices(created_at DESC);
CREATE INDEX idx_popups_active_dates ON popups(is_active, start_date, end_date);
CREATE INDEX idx_popup_hidden_records_user_popup ON popup_hidden_records(user_id, popup_id);

-- 트리거 함수 생성 (updated_at 자동 업데이트)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_notices_updated_at BEFORE UPDATE ON notices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_popups_updated_at BEFORE UPDATE ON popups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Storage 버킷 생성 (팝업 이미지용)
INSERT INTO storage.buckets (id, name, public)
VALUES ('popup-images', 'popup-images', true);

-- Storage 정책 생성
CREATE POLICY "팝업 이미지 업로드 - 관리자만" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'popup-images' AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

CREATE POLICY "팝업 이미지 읽기 - 모든 사용자" ON storage.objects
    FOR SELECT USING (bucket_id = 'popup-images');

CREATE POLICY "팝업 이미지 삭제 - 관리자만" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'popup-images' AND
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    ); 