-- ============================================================================
-- 028_broker_cron.sql
-- pg_cron schedule להרצת broker-colmex-sync כל 15 דקות.
--
-- חשוב: דורש שה-extension pg_cron + pg_net מותקנים. ב-Supabase Production
-- שניהם זמינים אבל לא מותקנים כברירת מחדל - הם נוספים פה.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- Helper: secrets ב-vault עבור הקריאה ל-Edge Function.
--   SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY חייבים להיות מוגדרים כ-secrets ב-vault.
--   ב-Supabase Studio: Settings → Vault → Add Secret.
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- Function: invoke_broker_colmex_sync
--   קוראת ל-Edge Function broker-colmex-sync דרך pg_net.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoke_broker_colmex_sync()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url     TEXT;
  v_key     TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'broker_colmex_sync: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in vault';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := v_url || '/functions/v1/broker-colmex-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_broker_colmex_sync() FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.invoke_broker_colmex_sync() TO service_role;

COMMENT ON FUNCTION public.invoke_broker_colmex_sync IS
  'Cron entry point — invokes Edge Function broker-colmex-sync. requires SUPABASE_URL + SERVICE_ROLE_KEY in vault.';

-- ----------------------------------------------------------------------------
-- Cron schedule: every 15 minutes
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'broker-colmex-sync-every-15-min') THEN
    PERFORM cron.unschedule('broker-colmex-sync-every-15-min');
  END IF;
END $$;

SELECT cron.schedule(
  'broker-colmex-sync-every-15-min',
  '*/15 * * * *',
  $$ SELECT public.invoke_broker_colmex_sync(); $$
);
