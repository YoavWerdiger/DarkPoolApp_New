-- ============================================================================
-- deepen_global_trade_history
-- מגדיל עומק סנכרון גלובלי של עסקאות (קונגרס + 13F) בלי מנויים חדשים.
-- Congress: cron limit 60 → 200 (אותה קריאת Quiver/UW, יותר שורות ל-DB).
-- Fund 13F: history_limit 12 → 16 רבעונים (~4 שנים).
-- ============================================================================

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
    -- 200: תואם ברירת מחדל של ה-edge; Quiver live = קריאה אחת, לא מכפיל מכסה
    body    := '{"limit":200,"deep":true}'::jsonb,
    timeout_milliseconds := 180000
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

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
    body    := '{"history_limit":16}'::jsonb
  );
END;
$$;

COMMENT ON FUNCTION public.invoke_sync_congress_trades IS
  'Cron: sync-congress-trades with limit=200 + deep curated history.';

COMMENT ON FUNCTION public.invoke_sync_fund_13f IS
  'Cron: sync-fund-13f with history_limit=16 (~4y quarterly).';
