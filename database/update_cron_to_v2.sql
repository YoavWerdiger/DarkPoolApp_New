
-- Update Cron Jobs to use the new daily-earnings-sync-v2 function

DO $$
BEGIN

  -- 1. Morning Sync
  PERFORM cron.schedule(
    'benzinga-earnings-sync-morning',
    '0 3 * * *',
    $sql$
    SELECT net.http_post(
      url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-v2',
      headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
    $sql$
  );

  -- 2. Evening Sync
  PERFORM cron.schedule(
    'benzinga-earnings-sync-evening',
    '0 15 * * *',
    $sql$
    SELECT net.http_post(
      url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/daily-earnings-sync-v2',
      headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyMDczNTEsImV4cCI6MjA2Njc4MzM1MX0.YHfniy3w94LVODC54xb7Us-Daw_pRx2WWFOoR-59kGQ", "Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
    $sql$
  );

  RAISE NOTICE '✅ Updated cron jobs to use daily-earnings-sync-v2';

END $$;





