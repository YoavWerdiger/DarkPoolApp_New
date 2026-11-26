-- ========================================
-- הגדרת Cron Jobs לדיווחי תוצאות
-- ========================================

-- הפעלת Extension של pg_cron (אם עדיין לא מופעל)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ======================================
-- 1. סנכרון יומי - כל יום ב-06:00 בבוקר (שעון ישראל = 03:00 UTC)
-- ======================================
-- מושך נתונים ל-30 יום קדימה

SELECT cron.schedule(
  'earnings-daily-sync',           -- שם ה-Job
  '0 3 * * *',                      -- 06:00 Israel Time = 03:00 UTC
  $$
  SELECT
    net.http_post(
      url:='https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-daily-sync',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ'
      ),
      body:='{}'::jsonb,
      timeout_milliseconds:=30000
    ) as request_id;
  $$
);

-- ======================================
-- 2. עדכון תוצאות - פעמיים ביום
-- ======================================
-- עדכון תוצאות בפועל (actual values)

-- א. בבוקר - 04:30 ישראל = 01:30 UTC (אחרי דיווחי BeforeMarket)
SELECT cron.schedule(
  'earnings-results-morning',       -- שם ה-Job
  '30 1 * * *',                      -- 04:30 Israel Time = 01:30 UTC
  $$
  SELECT
    net.http_post(
      url:='https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-results-update',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ'
      ),
      body:='{}'::jsonb,
      timeout_milliseconds:=30000
    ) as request_id;
  $$
);

-- ב. בלילה - 23:00 ישראל = 20:00 UTC (אחרי דיווחי AfterMarket)
SELECT cron.schedule(
  'earnings-results-evening',       -- שם ה-Job
  '0 20 * * *',                      -- 23:00 Israel Time = 20:00 UTC
  $$
  SELECT
    net.http_post(
      url:='https://wpmrtczbfcijoocguime.supabase.co/functions/v1/earnings-results-update',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ'
      ),
      body:='{}'::jsonb,
      timeout_milliseconds:=30000
    ) as request_id;
  $$
);

-- ======================================
-- בדיקת הגדרות Cron
-- ======================================

-- הצגת כל ה-Jobs שהוגדרו
SELECT * FROM cron.job WHERE jobname LIKE 'earnings%';

-- ======================================
-- הסרת Cron Jobs ישנים (אם צריך)
-- ======================================

-- SELECT cron.unschedule('earnings-daily-sync');
-- SELECT cron.unschedule('earnings-results-morning');
-- SELECT cron.unschedule('earnings-results-evening');

-- ======================================
-- סיכום
-- ======================================

/*
✅ סנכרון יומי:
   - רץ כל יום ב-06:00 בבוקר (שעון ישראל)
   - מושך נתונים ל-30 יום קדימה
   - מעדכן את כל הדיווחים המתוכננים

✅ עדכון תוצאות (פעמיים ביום):
   - 04:30 בבוקר - אחרי דיווחי BeforeMarket
   - 23:00 בלילה - אחרי דיווחי AfterMarket
   - מעדכן רק תוצאות בפועל (actual values)

📋 Jobs שהוגדרו:
   1. earnings-daily-sync       (06:00 Israel)
   2. earnings-results-morning  (04:30 Israel)
   3. earnings-results-evening  (23:00 Israel)
*/

