-- ========================================
-- עדכון Cron Job ל-daily-economic-sync-simple
-- ========================================
-- 
-- קובץ זה מעדכן את ה-Cron Job להשתמש בפונקציה המשופרת
-- עם תיקון תאריכים, שעות ופריסה נכונה לימים
--
-- הרץ קובץ זה ב-SQL Editor של Supabase
--

-- מחיקת Cron Jobs ישנים (רק אם קיימים - עם טיפול בשגיאות)
DO $$
BEGIN
  -- נסה למחוק cron jobs ישנים (יתעלם אם לא קיימים)
  BEGIN
    PERFORM cron.unschedule('daily-economic-sync');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'daily-economic-sync לא קיים - מדלגים';
  END;
  
  BEGIN
    PERFORM cron.unschedule('sync-economic-calendar');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'sync-economic-calendar לא קיים - מדלגים';
  END;
  
  -- אם יש cron job ישן עם שם זהה, נמחק אותו
  BEGIN
    PERFORM cron.unschedule('daily-economic-sync-simple');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'daily-economic-sync-simple לא קיים - יוצר חדש';
  END;
END $$;

-- ======================================
-- יצירת/עדכון Cron Job ל-daily-economic-sync-simple
-- ======================================

SELECT cron.schedule(
  'daily-economic-sync-simple',
  '0 6 * * *',  -- כל יום ב-06:00 UTC (= 09:00 ישראל בחורף, 08:00 בקיץ)
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-economic-sync-simple',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- ======================================
-- בדיקה - רשימת כל ה-Cron Jobs הפעילים
-- ======================================

SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname LIKE '%economic%'
ORDER BY jobname;


