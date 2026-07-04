-- ============================================
-- עדכון טבלת earnings_calendar להתאמה מדויקת ל-JSON מה-API
-- ============================================
-- 
-- סקריפט זה מעדכן את הטבלה להתאמה מלאה ל-JSON שמחזיר ה-API החדש
-- המבנה: { ticker, company_name, report_date, report_time, quarter, eps_estimate, revenue_estimate, raw: {...} }
--
-- הרץ את הסקריפט הזה ב-Supabase SQL Editor

-- ============================================
-- 1. הוספת שדה ticker (השדה הראשי מה-API)
-- ============================================

ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS ticker TEXT; -- ticker מה-API (לפני הוספת .US)

-- אינדקס על ticker
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_ticker 
  ON public.earnings_calendar(ticker);

-- ============================================
-- 2. וידוא שכל השדות מה-API קיימים
-- ============================================

-- שדות ישירים מה-API (לא מ-raw)
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS company_name TEXT, -- company_name מה-API
  ADD COLUMN IF NOT EXISTS report_time TEXT, -- report_time מה-API
  ADD COLUMN IF NOT EXISTS quarter TEXT, -- quarter מה-API (Q1 2024, Q2 2024, etc.)
  ADD COLUMN IF NOT EXISTS eps_estimate NUMERIC, -- eps_estimate מה-API
  ADD COLUMN IF NOT EXISTS revenue_estimate NUMERIC; -- revenue_estimate מה-API

-- שדות מ-raw object
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS symbol TEXT, -- symbol מ-raw (ללא .US)
  ADD COLUMN IF NOT EXISTS sk TEXT, -- sk מ-raw (sort key)
  ADD COLUMN IF NOT EXISTS earnings_date TEXT, -- earningsDate מ-raw
  ADD COLUMN IF NOT EXISTS earnings_time TEXT, -- earningsTime מ-raw (HH:MM:SS)
  ADD COLUMN IF NOT EXISTS earnings_date_time TIMESTAMP WITH TIME ZONE, -- earningsDateTime מ-raw
  ADD COLUMN IF NOT EXISTS eps NUMERIC, -- eps מ-raw (התוצאה בפועל)
  ADD COLUMN IF NOT EXISTS eps_estimate_raw NUMERIC, -- epsEstimate מ-raw
  ADD COLUMN IF NOT EXISTS eps_prior NUMERIC, -- epsPrior מ-raw
  ADD COLUMN IF NOT EXISTS eps_surprise NUMERIC, -- epsSurprise מ-raw
  ADD COLUMN IF NOT EXISTS eps_surprise_percent NUMERIC, -- epsSurprisePercent מ-raw
  ADD COLUMN IF NOT EXISTS period TEXT, -- period מ-raw (Q1, Q2, Q3, Q4, FY)
  ADD COLUMN IF NOT EXISTS period_year INTEGER, -- periodYear מ-raw
  ADD COLUMN IF NOT EXISTS revenue NUMERIC, -- revenue מ-raw (התוצאה בפועל)
  ADD COLUMN IF NOT EXISTS revenue_estimate_raw NUMERIC, -- revenueEstimate מ-raw
  ADD COLUMN IF NOT EXISTS revenue_prior NUMERIC, -- revenuePrior מ-raw
  ADD COLUMN IF NOT EXISTS revenue_surprise NUMERIC, -- revenueSurprise מ-raw
  ADD COLUMN IF NOT EXISTS revenue_surprise_percent NUMERIC, -- revenueSurprisePercent מ-raw
  ADD COLUMN IF NOT EXISTS importance INTEGER, -- importance מ-raw (0-5)
  ADD COLUMN IF NOT EXISTS is_date_confirmed BOOLEAN DEFAULT false, -- isDateConfirmed מ-raw
  ADD COLUMN IF NOT EXISTS market_cap NUMERIC, -- marketCap מ-raw
  ADD COLUMN IF NOT EXISTS external_id TEXT, -- externalId מ-raw
  ADD COLUMN IF NOT EXISTS asset_name TEXT; -- assetName מ-raw

-- שדה source מה-API
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS api_source TEXT; -- source מה-API (URL)

-- ============================================
-- 3. עדכון אינדקסים
-- ============================================

-- אינדקסים לביצועים טובים יותר
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_ticker_report_date 
  ON public.earnings_calendar(ticker, report_date);

CREATE INDEX IF NOT EXISTS idx_earnings_calendar_external_id 
  ON public.earnings_calendar(external_id);

CREATE INDEX IF NOT EXISTS idx_earnings_calendar_period_year 
  ON public.earnings_calendar(period, period_year);

CREATE INDEX IF NOT EXISTS idx_earnings_calendar_importance 
  ON public.earnings_calendar(importance);

-- Unique constraint על ticker + report_date
-- זה מאפשר upsert לפי ticker במקום רק code
DO $$
BEGIN
  -- נסה ליצור unique constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'earnings_calendar_ticker_report_date_key'
  ) THEN
    ALTER TABLE public.earnings_calendar
    ADD CONSTRAINT earnings_calendar_ticker_report_date_key 
    UNIQUE (ticker, report_date);
    
    RAISE NOTICE '✅ Created unique constraint on (ticker, report_date)';
  ELSE
    RAISE NOTICE '✅ Unique constraint on (ticker, report_date) already exists';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️ Could not create unique constraint: %', SQLERRM;
    RAISE NOTICE '💡 Will use code,report_date for upsert instead';
END $$;

-- ============================================
-- 4. עדכון שדות קיימים (אם צריך)
-- ============================================

-- ודא ש-code יכול להיות NULL (אם ticker קיים)
-- אבל code עדיין נדרש ל-backward compatibility
-- ALTER TABLE public.earnings_calendar
--   ALTER COLUMN code DROP NOT NULL; -- לא נעשה - code עדיין נדרש

-- ============================================
-- 5. בדיקת המבנה החדש
-- ============================================

DO $$
DECLARE
  column_count INTEGER;
  has_ticker BOOLEAN;
  has_company_name BOOLEAN;
  has_eps_estimate BOOLEAN;
  has_revenue_estimate BOOLEAN;
  has_external_id BOOLEAN;
  has_market_cap BOOLEAN;
BEGIN
  -- בדיקת עמודות
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'earnings_calendar';
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'earnings_calendar' 
      AND column_name = 'ticker'
  ) INTO has_ticker;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'earnings_calendar' 
      AND column_name = 'company_name'
  ) INTO has_company_name;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'earnings_calendar' 
      AND column_name = 'eps_estimate'
  ) INTO has_eps_estimate;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'earnings_calendar' 
      AND column_name = 'revenue_estimate'
  ) INTO has_revenue_estimate;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'earnings_calendar' 
      AND column_name = 'external_id'
  ) INTO has_external_id;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'earnings_calendar' 
      AND column_name = 'market_cap'
  ) INTO has_market_cap;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ עדכון טבלת earnings_calendar הושלם!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📊 סטטיסטיקות:';
  RAISE NOTICE '   ├─ סה"כ עמודות: %', column_count;
  RAISE NOTICE '   ├─ שדה ticker: %', CASE WHEN has_ticker THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   ├─ שדה company_name: %', CASE WHEN has_company_name THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   ├─ שדה eps_estimate: %', CASE WHEN has_eps_estimate THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   ├─ שדה revenue_estimate: %', CASE WHEN has_revenue_estimate THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   ├─ שדה external_id: %', CASE WHEN has_external_id THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   └─ שדה market_cap: %', CASE WHEN has_market_cap THEN '✅' ELSE '❌' END;
  RAISE NOTICE '';
  RAISE NOTICE '💡 מה הלאה:';
  RAISE NOTICE '   1. עדכן את daily-earnings-sync-v2 לשימוש בשדות החדשים';
  RAISE NOTICE '   2. הרץ את run_earnings_sync_v2_simple.sql לבדיקה';
  RAISE NOTICE '';
END $$;

-- הצגת המבנה המלא
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'earnings_calendar'
ORDER BY ordinal_position;





