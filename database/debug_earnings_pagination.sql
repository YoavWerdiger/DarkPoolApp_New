-- ============================================
-- בדיקת Pagination - למה רק 90 דיווחים?
-- ============================================

-- 1. כמה דיווחים יש לפי תאריך
SELECT 
  'Reports by Date' as check_type,
  report_date,
  COUNT(*) as reports_count,
  COUNT(DISTINCT code) as unique_stocks
FROM earnings_calendar
GROUP BY report_date
ORDER BY report_date
LIMIT 20;

-- 2. כמה מניות יש בסך הכל
SELECT 
  'Unique Stocks' as check_type,
  COUNT(DISTINCT code) as total_stocks,
  STRING_AGG(DISTINCT code, ', ' ORDER BY code) as stock_list
FROM earnings_calendar;

-- 3. כמה דיווחים לכל מניה
SELECT 
  'Reports per Stock' as check_type,
  code,
  COUNT(*) as reports_count,
  MIN(report_date)::text as first_report,
  MAX(report_date)::text as last_report
FROM earnings_calendar
GROUP BY code
ORDER BY reports_count DESC
LIMIT 20;

-- 4. בדיקת טווח תאריכים
DO $$
DECLARE
  today_est DATE := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  from_date DATE;
  to_date DATE;
  expected_days INTEGER;
  actual_days INTEGER;
BEGIN
  from_date := (today_est - INTERVAL '3 months')::DATE;
  to_date := (today_est + INTERVAL '6 months')::DATE;
  expected_days := to_date - from_date;
  
  SELECT COUNT(DISTINCT report_date) INTO actual_days
  FROM earnings_calendar;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 בדיקת טווח תאריכים';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📅 טווח צפוי:';
  RAISE NOTICE '   ├─ מתאריך: %', from_date;
  RAISE NOTICE '   ├─ עד תאריך: %', to_date;
  RAISE NOTICE '   └─ ימים: %', expected_days;
  RAISE NOTICE '';
  RAISE NOTICE '📅 טווח בפועל במסד:';
  RAISE NOTICE '   └─ ימים עם דיווחים: %', actual_days;
  RAISE NOTICE '';
  
  IF actual_days < expected_days / 2 THEN
    RAISE NOTICE '⚠️  יש פחות מחצי מהתאריכים הצפויים!';
    RAISE NOTICE '   └─ זה אומר שהפונקציה לא שולפת מספיק דיווחים';
  END IF;
  
  RAISE NOTICE '';
END $$;







