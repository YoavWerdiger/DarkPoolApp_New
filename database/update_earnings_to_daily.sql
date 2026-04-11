-- ============================================
-- עדכון Earnings Sync לרוץ פעם ביום (חודש קדימה)
-- ============================================

-- מחיקת Cron Jobs ישנים (פעמיים ביום)
DO $$
BEGIN
  BEGIN
    PERFORM cron.unschedule('benzinga-earnings-sync-morning');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'benzinga-earnings-sync-morning not found, skipping...';
  END;
  
  BEGIN
    PERFORM cron.unschedule('benzinga-earnings-sync-evening');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'benzinga-earnings-sync-evening not found, skipping...';
  END;
END $$;

-- יצירת Cron Job חדש - פעם ביום (06:00 ישראל = 03:00 UTC)
-- שליפה לחודש קדימה (כבר שונה ב-function)
SELECT cron.schedule(
  'benzinga-earnings-sync-daily',
  '0 3 * * *', -- 06:00 ישראל
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-simple',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- בדיקה
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname LIKE '%earnings%'
ORDER BY jobname;

-- הודעה
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Earnings Sync עודכן!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Earnings Sync (Benzinga):';
  RAISE NOTICE '   - פעם ביום: 06:00 ישראל (03:00 UTC)';
  RAISE NOTICE '   - טווח: שבוע אחורה + חודש קדימה';
  RAISE NOTICE '';
  RAISE NOTICE '📡 WebSocket Stream:';
  RAISE NOTICE '   - מעדכן תוצאות אקטואליות בזמן אמת';
  RAISE NOTICE '   - צריך לרוץ ברקע (אולי דרך n8n או service אחר)';
  RAISE NOTICE '';
END $$;









