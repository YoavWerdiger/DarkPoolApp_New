-- ====================================
-- הגדרת Cron Jobs ליומן פיננסי מורחב
-- ====================================
--
-- הרץ את הסקריפט הזה ב-Supabase SQL Editor
-- כדי להגדיר עדכונים אוטומטיים יומיים
--
-- ⚠️ שים לב: pg_cron חייב להיות מותקן ופעיל ב-Supabase
--

-- ====================================
-- 1. Daily Earnings Trends Sync
-- ====================================

SELECT cron.schedule(
  'daily-earnings-trends-sync',
  '0 7 * * *', -- 07:00 בוקר כל יום
  $$
  SELECT
    net.http_post(
      url:='https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-trends',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- ====================================
-- 2. Daily IPOs Sync
-- ====================================

SELECT cron.schedule(
  'daily-ipos-sync',
  '0 7 * * *', -- 07:00 בוקר כל יום
  $$
  SELECT
    net.http_post(
      url:='https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-ipos-sync',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- ====================================
-- 3. Daily Splits Sync
-- ====================================

SELECT cron.schedule(
  'daily-splits-sync',
  '0 7 * * *', -- 07:00 בוקר כל יום
  $$
  SELECT
    net.http_post(
      url:='https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-splits-sync',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- ====================================
-- 4. Daily Dividends Sync
-- ====================================

SELECT cron.schedule(
  'daily-dividends-sync',
  '0 7 * * *', -- 07:00 בוקר כל יום
  $$
  SELECT
    net.http_post(
      url:='https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-dividends-sync',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- ====================================
-- בדיקת Cron Jobs פעילים
-- ====================================

SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname LIKE 'daily-%'
ORDER BY jobname;

-- ====================================
-- מחיקת Cron Jobs (במידת הצורך)
-- ====================================

-- הסר את ההערות כדי למחוק:
-- SELECT cron.unschedule('daily-earnings-trends-sync');
-- SELECT cron.unschedule('daily-ipos-sync');
-- SELECT cron.unschedule('daily-splits-sync');
-- SELECT cron.unschedule('daily-dividends-sync');

-- ====================================
-- Success Message
-- ====================================

DO $$
BEGIN
  RAISE NOTICE '✅ Cron Jobs configured successfully!';
  RAISE NOTICE '⏰ All jobs scheduled for 07:00 daily';
  RAISE NOTICE '📊 daily-earnings-trends-sync - Active';
  RAISE NOTICE '🚀 daily-ipos-sync - Active';
  RAISE NOTICE '✂️ daily-splits-sync - Active';
  RAISE NOTICE '💰 daily-dividends-sync - Active';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ Remember to replace YOUR_ANON_KEY with your actual Supabase anon key!';
END $$;
