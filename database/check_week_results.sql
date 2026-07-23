-- ============================================
-- בדיקת תוצאות - שבוע הקרוב
-- ============================================
-- הרץ את זה אחרי שהפונקציה מסיימת

-- 1. סטטיסטיקות כלליות
DO $$
DECLARE
  today_est TIMESTAMP WITH TIME ZONE := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  from_date DATE;
  to_date DATE;
  total_count INTEGER;
  unique_companies INTEGER;
  avg_reports NUMERIC;
BEGIN
  from_date := today_est;
  to_date := (today_est + INTERVAL '7 days')::DATE;
  
  SELECT COUNT(*) INTO total_count 
  FROM earnings_calendar 
  WHERE report_date BETWEEN from_date AND to_date;
  
  SELECT COUNT(DISTINCT code) INTO unique_companies
  FROM earnings_calendar 
  WHERE report_date BETWEEN from_date AND to_date;
  
  IF unique_companies > 0 THEN
    avg_reports := ROUND(total_count::NUMERIC / unique_companies, 2);
  ELSE
    avg_reports := 0;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 תוצאות - שבוע הקרוב (7 ימים)';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '   ├─ טווח: % עד %', from_date, to_date;
  RAISE NOTICE '   ├─ סה"כ דיווחים: %', total_count;
  RAISE NOTICE '   ├─ חברות ייחודיות: %', unique_companies;
  RAISE NOTICE '   └─ ממוצע דיווחים לחברה: %', avg_reports;
  RAISE NOTICE '';
  
  IF total_count > 50 THEN
    RAISE NOTICE '✅ מעולה! יש הרבה דיווחים (יותר מ-50)';
    RAISE NOTICE '   └─ הפתרון של שליפה יום-יום עובד!';
    RAISE NOTICE '   └─ אפשר להריץ את run_earnings_refresh_now.sql לטווח המלא';
  ELSIF total_count > 20 THEN
    RAISE NOTICE '⚠️  יש דיווחים אבל לא הרבה (% דיווחים)', total_count;
    IF avg_reports <= 3.5 THEN
      RAISE NOTICE '   └─ ממוצע של % דיווחים לחברה - עדיין נראה כמו הגבלה', avg_reports;
    ELSE
      RAISE NOTICE '   └─ ממוצע של % דיווחים לחברה - נראה טוב!', avg_reports;
    END IF;
  ELSIF total_count > 0 THEN
    RAISE NOTICE '⚠️  מעט דיווחים (% דיווחים)', total_count;
    RAISE NOTICE '   └─ בדוק את הלוגים ב-Edge Functions';
  ELSE
    RAISE NOTICE '❌ אין דיווחים בטווח';
    RAISE NOTICE '   └─ הפונקציה עדיין רצה או שיש בעיה';
    RAISE NOTICE '   └─ בדוק את הלוגים ב-Edge Functions';
  END IF;
  RAISE NOTICE '';
END $$;

-- 2. התפלגות לפי יום
SELECT 
  report_date,
  COUNT(*) as reports_count,
  COUNT(DISTINCT code) as unique_companies,
  COUNT(CASE WHEN before_after_market = 'Before Market' THEN 1 END) as before_market,
  COUNT(CASE WHEN before_after_market = 'After Market' THEN 1 END) as after_market
FROM earnings_calendar
WHERE report_date BETWEEN (NOW() AT TIME ZONE 'America/New_York')::DATE 
  AND ((NOW() AT TIME ZONE 'America/New_York')::DATE + INTERVAL '7 days')
GROUP BY report_date
ORDER BY report_date ASC;

-- 3. דוגמאות דיווחים
SELECT 
  code,
  report_date,
  before_after_market,
  actual,
  estimate,
  revenue_actual,
  revenue_estimate_avg
FROM earnings_calendar
WHERE report_date BETWEEN (NOW() AT TIME ZONE 'America/New_York')::DATE 
  AND ((NOW() AT TIME ZONE 'America/New_York')::DATE + INTERVAL '7 days')
ORDER BY report_date ASC, code
LIMIT 20;

-- 4. חברות עם הכי הרבה דיווחים
SELECT 
  code,
  COUNT(*) as reports_count,
  MIN(report_date) as first_report,
  MAX(report_date) as last_report
FROM earnings_calendar
WHERE report_date BETWEEN (NOW() AT TIME ZONE 'America/New_York')::DATE 
  AND ((NOW() AT TIME ZONE 'America/New_York')::DATE + INTERVAL '7 days')
GROUP BY code
HAVING COUNT(*) > 1
ORDER BY reports_count DESC
LIMIT 10;








