-- ============================================
-- הפעלה מהירה של Earnings Sync (שבוע בלבד)
-- ============================================
-- 
-- זה מפעיל את הפונקציה עם טווח קטן (שבוע) כדי למנוע timeout

-- 1. בדיקת מצב לפני
DO $$
DECLARE
  before_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO before_count FROM earnings_calendar;
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🚀 הפעלת Earnings Sync (מהיר - שבוע)';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📊 מצב לפני: % דיווחים במסד', before_count;
  RAISE NOTICE '';
END $$;

-- 2. הפעלת הפונקציה עם שבוע קדימה בלבד
SELECT 
  success,
  message,
  http_response_id,
  date_from,
  date_to
FROM trigger_earnings_sync(
  (NOW() AT TIME ZONE 'America/New_York')::DATE,
  ((NOW() AT TIME ZONE 'America/New_York')::DATE + INTERVAL '7 days')::DATE
);

-- 3. הודעה
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ הפונקציה הופעלה!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '⏳ המתן 30-60 שניות לעיבוד הנתונים...';
  RAISE NOTICE '';
  RAISE NOTICE '📊 אחרי זה בדוק:';
  RAISE NOTICE '   SELECT COUNT(*) FROM earnings_calendar;';
  RAISE NOTICE '';
  RAISE NOTICE '📋 לוגים:';
  RAISE NOTICE '   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/logs/edge-functions';
  RAISE NOTICE '';
END $$;








