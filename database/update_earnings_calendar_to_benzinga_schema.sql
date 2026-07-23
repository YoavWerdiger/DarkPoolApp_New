-- ============================================
-- עדכון טבלת earnings_calendar למבנה מלא של Benzinga API
-- ============================================
-- 
-- סקריפט זה מעדכן את הטבלה להתאמה מלאה לשדות שמחזיר Benzinga Earnings API
-- כולל כל השדות: EPS, Revenue, Period, Importance, וכו'
--
-- הרץ את הסקריפט הזה ב-Supabase SQL Editor

-- ============================================
-- 1. הוספת שדות חסרים של Benzinga
-- ============================================

-- שדות Period (תקופת דיווח)
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS period TEXT, -- 'Q1', 'Q2', 'Q3', 'Q4', 'FY' (Fiscal Year)
  ADD COLUMN IF NOT EXISTS period_year INTEGER; -- שנת התקופה (2024, 2025, וכו')

-- שדות תאריך נוספים
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS date_confirmed DATE, -- תאריך אישור הדיווח
  ADD COLUMN IF NOT EXISTS time TEXT; -- שעת הדיווח (HH:MM:SS)

-- שדות EPS נוספים (מלבד actual, estimate, difference, percent שכבר קיימים)
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS eps_prior NUMERIC, -- EPS מהתקופה הקודמת
  ADD COLUMN IF NOT EXISTS eps_surprise NUMERIC, -- הבדל בפועל (actual - estimate)
  ADD COLUMN IF NOT EXISTS eps_surprise_percent NUMERIC; -- אחוז הפתעה (surprise %)

-- שדות Revenue נוספים (מלבד revenue_actual, revenue_estimate_avg שכבר קיימים)
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS revenue_surprise NUMERIC, -- הבדל בפועל (revenue_actual - revenue_estimate_avg)
  ADD COLUMN IF NOT EXISTS revenue_surprise_percent NUMERIC; -- אחוז הפתעה (surprise %)

-- שדות מטא-דאטה נוספים
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS importance INTEGER, -- רמת חשיבות (0-5)
  ADD COLUMN IF NOT EXISTS notes TEXT, -- הערות נוספות
  ADD COLUMN IF NOT EXISTS exchange TEXT, -- בורסה (NASDAQ, NYSE, וכו')
  ADD COLUMN IF NOT EXISTS company_name TEXT; -- שם החברה המלא

-- שדה updated timestamp מ-Benzinga (Unix timestamp)
ALTER TABLE public.earnings_calendar
  ADD COLUMN IF NOT EXISTS benzinga_updated BIGINT; -- Unix timestamp של עדכון אחרון מ-Benzinga

-- ============================================
-- 2. עדכון אינדקסים
-- ============================================

-- אינדקסים לביצועים טובים יותר
CREATE INDEX IF NOT EXISTS idx_earnings_calendar_period_year 
  ON public.earnings_calendar(period, period_year);

CREATE INDEX IF NOT EXISTS idx_earnings_calendar_importance 
  ON public.earnings_calendar(importance);

CREATE INDEX IF NOT EXISTS idx_earnings_calendar_exchange 
  ON public.earnings_calendar(exchange);

CREATE INDEX IF NOT EXISTS idx_earnings_calendar_benzinga_updated 
  ON public.earnings_calendar(benzinga_updated);

-- ============================================
-- 3. עדכון Primary Key (אם צריך)
-- ============================================
-- הערה: id כבר קיים כ-PRIMARY KEY, אז לא צריך לשנות

-- ============================================
-- 4. בדיקת המבנה החדש
-- ============================================

DO $$
DECLARE
  column_count INTEGER;
  has_period BOOLEAN;
  has_eps_prior BOOLEAN;
  has_revenue_surprise BOOLEAN;
  has_importance BOOLEAN;
BEGIN
  -- בדיקת עמודות
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'earnings_calendar';
  
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
      AND column_name = 'eps_prior'
  ) INTO has_eps_prior;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'earnings_calendar' 
      AND column_name = 'revenue_surprise'
  ) INTO has_revenue_surprise;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'earnings_calendar' 
      AND column_name = 'importance'
  ) INTO has_importance;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ עדכון טבלת earnings_calendar הושלם!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📊 סטטיסטיקות:';
  RAISE NOTICE '   ├─ סה"כ עמודות: %', column_count;
  RAISE NOTICE '   ├─ שדה period: %', CASE WHEN has_period THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   ├─ שדה eps_prior: %', CASE WHEN has_eps_prior THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   ├─ שדה revenue_surprise: %', CASE WHEN has_revenue_surprise THEN '✅' ELSE '❌' END;
  RAISE NOTICE '   └─ שדה importance: %', CASE WHEN has_importance THEN '✅' ELSE '❌' END;
  RAISE NOTICE '';
  RAISE NOTICE '💡 מה הלאה:';
  RAISE NOTICE '   1. עדכן את daily-earnings-sync-simple לשימוש בשדות החדשים';
  RAISE NOTICE '   2. עדכן את earnings-utils.ts להתאמה למבנה החדש';
  RAISE NOTICE '   3. הרץ את run_earnings_refresh_now.sql לבדיקה';
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








