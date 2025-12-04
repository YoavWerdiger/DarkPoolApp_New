-- ========================================
-- הגדרת Cron Job לעדכוני בלייב עם Push
-- ========================================
-- 
-- זה יוצר Cron Job שבודק תוצאות כל 15 דקות
-- ושולח Push Notifications על אירועים חשובים
--
-- הרץ קובץ זה ב-SQL Editor של Supabase
--

-- יצירת Cron Job לעדכון תוצאות בלייב
SELECT cron.schedule(
  'update-economic-results-live',
  '*/15 * * * *',  -- כל 15 דקות
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/update-economic-results',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ======================================
-- בדיקה - רשימת כל ה-Cron Jobs
-- ======================================

SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname LIKE '%economic%'
ORDER BY jobname;

-- ======================================
-- הערות:
-- ======================================
-- 
-- תדירויות אפשריות:
-- - כל 15 דקות: '*/15 * * * *' (מומלץ!)
-- - כל 30 דקות: '*/30 * * * *'
-- - כל שעה: '0 * * * *'
-- - כל 5 דקות: '*/5 * * * *' (מהיר מאוד)
--
-- המערכת תבדוק תוצאות ב-7 ימים האחרונים
-- ותשלח Push Notifications רק על אירועים חשובים


