-- עדכון Cron Job לשימוש ב-Function הפשוט

-- מחיקת Cron ישן
SELECT cron.unschedule('daily-economic-sync');

-- יצירת Cron חדש עם Function הפשוט
SELECT cron.schedule(
  'daily-economic-sync-simple',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-economic-sync-simple',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- בדיקה
SELECT jobname, schedule, active FROM cron.job;

