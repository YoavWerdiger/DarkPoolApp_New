-- ========================================
-- בדיקה סופית - כל ה-Cron Jobs
-- ========================================

SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname LIKE '%economic%'
ORDER BY jobname;

-- ======================================
-- מה אמור להיות:
-- ======================================
-- ✅ daily-economic-sync-simple (כל יום ב-06:00)
-- ✅ update-economic-results-live (כל 15 דקות) - זה החדש!
-- ✅ smart-economic-poller (כל שעתיים)
