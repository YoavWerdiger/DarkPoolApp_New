-- ============================================================================
-- 043_sync_congress_explore_cron.sql
-- סנכרון UW → DB כל 20/30 דקות (לא בכל כניסה למסך).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.invoke_sync_congress_trades()
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
    RAISE WARNING 'sync_congress: missing vault secrets';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := v_url || '/functions/v1/sync-congress-trades',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{"limit":60}'::jsonb,
    timeout_milliseconds := 180000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_sync_congress_trades() FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.invoke_sync_congress_trades() TO service_role;

CREATE OR REPLACE FUNCTION public.invoke_sync_uw_explore()
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
    RAISE WARNING 'sync_uw_explore: missing vault secrets';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := v_url || '/functions/v1/uw-explore',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{"force":true}'::jsonb,
    timeout_milliseconds := 300000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_sync_uw_explore() FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.invoke_sync_uw_explore() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-congress-trades-20m') THEN
    PERFORM cron.unschedule('sync-congress-trades-20m');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-uw-explore-30m') THEN
    PERFORM cron.unschedule('sync-uw-explore-30m');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-congress-trades-20m',
  '*/20 * * * *',
  $$ SELECT public.invoke_sync_congress_trades(); $$
);

SELECT cron.schedule(
  'sync-uw-explore-30m',
  '10,40 * * * *',
  $$ SELECT public.invoke_sync_uw_explore(); $$
);
