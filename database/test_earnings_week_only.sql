-- ============================================
-- שליפה ראשונית - שבוע הקרוב בלבד
-- ============================================
-- 
-- שליפה של שבוע אחד קדימה (7 ימים) לבדיקה
-- זה יאפשר לנו לבדוק אם הפתרון עובד לפני שמריצים את כל הטווח הגדול

-- 1. חישוב תאריכים ב-America/New_York timezone (EST/EDT)
DO $$
DECLARE
  -- תאריך היום ב-America/New_York timezone
  today_est TIMESTAMP WITH TIME ZONE := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  from_date DATE;
  to_date DATE;
  from_date_str TEXT;
  to_date_str TEXT;
  before_count INTEGER;
BEGIN
  -- היום + שבוע קדימה (7 ימים)
  from_date := today_est;
  to_date := (today_est + INTERVAL '7 days')::DATE;
  
  from_date_str := from_date::TEXT;
  to_date_str := to_date::TEXT;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🧪 שליפה ראשונית - שבוע הקרוב בלבד';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📅 טווח תאריכים (EST/EDT):';
  RAISE NOTICE '   ├─ מהיום (EST): %', today_est;
  RAISE NOTICE '   ├─ מתאריך: %', from_date_str;
  RAISE NOTICE '   └─ עד תאריך: %', to_date_str;
  RAISE NOTICE '   └─ טווח: 7 ימים';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 שיטה:';
  RAISE NOTICE '   └─ שליפה יום-יום (parameters[date])';
  RAISE NOTICE '';
  
  -- 2. בדיקת מצב לפני
  SELECT COUNT(*) INTO before_count 
  FROM earnings_calendar 
  WHERE report_date BETWEEN from_date AND to_date;
  RAISE NOTICE '📊 מצב לפני: % דיווחים בטווח השבוע', before_count;
  RAISE NOTICE '';
  
  -- 3. קריאה ל-Earnings Sync Function
  RAISE NOTICE '🚀 מפעיל Earnings Sync (שבוע בלבד)...';
  
  PERFORM net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple',
    headers := jsonb_build_object(
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'date_from', from_date_str,
      'date_to', to_date_str
    )
  );
  
  RAISE NOTICE '✅ הבקשה נשלחה!';
  RAISE NOTICE '';
  RAISE NOTICE '⏳ המתן 30-60 שניות...';
  RAISE NOTICE '   └─ זה אמור להיות מהיר כי זה רק שבוע';
  RAISE NOTICE '';
END $$;

-- 4. המתן 30 שניות
SELECT pg_sleep(30);

-- 5. בדיקה מיידית - כמה דיווחים יש עכשיו בטווח השבוע
DO $$
DECLARE
  today_est TIMESTAMP WITH TIME ZONE := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  from_date DATE;
  to_date DATE;
  after_count INTEGER;
  unique_companies INTEGER;
BEGIN
  from_date := today_est;
  to_date := (today_est + INTERVAL '7 days')::DATE;
  
  SELECT COUNT(*) INTO after_count 
  FROM earnings_calendar 
  WHERE report_date BETWEEN from_date AND to_date;
  
  SELECT COUNT(DISTINCT code) INTO unique_companies
  FROM earnings_calendar 
  WHERE report_date BETWEEN from_date AND to_date;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 תוצאות (שבוע הקרוב):';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '   ├─ סה"כ דיווחים: %', after_count;
  RAISE NOTICE '   ├─ חברות ייחודיות: %', unique_companies;
  IF unique_companies > 0 THEN
    RAISE NOTICE '   └─ ממוצע דיווחים לחברה: %', ROUND(after_count::NUMERIC / unique_companies, 2);
  END IF;
  RAISE NOTICE '';
  
  IF after_count > 50 THEN
    RAISE NOTICE '✅ נראה טוב! יש הרבה דיווחים (יותר מ-50)';
    RAISE NOTICE '   └─ זה אומר שהשליפה יום-יום עובדת!';
  ELSIF after_count > 20 THEN
    RAISE NOTICE '⚠️  יש דיווחים אבל לא הרבה (% דיווחים)', after_count;
    RAISE NOTICE '   └─ אולי יש הגבלה ב-API או שפשוט אין הרבה דיווחים השבוע';
  ELSE
    RAISE NOTICE '❌ מעט מדי דיווחים (% דיווחים)', after_count;
    RAISE NOTICE '   └─ בדוק את הלוגים ב-Edge Functions';
  END IF;
  RAISE NOTICE '';
END $$;

-- 6. הצגת דוגמאות דיווחים מהשבוע
SELECT 
  'Sample Reports (Next Week)' as check_type,
  code,
  report_date,
  before_after_market,
  actual,
  estimate,
  difference,
  percent,
  revenue_actual,
  revenue_estimate_avg
FROM earnings_calendar
WHERE report_date BETWEEN (NOW() AT TIME ZONE 'America/New_York')::DATE 
  AND ((NOW() AT TIME ZONE 'America/New_York')::DATE + INTERVAL '7 days')
ORDER BY report_date ASC, code
LIMIT 20;

-- 7. התפלגות לפי יום
SELECT 
  'Reports Per Day (Next Week)' as check_type,
  report_date,
  COUNT(*) as reports_count,
  COUNT(DISTINCT code) as unique_companies
FROM earnings_calendar
WHERE report_date BETWEEN (NOW() AT TIME ZONE 'America/New_York')::DATE 
  AND ((NOW() AT TIME ZONE 'America/New_York')::DATE + INTERVAL '7 days')
GROUP BY report_date
ORDER BY report_date ASC;

-- 8. הודעה סופית
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ הבדיקה הושלמה!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '💡 מה הלאה:';
  RAISE NOTICE '   1. בדוק את הלוגים ב-Edge Functions';
  RAISE NOTICE '   2. אם יש הרבה דיווחים - הרץ את run_earnings_refresh_now.sql';
  RAISE NOTICE '   3. אם עדיין מעט - נבדוק מה הבעיה';
  RAISE NOTICE '';
END $$;








