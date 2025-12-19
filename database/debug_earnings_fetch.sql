-- ============================================
-- דיבאג - למה יש רק 36 דיווחים?
-- ============================================

-- 1. בדיקת כל הדיווחים במסד
SELECT 
  'All Reports' as check_type,
  COUNT(*) as total,
  COUNT(DISTINCT code) as unique_symbols,
  COUNT(DISTINCT report_date) as unique_dates,
  MIN(report_date)::text as earliest,
  MAX(report_date)::text as latest
FROM earnings_calendar;

-- 2. פירוט לפי תאריכים
SELECT 
  'Reports by Date' as check_type,
  report_date,
  COUNT(*) as count,
  STRING_AGG(DISTINCT code, ', ' ORDER BY code) as symbols
FROM earnings_calendar
GROUP BY report_date
ORDER BY report_date;

-- 3. בדיקת source
SELECT 
  'By Source' as check_type,
  source,
  COUNT(*) as count
FROM earnings_calendar
GROUP BY source;

-- 4. בדיקת before_after_market
SELECT 
  'By Market Time' as check_type,
  before_after_market,
  COUNT(*) as count
FROM earnings_calendar
GROUP BY before_after_market;

-- 5. דוגמאות דיווחים
SELECT 
  'Sample Reports' as check_type,
  code,
  report_date,
  before_after_market,
  actual,
  estimate,
  source,
  created_at
FROM earnings_calendar
ORDER BY report_date DESC, code
LIMIT 20;

-- 6. בדיקת תאריכים קרובים (14 ימים)
SELECT 
  'Next 14 Days' as check_type,
  report_date,
  COUNT(*) as reports_count
FROM earnings_calendar
WHERE report_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
GROUP BY report_date
ORDER BY report_date;

-- 7. הודעה
DO $$
DECLARE
  total_count INTEGER;
  today_count INTEGER;
  week_count INTEGER;
  unique_symbols INTEGER;
  unique_dates INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM earnings_calendar;
  SELECT COUNT(*) INTO today_count FROM earnings_calendar WHERE report_date = CURRENT_DATE;
  SELECT COUNT(*) INTO week_count FROM earnings_calendar WHERE report_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days';
  SELECT COUNT(DISTINCT code) INTO unique_symbols FROM earnings_calendar;
  SELECT COUNT(DISTINCT report_date) INTO unique_dates FROM earnings_calendar;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🔍 דיבאג - למה יש רק 36 דיווחים?';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📊 סטטיסטיקות:';
  RAISE NOTICE '   ├─ סה"כ דיווחים: %', total_count;
  RAISE NOTICE '   ├─ סימבולים ייחודיים: %', unique_symbols;
  RAISE NOTICE '   ├─ תאריכים ייחודיים: %', unique_dates;
  RAISE NOTICE '   ├─ דיווחים היום: %', today_count;
  RAISE NOTICE '   └─ דיווחים שבוע הקרוב: %', week_count;
  RAISE NOTICE '';
  
  IF total_count < 100 THEN
    RAISE NOTICE '⚠️  יש מעט מדי דיווחים!';
    RAISE NOTICE '   └─ צריך לבדוק את הפונקציה daily-earnings-sync-simple';
    RAISE NOTICE '   └─ אולי יש בעיה ב-pagination או ב-API';
    RAISE NOTICE '   └─ הרץ: database/refresh_earnings_data.sql';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '💡 המלצות:';
  RAISE NOTICE '   1. בדוק את הלוגים של daily-earnings-sync-simple';
  RAISE NOTICE '   2. הרץ refresh_earnings_data.sql לשליפה מורחבת';
  RAISE NOTICE '   3. בדוק שהפונקציה רצה עם pagination נכון';
  RAISE NOTICE '';
END $$;








