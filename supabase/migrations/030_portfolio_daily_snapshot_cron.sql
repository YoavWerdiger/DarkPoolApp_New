-- ============================================================================
-- 030_portfolio_daily_snapshot_cron.sql
-- pg_cron schedule להרצת portfolio-daily-snapshot פעם ביום (23:00 UTC).
--
-- ה-Edge Function מחשבת snapshot יומי לכל תיק (total_value, cash, invested,
-- unrealized, realized) ומכניסה ל-public.portfolio_value_history.
--
-- חשוב: דורש שה-extensions pg_cron + pg_net מותקנים (כבר מותקנים מ-028)
-- ושכמה secrets קיימים ב-vault:
--   - SUPABASE_URL
--   - SUPABASE_SERVICE_ROLE_KEY
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- Function: invoke_portfolio_daily_snapshot
--   קוראת ל-Edge Function portfolio-daily-snapshot דרך pg_net.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoke_portfolio_daily_snapshot()
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
    RAISE WARNING 'portfolio_daily_snapshot: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in vault';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := v_url || '/functions/v1/portfolio-daily-snapshot',
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

REVOKE EXECUTE ON FUNCTION public.invoke_portfolio_daily_snapshot() FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.invoke_portfolio_daily_snapshot() TO service_role;

COMMENT ON FUNCTION public.invoke_portfolio_daily_snapshot IS
  'Cron entry point – invokes Edge Function portfolio-daily-snapshot. requires SUPABASE_URL + SERVICE_ROLE_KEY in vault.';

-- ----------------------------------------------------------------------------
-- Helper: backfill ידני (מורץ פעם אחת אחרי deploy כדי למלא היסטוריה).
--   קריאה: SELECT public.invoke_portfolio_daily_snapshot_backfill(180);
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoke_portfolio_daily_snapshot_backfill(
  p_days INT DEFAULT 90
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url        TEXT;
  v_key        TEXT;
  v_request_id BIGINT;
  v_days       INT := GREATEST(0, LEAST(p_days, 730));
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'portfolio_daily_snapshot_backfill: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in vault';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := v_url || '/functions/v1/portfolio-daily-snapshot',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('backfill_days', v_days),
    timeout_milliseconds := 300000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.invoke_portfolio_daily_snapshot_backfill(INT) FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.invoke_portfolio_daily_snapshot_backfill(INT) TO service_role;

COMMENT ON FUNCTION public.invoke_portfolio_daily_snapshot_backfill IS
  'Manual backfill of portfolio_value_history. Usage: SELECT public.invoke_portfolio_daily_snapshot_backfill(180);';

-- ----------------------------------------------------------------------------
-- Cron schedule: כל יום ב-23:00 UTC (אחרי שכל הבורסות נסגרו ומחירי close יציבים).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'portfolio-daily-snapshot') THEN
    PERFORM cron.unschedule('portfolio-daily-snapshot');
  END IF;
END $$;

SELECT cron.schedule(
  'portfolio-daily-snapshot',
  '0 23 * * *',
  $$ SELECT public.invoke_portfolio_daily_snapshot(); $$
);
