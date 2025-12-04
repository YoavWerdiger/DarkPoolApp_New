-- ============================================
-- טעינה ראשונית של נתוני Benzinga
-- שליפה חד-פעמית: שבוע אחורה + 3 חודשים קדימה
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '🚀 מתחיל טעינה ראשונית של נתוני Benzinga...';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Earnings: שבוע אחורה + 3 חודשים קדימה';
  RAISE NOTICE '📅 Economics: 3 חודשים קדימה';
  RAISE NOTICE '';
  RAISE NOTICE '⏳ זה יקח כ-60 שניות...';
END $$;

-- ============================================
-- 1. טעינת Earnings
-- ============================================
-- Function כבר מוגדר לשלוף: שבוע אחורה + 3 חודשים קדימה

SELECT 
  net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  ) as earnings_response;

DO $$
BEGIN
  RAISE NOTICE '✅ בקשת Earnings נשלחה';
  RAISE NOTICE '⏳ ממתין 10 שניות...';
END $$;

-- המתן 10 שניות
SELECT pg_sleep(10);

-- ============================================
-- 2. טעינת Economic Calendar
-- ============================================
-- Function כבר מוגדר לשלוף: שבוע אחורה + 3 חודשים קדימה

SELECT 
  net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/benzinga-economics-sync',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 90000
  ) as economics_response;

DO $$
BEGIN
  RAISE NOTICE '✅ בקשת Economics נשלחה';
  RAISE NOTICE '';
  RAISE NOTICE '⏳ ממתין עוד 30 שניות לעיבוד...';
END $$;

-- המתן 30 שניות
SELECT pg_sleep(30);

-- ============================================
-- 3. בדיקת תוצאות
-- ============================================

DO $$
DECLARE
  earnings_count INTEGER;
  economics_count INTEGER;
  earliest_earning DATE;
  latest_earning DATE;
  earliest_economic DATE;
  latest_economic DATE;
BEGIN
  -- ספירת Earnings
  SELECT COUNT(*), MIN(report_date), MAX(report_date)
  INTO earnings_count, earliest_earning, latest_earning
  FROM earnings_calendar;
  
  -- ספירת Economics
  SELECT COUNT(*), MIN(date), MAX(date)
  INTO economics_count, earliest_economic, latest_economic
  FROM economic_events_cache
  WHERE source = 'Benzinga';
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 תוצאות:';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📈 Earnings Calendar:';
  RAISE NOTICE '   └─ סה"כ: % דיווחים', earnings_count;
  RAISE NOTICE '   └─ טווח: % עד %', earliest_earning, latest_earning;
  RAISE NOTICE '';
  RAISE NOTICE '📅 Economic Events:';
  RAISE NOTICE '   └─ סה"כ: % אירועים', economics_count;
  RAISE NOTICE '   └─ טווח: % עד %', earliest_economic, latest_economic;
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  
  IF earnings_count > 0 AND economics_count > 0 THEN
    RAISE NOTICE '✅ הטעינה הראשונית הצליחה!';
  ELSE
    RAISE NOTICE '⚠️  נראה שיש בעיה - בדוק לוגים:';
    RAISE NOTICE '   https://supabase.com/dashboard/project/wpmrtczbfcijoocguime/logs/edge-functions';
  END IF;
END $$;

-- הצגת דוגמאות
SELECT 
  'Earnings Sample' as type,
  code,
  report_date,
  before_after_market
FROM earnings_calendar
ORDER BY report_date DESC
LIMIT 5;

SELECT 
  'Economics Sample' as type,
  title,
  date,
  time,
  importance
FROM economic_events_cache
WHERE source = 'Benzinga'
ORDER BY date DESC
LIMIT 5;

-- ============================================
-- הודעת סיום
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🎉 סיימנו!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 מה הלאה:';
  RAISE NOTICE '   1. בדוק את הנתונים באפליקציה';
  RAISE NOTICE '   2. ה-Cron Jobs ירוצו אוטומטית מחר';
  RAISE NOTICE '   3. הנתונים יתעדכנו אוטומטית';
  RAISE NOTICE '';
END $$;

