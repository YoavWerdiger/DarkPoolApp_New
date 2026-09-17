-- ============================================================================
-- Daily Quiver politicians + curated holdings cache (Trader tier).
-- Avoids hitting /beta/bulk/congress/politicians on every explore request.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.invoke_sync_quiver_congress_cache()
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
    RAISE WARNING 'sync_quiver_congress_cache: missing vault secrets';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := v_url || '/functions/v1/sync-quiver-congress-cache',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 300000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_sync_quiver_congress_cache() FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.invoke_sync_quiver_congress_cache() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-quiver-congress-cache-daily') THEN
    PERFORM cron.unschedule('sync-quiver-congress-cache-daily');
  END IF;
END $$;

-- 06:15 UTC daily
SELECT cron.schedule(
  'sync-quiver-congress-cache-daily',
  '15 6 * * *',
  $$ SELECT public.invoke_sync_quiver_congress_cache(); $$
);
