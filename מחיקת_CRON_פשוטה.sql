-- ========================================
-- מחיקת Cron Job ישן - פשוט וקל!
-- ========================================

-- מחק את daily-economic-sync הישן (בלי התיקונים)
SELECT cron.unschedule('daily-economic-sync');

-- בדיקה - מה נשאר?
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
-- ✅ daily-economic-sync-simple (נשאר - החדש עם התיקונים!)
-- ✅ smart-economic-poller (נשאר)
-- ❌ daily-economic-sync (נמחק)


