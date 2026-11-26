-- ====================================
-- תיקון Cron Jobs - עדכון Anon Key
-- ====================================
--
-- הסקריפט הזה מעדכן את 4 הפונקציות החדשות
-- עם המפתח האמיתי במקום YOUR_ANON_KEY
--

-- המפתח הנכון שלך:
-- eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ

-- ====================================
-- מחיקת הפונקציות הישנות עם YOUR_ANON_KEY
-- ====================================

SELECT cron.unschedule('daily-earnings-trends-sync');
SELECT cron.unschedule('daily-ipos-sync');
SELECT cron.unschedule('daily-splits-sync');
SELECT cron.unschedule('daily-dividends-sync');

-- ====================================
-- יצירת הפונקציות מחדש עם המפתח הנכון
-- ====================================

-- 1. Daily Earnings Trends Sync
SELECT cron.schedule(
  'daily-earnings-trends-sync',
  '0 7 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-trends',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- 2. Daily IPOs Sync
SELECT cron.schedule(
  'daily-ipos-sync',
  '0 7 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-ipos-sync',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- 3. Daily Splits Sync
SELECT cron.schedule(
  'daily-splits-sync',
  '0 7 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-splits-sync',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- 4. Daily Dividends Sync
SELECT cron.schedule(
  'daily-dividends-sync',
  '0 7 * * *',
  $$
  SELECT
    net.http_post(
      url:='https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-dividends-sync',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- ====================================
-- בדיקה שהכל עבד
-- ====================================

SELECT 
  jobid,
  jobname,
  schedule,
  CASE 
    WHEN command LIKE '%YOUR_ANON_KEY%' THEN '❌ עדיין עם YOUR_ANON_KEY'
    ELSE '✅ עם המפתח הנכון'
  END as status,
  active
FROM cron.job
WHERE jobname IN (
  'daily-earnings-trends-sync',
  'daily-ipos-sync',
  'daily-splits-sync',
  'daily-dividends-sync'
)
ORDER BY jobname;

-- ====================================
-- Success Message
-- ====================================

DO $$
BEGIN
  RAISE NOTICE '✅ Cron Jobs updated successfully!';
  RAISE NOTICE '📊 daily-earnings-trends-sync - Fixed';
  RAISE NOTICE '🚀 daily-ipos-sync - Fixed';
  RAISE NOTICE '✂️ daily-splits-sync - Fixed';
  RAISE NOTICE '💰 daily-dividends-sync - Fixed';
  RAISE NOTICE '';
  RAISE NOTICE '⏰ All jobs will run tomorrow at 07:00';
END $$;


