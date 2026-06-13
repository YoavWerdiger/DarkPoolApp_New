-- ============================================================================
-- 037_uw_darkpool_cron.sql
-- Cron ל-sync-darkpool עם Unusual Whales (DARK_POOL_PROVIDER=unusualwhales).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.invoke_sync_darkpool()
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
    RAISE WARNING 'sync_darkpool: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in vault';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := v_url || '/functions/v1/sync-darkpool',
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

REVOKE EXECUTE ON FUNCTION public.invoke_sync_darkpool() FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.invoke_sync_darkpool() TO service_role;

COMMENT ON FUNCTION public.invoke_sync_darkpool IS
  'Cron entry point – invokes Edge Function sync-darkpool (UW/Polygon/Intrinio).';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-darkpool-5m') THEN
    PERFORM cron.unschedule('sync-darkpool-5m');
  END IF;
END $$;

-- כל 5 דקות (הפעל רק אחרי: DARK_POOL_PROVIDER=unusualwhales + deploy sync-darkpool)
SELECT cron.schedule(
  'sync-darkpool-5m',
  '*/5 * * * *',
  $$ SELECT public.invoke_sync_darkpool(); $$
);
