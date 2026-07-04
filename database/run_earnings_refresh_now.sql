-- ============================================
-- רענון מיידי של נתוני דיווחים - עם התיקון החדש
-- ============================================
-- 
-- שליפה של 3 חודשים אחורה + שנה קדימה (מקסימום)
-- ללא סינון - שומרים הכל במסד

-- 1. חישוב תאריכים ב-America/New_York timezone (EST/EDT)
-- חשוב: Benzinga API מצפה לתאריכים ב-EST/EDT, לא ב-UTC/ישראל
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
         -- 3 חודשים אחורה
         from_date := (today_est - INTERVAL '3 months')::DATE;
         -- שנה קדימה (מקסימום)
         to_date := (today_est + INTERVAL '1 year')::DATE;
  
  from_date_str := from_date::TEXT;
  to_date_str := to_date::TEXT;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🚀 רענון נתוני דיווחים רבעוניים';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📅 טווח תאריכים (EST/EDT):';
  RAISE NOTICE '   ├─ מהיום (EST): %', today_est;
  RAISE NOTICE '   ├─ מתאריך: %', from_date_str;
  RAISE NOTICE '   └─ עד תאריך: % (שנה קדימה - מקסימום)', to_date_str;
  RAISE NOTICE '';
  RAISE NOTICE '🔧 הגדרות:';
  RAISE NOTICE '   ├─ שימוש ב-parameters[date] לכל יום';
  RAISE NOTICE '   ├─ תאריכים ב-America/New_York timezone (EST/EDT)';
  RAISE NOTICE '   └─ ללא סינון - שומרים הכל במסד';
  RAISE NOTICE '';
  
  -- 2. בדיקת מצב לפני
  SELECT COUNT(*) INTO before_count FROM earnings_calendar;
  RAISE NOTICE '📊 מצב לפני: % דיווחים במסד', before_count;
  RAISE NOTICE '';
  
  -- 3. קריאה ל-Earnings Sync Function
  RAISE NOTICE '🚀 מפעיל Earnings Sync...';
  
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
  RAISE NOTICE '⏳ המתן 60-120 שניות...';
  RAISE NOTICE '   └─ זה עלול לקחת זמן בגלל כמות הנתונים';
  RAISE NOTICE '';
  RAISE NOTICE '📊 אחרי זה בדוק:';
  RAISE NOTICE '   SELECT COUNT(*) FROM earnings_calendar;';
  RAISE NOTICE '   SELECT COUNT(*) FROM earnings_calendar WHERE report_date BETWEEN % AND %;', from_date_str, to_date_str;
  RAISE NOTICE '';
END $$;

-- 4. בדיקה מיידית - כמה דיווחים יש עכשיו
SELECT 
  'Current Status' as check_type,
  COUNT(*) as total_reports,
  COUNT(CASE WHEN report_date < CURRENT_DATE THEN 1 END) as past_reports,
  COUNT(CASE WHEN report_date = CURRENT_DATE THEN 1 END) as today_reports,
  COUNT(CASE WHEN report_date > CURRENT_DATE THEN 1 END) as future_reports,
  MIN(report_date)::text as earliest_date,
  MAX(report_date)::text as latest_date
FROM earnings_calendar;

-- 5. הודעה
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ הסקריפט הושלם!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '💡 מה הלאה:';
  RAISE NOTICE '   1. המתן 60-120 שניות';
  RAISE NOTICE '   2. הרץ: SELECT COUNT(*) FROM earnings_calendar;';
  RAISE NOTICE '   3. בדוק את המסך באפליקציה';
  RAISE NOTICE '';
END $$;

