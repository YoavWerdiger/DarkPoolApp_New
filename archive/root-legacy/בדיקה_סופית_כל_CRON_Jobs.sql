-- ========================================
-- בדיקה סופית - כל ה-Cron Jobs
-- ========================================

-- רשימת כל ה-Cron Jobs של Economic
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname LIKE '%economic%'
ORDER BY jobname;

-- ======================================
-- מה אמור להיות:
-- ======================================
-- 1. daily-economic-sync-simple ✅
--    - כל יום ב-06:00 UTC
--    - עדכון יומי של אירועים
--
-- 2. update-economic-results-live ✅
--    - כל 15 דקות
--    - עדכון בלייב + Push Notifications
--
-- 3. smart-economic-poller (אם יש)
--    - כל שעתיים
--    - בודק אירועים חשובים בקרוב


