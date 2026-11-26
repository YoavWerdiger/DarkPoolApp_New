-- ====================================
-- טבלאות ליומן פיננסי מורחב
-- ====================================
-- 
-- הרץ את הסקריפט הזה ב-Supabase SQL Editor
--
-- כולל:
-- 1. earnings_trends - תחזיות רווחים
-- 2. ipos_calendar - הנפקות
-- 3. splits_calendar - פיצולי מניות
-- 4. dividends_calendar - דיבידנדים
--

-- ====================================
-- 0. Earnings Calendar Table
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

-- ====================================
-- 1. Earnings Trends Table
-- ====================================

CREATE TABLE IF NOT EXISTS public.earnings_trends (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,                           -- Symbol (e.g., AAPL.US)
  name TEXT,                                     -- Company name
  date DATE NOT NULL,                            -- Period end date
  period TEXT NOT NULL,                          -- 0q, +1q, 0y, +1y
  
  -- EPS Data
  earnings_estimate_avg NUMERIC,
  earnings_estimate_low NUMERIC,
  earnings_estimate_high NUMERIC,
  earnings_estimate_year_ago NUMERIC,
  earnings_estimate_analysts_count INTEGER,
  earnings_estimate_growth NUMERIC,
  
  -- Revenue Data
  revenue_estimate_avg NUMERIC,
  revenue_estimate_low NUMERIC,
  revenue_estimate_high NUMERIC,
  revenue_estimate_year_ago NUMERIC,
  revenue_estimate_analysts_count INTEGER,
  revenue_estimate_growth NUMERIC,
  
  -- Trends
  eps_trend_current NUMERIC,
  eps_trend_7days_ago NUMERIC,
  eps_trend_30days_ago NUMERIC,
  eps_trend_60days_ago NUMERIC,
  eps_trend_90days_ago NUMERIC,
  
  -- Revisions
  eps_revisions_up_last_7days INTEGER,
  eps_revisions_up_last_30days INTEGER,
  eps_revisions_down_last_30days INTEGER,
  
  -- Overall growth
  growth NUMERIC,
  
  -- Metadata
  source TEXT DEFAULT 'EODHD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for earnings_trends
CREATE INDEX IF NOT EXISTS idx_earnings_trends_code ON public.earnings_trends(code);
CREATE INDEX IF NOT EXISTS idx_earnings_trends_date ON public.earnings_trends(date);
CREATE INDEX IF NOT EXISTS idx_earnings_trends_period ON public.earnings_trends(period);

-- RLS Policies
ALTER TABLE public.earnings_trends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.earnings_trends;
CREATE POLICY "Enable read access for authenticated users"
  ON public.earnings_trends
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Enable insert for service role" ON public.earnings_trends;
CREATE POLICY "Enable insert for service role"
  ON public.earnings_trends
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for service role" ON public.earnings_trends;
CREATE POLICY "Enable update for service role"
  ON public.earnings_trends
  FOR UPDATE
  TO service_role
  USING (true);


-- ====================================
-- 2. IPOs Calendar Table
-- ====================================

CREATE TABLE IF NOT EXISTS public.ipos_calendar (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,                           -- Symbol (e.g., RDDT.US)
  name TEXT,                                     -- Company name
  exchange TEXT,                                 -- Exchange (e.g., NASDAQ)
  currency TEXT,                                 -- Currency (e.g., USD)
  
  -- Dates
  start_date DATE,                               -- Expected/actual first trading date
  filing_date DATE,                              -- Initial filing date
  amended_date DATE,                             -- Latest amendment date
  
  -- Pricing
  price_from NUMERIC,                            -- Lower price range
  price_to NUMERIC,                              -- Upper price range
  offer_price NUMERIC,                           -- Final offer price
  shares BIGINT,                                 -- Number of shares offered
  
  -- Status
  deal_type TEXT,                                -- Filed, Expected, Amended, Priced
  
  -- Metadata
  source TEXT DEFAULT 'EODHD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for ipos_calendar
CREATE INDEX IF NOT EXISTS idx_ipos_calendar_code ON public.ipos_calendar(code);
CREATE INDEX IF NOT EXISTS idx_ipos_calendar_start_date ON public.ipos_calendar(start_date);
CREATE INDEX IF NOT EXISTS idx_ipos_calendar_deal_type ON public.ipos_calendar(deal_type);

-- RLS Policies
ALTER TABLE public.ipos_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.ipos_calendar;
CREATE POLICY "Enable read access for authenticated users"
  ON public.ipos_calendar
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Enable insert for service role" ON public.ipos_calendar;
CREATE POLICY "Enable insert for service role"
  ON public.ipos_calendar
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for service role" ON public.ipos_calendar;
CREATE POLICY "Enable update for service role"
  ON public.ipos_calendar
  FOR UPDATE
  TO service_role
  USING (true);


-- ====================================
-- 3. Splits Calendar Table
-- ====================================

CREATE TABLE IF NOT EXISTS public.splits_calendar (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,                           -- Symbol (e.g., TSLA.US)
  name TEXT,                                     -- Company name
  exchange TEXT,                                 -- Exchange
  
  -- Split details
  date DATE NOT NULL,                            -- Effective split date
  ratio TEXT NOT NULL,                           -- e.g., "4:1" or "1:10"
  numerator INTEGER NOT NULL,                    -- e.g., 4 (shares after)
  denominator INTEGER NOT NULL,                  -- e.g., 1 (shares before)
  is_reverse BOOLEAN NOT NULL,                   -- true = reverse split
  
  -- Metadata
  source TEXT DEFAULT 'EODHD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for splits_calendar
CREATE INDEX IF NOT EXISTS idx_splits_calendar_code ON public.splits_calendar(code);
CREATE INDEX IF NOT EXISTS idx_splits_calendar_date ON public.splits_calendar(date);
CREATE INDEX IF NOT EXISTS idx_splits_calendar_is_reverse ON public.splits_calendar(is_reverse);

-- RLS Policies
ALTER TABLE public.splits_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.splits_calendar;
CREATE POLICY "Enable read access for authenticated users"
  ON public.splits_calendar
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Enable insert for service role" ON public.splits_calendar;
CREATE POLICY "Enable insert for service role"
  ON public.splits_calendar
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for service role" ON public.splits_calendar;
CREATE POLICY "Enable update for service role"
  ON public.splits_calendar
  FOR UPDATE
  TO service_role
  USING (true);


-- ====================================
-- 4. Dividends Calendar Table
-- ====================================

CREATE TABLE IF NOT EXISTS public.dividends_calendar (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,                          -- Symbol (e.g., AAPL.US)
  date DATE NOT NULL,                            -- Dividend date
  
  -- Metadata
  source TEXT DEFAULT 'EODHD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for dividends_calendar
CREATE INDEX IF NOT EXISTS idx_dividends_calendar_symbol ON public.dividends_calendar(symbol);
CREATE INDEX IF NOT EXISTS idx_dividends_calendar_date ON public.dividends_calendar(date);

-- RLS Policies
ALTER TABLE public.dividends_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.dividends_calendar;
CREATE POLICY "Enable read access for authenticated users"
  ON public.dividends_calendar
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Enable insert for service role" ON public.dividends_calendar;
CREATE POLICY "Enable insert for service role"
  ON public.dividends_calendar
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for service role" ON public.dividends_calendar;
CREATE POLICY "Enable update for service role"
  ON public.dividends_calendar
  FOR UPDATE
  TO service_role
  USING (true);


-- ====================================
-- Enable Realtime
-- ====================================

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.earnings_calendar;
ALTER PUBLICATION supabase_realtime ADD TABLE public.earnings_trends;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ipos_calendar;
ALTER PUBLICATION supabase_realtime ADD TABLE public.splits_calendar;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dividends_calendar;

-- ====================================
-- Success Message
-- ====================================

DO $$
BEGIN
  RAISE NOTICE '✅ All tables created successfully!';
  RAISE NOTICE '📊 earnings_trends - Ready';
  RAISE NOTICE '🚀 ipos_calendar - Ready';
  RAISE NOTICE '✂️ splits_calendar - Ready';
  RAISE NOTICE '💰 dividends_calendar - Ready';
END $$;


