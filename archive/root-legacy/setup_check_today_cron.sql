-- Cron Job לבדיקת תוצאות כלכליות של היום
-- הפונקציה תרוץ כל 15 דקות כדי לבדוק תוצאות חדשות

-- ביטול Cron Job קיים (אם קיים)
SELECT cron.unschedule('check-today-economic-results');

-- יצירת Cron Job חדש
SELECT cron.schedule(
  'check-today-economic-results',           -- שם ה-job
  '*/15 * * * *',                          -- כל 15 דקות
  $$
  SELECT
    net.http_post(
      url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/check-today-economic-results',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- בדיקה שה-Cron Job נוצר
SELECT 
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname = 'check-today-economic-results';

-- הודעת הצלחה
SELECT '✅ Cron Job נוצר בהצלחה! הפונקציה תרוץ כל 15 דקות' AS status;


