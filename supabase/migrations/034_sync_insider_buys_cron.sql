-- ============================================================================
-- 034_sync_insider_buys_cron.sql
-- pg_cron: sync-insider-buys כל שעה (Form 4 → dark_pool_insider_buys).
-- דורש vault: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (כמו 028/030).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_sync_insider_buys()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url        TEXT;
  v_key        TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'sync_insider_buys: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in vault';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := v_url || '/functions/v1/sync-insider-buys',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 120000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_sync_insider_buys() FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.invoke_sync_insider_buys() TO service_role;

COMMENT ON FUNCTION public.invoke_sync_insider_buys IS
  'Cron entry point – invokes Edge Function sync-insider-buys.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-insider-buys-hourly') THEN
    PERFORM cron.unschedule('sync-insider-buys-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-insider-buys-hourly',
  '0 * * * *',
  $$ SELECT public.invoke_sync_insider_buys(); $$
);
