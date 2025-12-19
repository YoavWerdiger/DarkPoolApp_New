-- ============================================
-- בדיקת דיווחים להיום ולשבוע הקרוב
-- ============================================

-- 1. בדיקת דיווחים להיום
SELECT 
  'Today Earnings' as check_type,
  COUNT(*) as reports_count,
  COUNT(CASE WHEN before_after_market = 'BeforeMarket' THEN 1 END) as before_market,
  COUNT(CASE WHEN before_after_market = 'AfterMarket' THEN 1 END) as after_market,
  COUNT(CASE WHEN actual IS NOT NULL THEN 1 END) as with_results
FROM earnings_calendar
WHERE report_date = CURRENT_DATE;

-- 2. דיווחים של היום (אם יש)
SELECT 
  'Today Reports Detail' as check_type,
  code,
  report_date,
  before_after_market,
  actual,
  estimate,
  difference,
  percent,
  source,
  created_at
FROM earnings_calendar
WHERE report_date = CURRENT_DATE
ORDER BY before_after_market NULLS LAST, code;

-- 3. דיווחים לשבוע הקרוב (7 ימים)
SELECT 
  'Next 7 Days' as check_type,
  report_date,
  COUNT(*) as reports_count,
  COUNT(CASE WHEN before_after_market = 'BeforeMarket' THEN 1 END) as before_market,
  COUNT(CASE WHEN before_after_market = 'AfterMarket' THEN 1 END) as after_market,
  COUNT(CASE WHEN actual IS NOT NULL THEN 1 END) as with_results
FROM earnings_calendar
WHERE report_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
GROUP BY report_date
ORDER BY report_date;

-- 4. דיווחים עם תוצאות (actual) - שבוע אחרון
SELECT 
  'Recent Results' as check_type,
  code,
  report_date,
  before_after_market,
  actual,
  estimate,
  difference,
  percent,
  ROUND(percent::numeric, 2) as percent_rounded
FROM earnings_calendar
WHERE actual IS NOT NULL
  AND report_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY report_date DESC, code
LIMIT 20;

-- 5. בדיקת תאריכים קרובים
SELECT 
  'Upcoming Reports' as check_type,
  report_date,
  COUNT(*) as reports_count,
  STRING_AGG(DISTINCT code, ', ' ORDER BY code) as symbols
FROM earnings_calendar
WHERE report_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '14 days'
GROUP BY report_date
ORDER BY report_date
LIMIT 14;

-- 6. הודעה
DO $$
DECLARE
  today_count INTEGER;
  week_count INTEGER;
  with_results INTEGER;
BEGIN
  SELECT COUNT(*) INTO today_count FROM earnings_calendar WHERE report_date = CURRENT_DATE;
  SELECT COUNT(*) INTO week_count FROM earnings_calendar WHERE report_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days';
  SELECT COUNT(*) INTO with_results FROM earnings_calendar WHERE actual IS NOT NULL AND report_date >= CURRENT_DATE - INTERVAL '7 days';
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 מצב דיווחים רבעוניים';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📅 היום (%):', CURRENT_DATE;
  RAISE NOTICE '   └─ דיווחים: %', today_count;
  RAISE NOTICE '';
  RAISE NOTICE '📅 שבוע הקרוב (7 ימים):';
  RAISE NOTICE '   └─ דיווחים: %', week_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ תוצאות (7 ימים אחרונים):';
  RAISE NOTICE '   └─ דיווחים עם תוצאות: %', with_results;
  RAISE NOTICE '';
  
  IF today_count = 0 THEN
    RAISE NOTICE '⚠️  אין דיווחים להיום';
    RAISE NOTICE '   └─ זה נורמלי - לא כל יום יש דיווחים';
    RAISE NOTICE '   └─ בדוק את השבוע הקרוב למעלה';
  END IF;
  
  IF week_count = 0 THEN
    RAISE NOTICE '⚠️  אין דיווחים לשבוע הקרוב';
    RAISE NOTICE '   └─ כדאי לשלוף נתונים נוספים';
    RAISE NOTICE '   └─ הרץ: database/fetch_earnings_now.sql';
  END IF;
  
  RAISE NOTICE '';
END $$;








