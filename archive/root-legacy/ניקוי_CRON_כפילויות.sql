-- ========================================
-- ניקוי Cron Jobs כפולים
-- ========================================
-- 
-- יש לך 2 Cron Jobs שעושים אותו דבר:
-- 1. daily-economic-sync (ישן - למחוק)
-- 2. daily-economic-sync-simple (חדש עם תיקונים - לשמור!)
--
-- קובץ זה מוחק את הישן ומשאיר רק את החדש
--

-- מחיקת Cron Job הישן
SELECT cron.unschedule('daily-economic-sync');

-- בדיקה - רשימת Cron Jobs שנשארו
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname LIKE '%economic%'
ORDER BY jobname;

-- ======================================
-- תוצאה צפויה:
-- ======================================
-- 1. daily-economic-sync-simple ✅ (נשאר - זה החדש עם התיקונים)
-- 2. smart-economic-poller ✅ (נשאר - זה משהו אחר)
-- 3. daily-economic-sync ❌ (נמחק - זה היה הישן)
