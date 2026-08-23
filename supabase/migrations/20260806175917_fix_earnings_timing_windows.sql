-- ============================================================================
-- fix_earnings_timing_windows
--
-- Root cause:
-- 1) earnings_date_time was hardcoded to 12:00Z (BMO) / 21:00Z (AMC).
--    12:00 UTC = 15:00 Israel (IDT) → "15 min before" push always at 14:45 IL.
-- 2) Live actuals sync only ran 15:30–17:00 + 22:30+ Israel — missing BMO morning.
--    Evening calendar sync at 15:00 UTC (= 18:00 Israel) then dumped all actuals at once.
--
-- Fix:
-- - Backfill earnings_date_time to ~07:00 / 16:05 America/New_York (DST-safe).
-- - Add mid-window sync crons for daily-earnings-sync-v2 during BMO + AMC.
-- ============================================================================

-- BMO ≈ 07:00 ET, AMC ≈ 16:05 ET (timestamp AT TIME ZONE handles DST)
UPDATE public.earnings_calendar
SET earnings_date_time = CASE
  WHEN before_after_market = 'BeforeMarket' THEN
    ((report_date::text || ' 07:00:00')::timestamp AT TIME ZONE 'America/New_York')
  ELSE
    ((report_date::text || ' 16:05:00')::timestamp AT TIME ZONE 'America/New_York')
END
WHERE code LIKE '%.US'
  AND report_date >= CURRENT_DATE - INTERVAL '14 days'
  AND (
    earnings_date_time IS NULL
    OR earnings_date_time = ((report_date::text || ' 12:00:00')::timestamp AT TIME ZONE 'UTC')
    OR earnings_date_time = ((report_date::text || ' 21:00:00')::timestamp AT TIME ZONE 'UTC')
  );

CREATE OR REPLACE FUNCTION public.invoke_daily_earnings_sync_v2()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'invoke_daily_earnings_sync_v2: missing vault secrets';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/daily-earnings-sync-v2',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- BMO window: every 15 min, 10:00–13:45 UTC
--   ≈ 13:00–16:45 Israel (summer) / 12:00–15:45 (winter) — covers ~07:00 ET
DO $$
BEGIN
  PERFORM cron.unschedule('earnings-sync-bmo-window');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'earnings-sync-bmo-window',
  '*/15 10-13 * * 1-5',
  $$SELECT public.invoke_daily_earnings_sync_v2();$$
);

-- AMC window: every 15 min, 19:00–21:45 UTC
--   ≈ 22:00–00:45 Israel (summer) / 21:00–23:45 (winter) — covers ~16:05 ET
DO $$
BEGIN
  PERFORM cron.unschedule('earnings-sync-amc-window');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'earnings-sync-amc-window',
  '*/15 19-21 * * 1-5',
  $$SELECT public.invoke_daily_earnings_sync_v2();$$
);

-- Keep evening full sync, but also ensure morning stays (already exist as benzinga-*).
-- Live actuals cron already every 10 min; windows are enforced inside the edge function.
