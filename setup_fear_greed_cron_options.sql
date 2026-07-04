-- ====================================
-- אפשרויות תדירות שונות לעדכון מדד הפחד והתאווה
-- ====================================
-- בחר את האפשרות המתאימה לך והרץ רק את החלק הרלוונטי

-- הפעלת Extension של pg_cron (אם עדיין לא מופעל)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- מחיקת Cron Job ישן (אם קיים)
SELECT cron.unschedule('fear-greed-index-update');

-- ====================================
-- אפשרות 1: כל שעה (מומלץ עם 500K/חודש! ⭐)
-- ====================================
-- 24 קריאות/יום = 720 קריאות/חודש
-- עלות: $0 (כלול ב-500,000 קריאות/חודש)
-- שימוש: רק 0.14% מהמגבלה החינמית!
-- מומלץ אם: אתה רוצה נתונים מעודכנים תכופים
--
SELECT cron.schedule(
  'fear-greed-index-update',
  '0 * * * *',  -- כל שעה
--   $$
--   SELECT net.http_post(
--     url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/fear-greed-update',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb,
--     timeout_milliseconds := 30000
--   ) as request_id;
--   $$
-- );

-- ====================================
-- אפשרות 2: כל 3 שעות
-- ====================================
-- 8 קריאות/יום = 240 קריאות/חודש
-- עלות: $0 (כלול ב-500,000 קריאות/חודש)
-- שימוש: רק 0.05% מהמגבלה החינמית!
-- מומלץ אם: אתה רוצה לחסוך קצת בקריאות (אבל עם 500K זה לא נחוץ)
--
-- SELECT cron.schedule(
--   'fear-greed-index-update',
--   '0 */3 * * *',  -- כל 3 שעות
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/fear-greed-update',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);

-- ====================================
-- אפשרות 3: כל 6 שעות
-- ====================================
-- 4 קריאות/יום = 120 קריאות/חודש
-- עלות: $0 (כלול ב-500,000 קריאות/חודש)
-- שימוש: רק 0.02% מהמגבלה החינמית!
-- מומלץ אם: אתה רוצה לחסוך בקריאות API (אבל עם 500K זה לא נחוץ)
--
-- SELECT cron.schedule(
--   'fear-greed-index-update',
--   '0 */6 * * *',  -- כל 6 שעות
--   $$
--   SELECT net.http_post(
--     url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/fear-greed-update',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb,
--     timeout_milliseconds := 30000
--   ) as request_id;
--   $$
-- );

-- ====================================
-- אפשרות 4: כל 12 שעות
-- ====================================
-- 2 קריאות/יום = 60 קריאות/חודש
-- עלות: $0 (כלול ב-500,000 קריאות/חודש)
-- שימוש: רק 0.01% מהמגבלה החינמית!
-- מומלץ אם: אתה רוצה לחסוך מקסימלית בקריאות (אבל עם 500K זה לא נחוץ)
--
-- SELECT cron.schedule(
--   'fear-greed-index-update',
--   '0 */12 * * *',  -- כל 12 שעות
--   $$
--   SELECT net.http_post(
--     url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/fear-greed-update',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb,
--     timeout_milliseconds := 30000
--   ) as request_id;
--   $$
-- );

-- ====================================
-- אפשרות 5: פעם ביום (08:00 UTC)
-- ====================================
-- 1 קריאה/יום = 30 קריאות/חודש
-- עלות: $0 (כלול ב-500,000 קריאות/חודש)
-- שימוש: רק 0.006% מהמגבלה החינמית!
-- מומלץ אם: המדד מתעדכן פעם ביום ואתה לא צריך יותר
--
-- SELECT cron.schedule(
--   'fear-greed-index-update',
--   '0 8 * * *',  -- כל יום ב-08:00 UTC
--   $$
--   SELECT net.http_post(
--     url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/fear-greed-update',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ',
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb,
--     timeout_milliseconds := 30000
--   ) as request_id;
--   $$
-- );

-- בדיקת Cron Job
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname = 'fear-greed-index-update';

-- הודעת הצלחה
DO $$
BEGIN
  RAISE NOTICE '✅ Cron Job fear-greed-index-update נוצר בהצלחה!';
  RAISE NOTICE '📅 תדירות: כל שעה (24 פעמים ביום)';
  RAISE NOTICE '💰 עלות: $0 (כלול ב-500,000 קריאות/חודש)';
  RAISE NOTICE '📊 שימוש: ~720 קריאות/חודש (רק 0.14% מהמגבלה!)';
  RAISE NOTICE '💡 עם 500K קריאות בחודש, אפשר להגדיר תדירות גבוהה יותר בלי דאגה!';
END $$;

