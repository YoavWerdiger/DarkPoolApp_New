-- ====================================
-- הוספת עמודות הכנסות לטבלת earnings_calendar
-- מריץ ב-Supabase SQL Editor לפני הפעלת ה-Edge Function המעדכנת
-- ====================================

-- עמודות תחזית הכנסות (Trends)
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS revenue_estimate_avg NUMERIC,
  ADD COLUMN IF NOT EXISTS revenue_estimate_low NUMERIC,
  ADD COLUMN IF NOT EXISTS revenue_estimate_high NUMERIC,
  ADD COLUMN IF NOT EXISTS revenue_estimate_year_ago NUMERIC,
  ADD COLUMN IF NOT EXISTS revenue_estimate_analysts_count INTEGER,
  ADD COLUMN IF NOT EXISTS revenue_estimate_growth NUMERIC;

-- עמודות תוצאה בפועל + צמיחה
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS revenue_actual NUMERIC,
  ADD COLUMN IF NOT EXISTS revenue_yoy NUMERIC; -- אחוזי צמיחה YoY (0.053 = 5.3%)

-- עדכון updated_at אוטומטי
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_earnings_calendar_set_updated_at ON public.earnings_calendar;
CREATE TRIGGER trg_earnings_calendar_set_updated_at
BEFORE UPDATE ON public.earnings_calendar
FOR EACH ROW
EXECUTE PROCEDURE public.set_updated_at_timestamp();

-- אינדקסים בסיסיים (לביצועים טובים יותר בחיבורים לפי code+report_date)
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_code_report_date
  ON public.earnings_calendar(code, report_date);


