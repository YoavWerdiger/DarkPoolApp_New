-- ============================================
-- עדכון טבלת earnings_calendar למבנה של API החדש
-- ============================================
-- 
-- סקריפט זה מעדכן את הטבלה להתאמה מלאה ל-JSON שמחזיר ה-API החדש
-- (api.parse.bot / earningshub.com)
--
-- הרץ את הסקריפט הזה ב-Supabase SQL Editor

-- ============================================
-- 1. שינוי id ל-UUID (אם צריך)
-- ============================================

-- בדיקה אם id הוא UUID או TEXT
DO $$
BEGIN
  -- אם id הוא TEXT, נשנה אותו ל-UUID ונוסיף default ל-UUID חדש§
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'earnings_calendar' 
      AND column_name = 'id'
      AND data_type = 'text'
  ) THEN
    -- נשנה את הטיפוס ל-UUID עם default
    ALTER TABLE public.earnings_calendar
      ALTER COLUMN id TYPE UUID USING gen_random_uuid();
    
    -- נוסיף default ל-UUID חדש
    ALTER TABLE public.earnings_calendar
      ALTER COLUMN id SET DEFAULT gen_random_uuid();
    
    RAISE NOTICE '✅ שונה id מ-TEXT ל-UUID';
  ELSE
    RAISE NOTICE '✅ id כבר UUID או לא קיים';
  END IF;
END $$;

-- ============================================
-- 2. הוספת/עדכון שדות לפי JSON מה-API
-- ============================================

-- שדות בסיסיים מה-API
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS company_name TEXT, -- company_name מה-API
  ADD COLUMN IF NOT EXISTS report_time TEXT, -- report_time מה-API (Before Market, After Market, etc.)
  ADD COLUMN IF NOT EXISTS quarter TEXT; -- quarter מה-API (Q1 2024, Q2 2024, etc.)

-- שדות Period (תקופת דיווח) מ-raw object
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS period TEXT, -- 'Q1', 'Q2', 'Q3', 'Q4', 'FY' (מ-raw.period)
  ADD COLUMN IF NOT EXISTS period_year INTEGER; -- שנת התקופה (מ-raw.periodYear)

-- שדות תאריך נוספים מ-raw object
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS earnings_date_time TIMESTAMP WITH TIME ZONE, -- earningsDateTime מ-raw
  ADD COLUMN IF NOT EXISTS time TEXT, -- earningsTime מ-raw (HH:MM:SS)
  ADD COLUMN IF NOT EXISTS is_date_confirmed BOOLEAN DEFAULT false; -- isDateConfirmed מ-raw

-- שדות EPS מ-raw object (מלבד actual, estimate שכבר קיימים)
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS eps_prior NUMERIC, -- epsPrior מ-raw
  ADD COLUMN IF NOT EXISTS eps_surprise NUMERIC, -- epsSurprise מ-raw
  ADD COLUMN IF NOT EXISTS eps_surprise_percent NUMERIC; -- epsSurprisePercent מ-raw (כבר באחוזים)

-- שדות Revenue מ-raw object
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS revenue_actual NUMERIC, -- revenue מ-raw
  ADD COLUMN IF NOT EXISTS revenue_estimate_avg NUMERIC, -- revenueEstimate מ-raw
  ADD COLUMN IF NOT EXISTS revenue_prior NUMERIC, -- revenuePrior מ-raw
  ADD COLUMN IF NOT EXISTS revenue_surprise NUMERIC, -- revenueSurprise מ-raw
  ADD COLUMN IF NOT EXISTS revenue_surprise_percent NUMERIC; -- revenueSurprisePercent מ-raw

-- שדות מטא-דאטה מ-raw object
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS importance INTEGER, -- importance מ-raw (0-5)
  ADD COLUMN IF NOT EXISTS market_cap NUMERIC, -- marketCap מ-raw
  ADD COLUMN IF NOT EXISTS external_id TEXT, -- externalId מ-raw
  ADD COLUMN IF NOT EXISTS asset_name TEXT; -- assetName מ-raw (שם החברה המלא)

-- שדה source - עדכון לערך ברירת מחדל
ALTER TABLE public.earnings_calendar
  ALTER COLUMN source SET DEFAULT 'earningshub.com';

-- ============================================
-- 3. עדכון שדות קיימים (אם צריך)
-- ============================================

-- ודא ש-before_after_market יכול להיות NULL
ALTER TABLE public.earnings_calendar
  ALTER COLUMN before_after_market DROP NOT NULL;

-- ודא ש-date יכול להיות NULL (אם report_date קיים)
ALTER TABLE public.earnings_calendar
  ALTER COLUMN date DROP NOT NULL;

-- ============================================
-- 4. יצירת/עדכון אינדקסים
-- ============================================

-- אינדקסים לביצועים טובים יותר
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_period_year 
  ON public.earnings_calendar(period, period_year);

CREATE INDEX IF NOT EXISTS idx_earnings_calendar_importance 
  ON public.earnings_calendar(importance);

CREATE INDEX IF NOT EXISTS idx_earnings_calendar_company_name 
  ON public.earnings_calendar(company_name);

CREATE INDEX IF NOT EXISTS idx_earnings_calendar_external_id 
  ON public.earnings_calendar(external_id);

CREATE INDEX IF NOT EXISTS idx_earnings_calendar_report_time 
  ON public.earnings_calendar(report_time);

-- אינדקס מורכב ל-upsert יעיל
CREATE UNIQUE INDEX IF NOT EXISTS idx_earnings_calendar_code_report_date 
  ON public.earnings_calendar(code, report_date);

-- ============================================
-- 5. עדכון Primary Key (אם id הוא UUID)
-- ============================================

-- אם id הוא UUID, נוודא שיש לו default
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'earnings_calendar' 
      AND column_name = 'id'
      AND data_type = 'uuid'
  ) THEN
    -- ודא שיש default
    ALTER TABLE public.earnings_calendar
      ALTER COLUMN id SET DEFAULT gen_random_uuid();
    
    RAISE NOTICE '✅ id הוא UUID עם default';
  END IF;
END $$;

-- ============================================
-- 6. בדיקת המבנה החדש
-- ============================================

DO $$
DECLARE
  column_count INTEGER;
  has_company_name BOOLEAN;
  has_period BOOLEAN;
  has_importance BOOLEAN;
  has_market_cap BOOLEAN;
  has_external_id BOOLEAN;
BEGIN
  -- בדיקת עמודות
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'earnings_calendar';
  
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
      AND column_name = 'period'
  ) INTO has_period;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'earnings_calendar' 
      AND column_name = 'importance'
  ) INTO has_importance;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'earnings_calendar' 
      AND column_name = 'market_cap'
  ) INTO has_market_cap;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'earnings_calendar' 
      AND column_name = 'external_id'
  ) INTO has_external_id;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ עדכון טבלת earnings_calendar הושלם!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📊 סטטיסטיקות:';
  RAISE NOTICE '   ├─ סה"כ עמודות: %', column_count;
  RAISE NOTICE '   ├─ שדה company_name: %', CASE WHEN has_company_name THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   ├─ שדה period: %', CASE WHEN has_period THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   ├─ שדה importance: %', CASE WHEN has_importance THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   ├─ שדה market_cap: %', CASE WHEN has_market_cap THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   └─ שדה external_id: %', CASE WHEN has_external_id THEN '✅' ELSE '❌' END;
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




