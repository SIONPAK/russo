-- working_date 자동 계산 트리거 생성

-- 1. 함수 생성
CREATE OR REPLACE FUNCTION calculate_working_date()
RETURNS TRIGGER AS $$
BEGIN
  -- created_at을 한국시간으로 변환하여 15:00 기준으로 working_date 계산
  NEW.working_date = CASE 
    WHEN EXTRACT(HOUR FROM NEW.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') >= 15 
    THEN (NEW.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::date + INTERVAL '1 day'
    ELSE (NEW.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::date
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. 트리거 생성
DROP TRIGGER IF EXISTS trigger_calculate_working_date ON orders;
CREATE TRIGGER trigger_calculate_working_date
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION calculate_working_date();

-- 3. 기존 데이터 수정 (트리거가 없는 경우를 위해)
UPDATE orders 
SET working_date = CASE 
  WHEN EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') >= 15 
  THEN (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::date + INTERVAL '1 day'
  ELSE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::date
END
WHERE working_date IS NULL OR working_date != CASE 
  WHEN EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') >= 15 
  THEN (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::date + INTERVAL '1 day'
  ELSE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::date
END; 