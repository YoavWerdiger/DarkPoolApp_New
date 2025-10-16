-- ====================================
-- טבלת דיווחי תוצאות בלבד
-- ====================================
-- 
-- הרץ את הסקריפט הזה ב-Supabase SQL Editor
-- רק טבלת earnings_calendar

-- ====================================
-- Earnings Calendar Table
-- ====================================

CREATE TABLE IF NOT EXISTS public.earnings_calendar (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,                           -- Symbol (e.g., AAPL.US)
  report_date DATE NOT NULL,                     -- Date when reported
  date DATE NOT NULL,                            -- Fiscal period end date
  before_after_market TEXT,                      -- BeforeMarket, AfterMarket, or null
  currency TEXT,                                 -- Reporting currency (USD, EUR, etc.)
  actual NUMERIC,                                -- Actual EPS
  estimate NUMERIC,                              -- Consensus estimate
  difference NUMERIC,                            -- actual - estimate
  percent NUMERIC,                               -- Surprise percentage
  
  -- Metadata
  source TEXT DEFAULT 'EODHD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for earnings_calendar
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_code ON public.earnings_calendar(code);
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_report_date ON public.earnings_calendar(report_date);
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_date ON public.earnings_calendar(date);

-- RLS Policies
ALTER TABLE public.earnings_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.earnings_calendar;
CREATE POLICY "Enable read access for authenticated users"
  ON public.earnings_calendar
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Enable insert for service role" ON public.earnings_calendar;
CREATE POLICY "Enable insert for service role"
  ON public.earnings_calendar
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for service role" ON public.earnings_calendar;
CREATE POLICY "Enable update for service role"
  ON public.earnings_calendar
  FOR UPDATE
  TO service_role
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.earnings_calendar;

-- ====================================
-- Success Message
-- ====================================

DO $$
BEGIN
  RAISE NOTICE '✅ Earnings calendar table created successfully!';
  RAISE NOTICE '📊 earnings_calendar - Ready for earnings reports';
END $$;
