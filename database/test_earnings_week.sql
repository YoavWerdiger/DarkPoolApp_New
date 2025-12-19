-- ============================================
-- בדיקת דיווחים לשבוע הקרוב
-- ============================================

-- 1. כמה דיווחים יש לשבוע הקרוב (7 ימים)
SELECT 
  'Next 7 Days' as check_type,
  report_date,
  COUNT(*) as reports_count,
  COUNT(CASE WHEN before_after_market = 'BeforeMarket' THEN 1 END) as before_market,
  COUNT(CASE WHEN before_after_market = 'AfterMarket' THEN 1 END) as after_market,
  STRING_AGG(DISTINCT code, ', ' ORDER BY code) as symbols
FROM earnings_calendar
WHERE report_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
GROUP BY report_date
ORDER BY report_date;

-- 2. כמה דיווחים יש בכלל בטווח של 3 חודשים קדימה
SELECT 
  'Next 3 Months' as check_type,
  COUNT(*) as total_reports,
  COUNT(DISTINCT report_date) as unique_dates,
  COUNT(DISTINCT code) as unique_symbols,
  MIN(report_date)::text as earliest,
  MAX(report_date)::text as latest
FROM earnings_calendar
WHERE report_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 months';

-- 3. פירוט לפי שבועות
SELECT 
  'By Week' as check_type,
  DATE_TRUNC('week', report_date)::date as week_start,
  COUNT(*) as reports_count,
  COUNT(DISTINCT code) as unique_symbols
FROM earnings_calendar
WHERE report_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 months'
GROUP BY DATE_TRUNC('week', report_date)
ORDER BY week_start;

-- 4. הודעה
DO $$
DECLARE
  week_count INTEGER;
  month_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO week_count 
  FROM earnings_calendar 
  WHERE report_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days';
  
  SELECT COUNT(*) INTO month_count 
  FROM earnings_calendar 
  WHERE report_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 months';
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 בדיקת דיווחים לשבוע הקרוב';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📅 שבוע הקרוב (7 ימים):';
  RAISE NOTICE '   └─ דיווחים: %', week_count;
  RAISE NOTICE '';
  RAISE NOTICE '📅 3 חודשים קדימה:';
  RAISE NOTICE '   └─ דיווחים: %', month_count;
  RAISE NOTICE '';
  
  IF week_count = 0 THEN
    RAISE NOTICE '⚠️  אין דיווחים לשבוע הקרוב!';
    RAISE NOTICE '   └─ זה יכול להיות נורמלי (לא כל שבוע יש דיווחים)';
    RAISE NOTICE '   └─ או שיש בעיה בשליפה';
  END IF;
  
  RAISE NOTICE '';
END $$;








