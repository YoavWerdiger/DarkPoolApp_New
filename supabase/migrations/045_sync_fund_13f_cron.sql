-- Cron: sync-fund-13f פעם ביום (06:00 UTC)

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_sync_fund_13f()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE NOTICE 'sync-fund-13f cron: missing vault secrets';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/sync-fund-13f',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  );
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-fund-13f-daily') THEN
    PERFORM cron.unschedule('sync-fund-13f-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-fund-13f-daily',
  '0 6 * * *',
  $$SELECT public.invoke_sync_fund_13f();$$
);
