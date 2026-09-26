-- sync-fund-13f-daily נעדר מ-cron.job; invoke השתמש ב-project_url (לא קיים) → no-op שקט.
-- Featured: Khanna/McCaul trades-only — לא ברoster המאוצר.

DROP FUNCTION IF EXISTS public.invoke_sync_fund_13f();

CREATE OR REPLACE FUNCTION public.invoke_sync_fund_13f()
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
    RAISE WARNING 'invoke_sync_fund_13f: missing vault secrets';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/sync-fund-13f',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('history_limit', 16),
    timeout_milliseconds := 600000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_sync_fund_13f() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_sync_fund_13f() TO service_role;

COMMENT ON FUNCTION public.invoke_sync_fund_13f IS
  'Cron: sync-fund-13f with history_limit=16 (~4y quarterly). Vault auth.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-fund-13f-daily') THEN
    PERFORM cron.unschedule('sync-fund-13f-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-fund-13f-daily',
  '0 6 * * *',
  $$ SELECT public.invoke_sync_fund_13f(); $$
);

UPDATE public.dark_pool_featured_profiles
SET is_active = FALSE
WHERE person_id IN ('K000389', 'M001157');

CREATE OR REPLACE FUNCTION public.invoke_sync_featured_profiles()
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
    RAISE WARNING 'invoke_sync_featured_profiles: missing vault secrets';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/sync-featured-profiles',
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

REVOKE EXECUTE ON FUNCTION public.invoke_sync_featured_profiles() FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_sync_featured_profiles() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-featured-profiles-daily') THEN
    PERFORM cron.unschedule('sync-featured-profiles-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'sync-featured-profiles-daily',
  '30 4 * * *',
  $$ SELECT public.invoke_sync_featured_profiles(); $$
);
