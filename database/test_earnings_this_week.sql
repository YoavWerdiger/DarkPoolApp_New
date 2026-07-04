-- ============================================
-- בדיקת שליפה ראשונית - השבוע הקרוב בלבד
-- ============================================
-- 
-- שליפה של 7 ימים קדימה בלבד - לבדיקה מהירה
-- זה יאפשר לנו לראות אם הקוד עובד נכון לפני שמריצים על טווח גדול

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
  -- היום
  from_date := today_est;
  -- 7 ימים קדימה
  to_date := (today_est + INTERVAL '7 days')::DATE;
  
  from_date_str := from_date::TEXT;
  to_date_str := to_date::TEXT;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🧪 בדיקת שליפה ראשונית - השבוע הקרוב';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📅 טווח תאריכים (EST/EDT):';
  RAISE NOTICE '   ├─ מהיום (EST): %', today_est;
  RAISE NOTICE '   ├─ מתאריך: %', from_date_str;
  RAISE NOTICE '   └─ עד תאריך: %', to_date_str;
  RAISE NOTICE '   └─ טווח: 7 ימים קדימה';
  RAISE NOTICE '';
  
  -- 2. בדיקת מצב לפני
  SELECT COUNT(*) INTO before_count 
  FROM earnings_calendar 
  WHERE report_date BETWEEN from_date AND to_date;
  RAISE NOTICE '📊 מצב לפני: % דיווחים בטווח השבוע הקרוב', before_count;
  RAISE NOTICE '';
  
  -- 3. קריאה ל-Earnings Sync Function
  RAISE NOTICE '🚀 מפעיל Earnings Sync (שבוע הקרוב בלבד)...';
  
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
  RAISE NOTICE '   └─ זה אמור להיות מהיר כי זה רק 7 ימים';
  RAISE NOTICE '';
END $$;

-- 4. המתן 30 שניות
SELECT pg_sleep(30);

-- 5. בדיקה מיידית - כמה דיווחים יש עכשיו בטווח השבוע הקרוב
DO $$
DECLARE
  today_est DATE := (NOW() AT TIME ZONE 'America/New_York')::DATE;
  from_date DATE := today_est;
  to_date DATE := (today_est + INTERVAL '7 days')::DATE;
  after_count INTEGER;
  unique_companies INTEGER;
  reports_per_date RECORD;
BEGIN
  SELECT COUNT(*) INTO after_count 
  FROM earnings_calendar 
  WHERE report_date BETWEEN from_date AND to_date;
  
  SELECT COUNT(DISTINCT code) INTO unique_companies
  FROM earnings_calendar 
  WHERE report_date BETWEEN from_date AND to_date;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '📊 תוצאות - השבוע הקרוב:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '   ├─ סה"כ דיווחים: %', after_count;
  RAISE NOTICE '   ├─ חברות ייחודיות: %', unique_companies;
  
  IF unique_companies > 0 THEN
    RAISE NOTICE '   └─ ממוצע דיווחים לחברה: %', ROUND(after_count::NUMERIC / unique_companies, 2);
  END IF;
  RAISE NOTICE '';
  
  -- התפלגות לפי תאריך
  RAISE NOTICE '📅 התפלגות לפי תאריך:';
  FOR reports_per_date IN
    SELECT 
      report_date,
      COUNT(*) as count
    FROM earnings_calendar
    WHERE report_date BETWEEN from_date AND to_date
    GROUP BY report_date
    ORDER BY report_date
  LOOP
    RAISE NOTICE '   ├─ %: % דיווחים', reports_per_date.report_date, reports_per_date.count;
  END LOOP;
  RAISE NOTICE '';
  
  -- בדיקה: האם יש יותר מ-3 דיווחים לחברה כלשהי?
  RAISE NOTICE '🔍 בדיקת דיווחים לחברה:';
  FOR reports_per_date IN
    SELECT 
      code,
      COUNT(*) as count
    FROM earnings_calendar
    WHERE report_date BETWEEN from_date AND to_date
    GROUP BY code
    HAVING COUNT(*) > 3
    ORDER BY COUNT(*) DESC
    LIMIT 5
  LOOP
    RAISE NOTICE '   ├─ %: % דיווחים (יותר מ-3!)', reports_per_date.code, reports_per_date.count;
  END LOOP;
  
  IF NOT FOUND THEN
    RAISE NOTICE '   └─ ⚠️  אין חברות עם יותר מ-3 דיווחים - ייתכן שהבעיה עדיין קיימת';
  END IF;
  RAISE NOTICE '';
END $$;

-- 6. הצגת דוגמאות
SELECT 
  'Sample Reports (This Week)' as check_type,
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
ORDER BY report_date, code
LIMIT 20;

-- 7. הודעה
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ הבדיקה הושלמה!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '💡 מה הלאה:';
  RAISE NOTICE '   1. בדוק את הלוגים ב-Edge Functions';
  RAISE NOTICE '   2. אם יש יותר מ-3 דיווחים לחברה - הקוד עובד!';
  RAISE NOTICE '   3. אם עדיין רק 3 - צריך לבדוק את הלוגים';
  RAISE NOTICE '';
END $$;

