-- ============================================
-- יצירת Trigger להתראות דיווחי Earnings
-- ============================================
-- 
-- Trigger זה יקרא ל-Edge Function כשמתעדכנת רשומה ב-earnings_calendar
-- ויש לה תוצאה (actual)
--
-- הרץ את הסקריפט הזה ב-Supabase SQL Editor

-- ============================================
-- 1. בדיקת/יצירת Extension
-- ============================================

-- יצירת pg_net extension (אם עדיין לא קיים) - נדרש ל-net.http_post
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- 2. הסרת trigger קיים (אם יש)
-- ============================================

DROP TRIGGER IF EXISTS earnings_notification_trigger ON earnings_calendar;
DROP FUNCTION IF EXISTS trigger_earnings_results_notification() CASCADE;

-- ============================================
-- 3. יצירת פונקציית Trigger
-- ============================================

CREATE OR REPLACE FUNCTION trigger_earnings_results_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- בדיקה אם יש תוצאה חדשה (actual) והרשומה חשובה
  IF NEW.actual IS NOT NULL 
     AND NEW.actual != 0
     AND (OLD.actual IS NULL OR OLD.actual = 0 OR OLD.actual != NEW.actual)
     AND NEW.importance >= 3
     AND NEW.code LIKE '%.US'
     AND NEW.report_date = CURRENT_DATE
  THEN
    -- קריאה ל-Edge Function עם הנתונים של הרשומה
    PERFORM net.http_post(
      url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-results-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'code', NEW.code,
          'ticker', NEW.ticker,
          'company_name', NEW.company_name,
          'report_date', NEW.report_date,
          'actual', NEW.actual,
          'estimate', NEW.estimate,
          'percent', NEW.percent,
          'revenue_actual', NEW.revenue_actual,
          'revenue_estimate_avg', NEW.revenue_estimate_avg,
          'revenue_surprise_percent', NEW.revenue_surprise_percent,
          'before_after_market', NEW.before_after_market,
          'updated_at', NEW.updated_at
        )
      )
    );
    
    RAISE NOTICE '🔔 Triggered earnings notification for % (actual: %)', NEW.ticker, NEW.actual;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. יצירת Trigger
-- ============================================

CREATE TRIGGER earnings_notification_trigger
  AFTER UPDATE ON earnings_calendar
  FOR EACH ROW
  WHEN (
    -- רק אם יש שינוי ב-actual או revenue_actual
    (OLD.actual IS DISTINCT FROM NEW.actual) OR
    (OLD.revenue_actual IS DISTINCT FROM NEW.revenue_actual)
  )
  EXECUTE FUNCTION trigger_earnings_results_notification();

-- ============================================
-- 5. בדיקת Trigger
-- ============================================

-- בדיקה שהפונקציה נוצרה
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname = 'trigger_earnings_results_notification';

-- בדיקה שה-trigger נוצר
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname = 'earnings_notification_trigger';

-- ============================================
-- 6. הערות
-- ============================================
-- 
-- ה-trigger יקרא ל-Edge Function רק כאשר:
-- 1. יש תוצאה חדשה (actual IS NOT NULL)
-- 2. התוצאה השתנתה (OLD.actual != NEW.actual)
-- 3. הרשומה חשובה (importance >= 3)
-- 4. זה דיווח של היום
-- 5. זה דיווח אמריקאי (.US)
--
-- כדי להסיר את ה-trigger:
-- DROP TRIGGER earnings_notification_trigger ON earnings_calendar;
-- DROP FUNCTION trigger_earnings_results_notification() CASCADE;





