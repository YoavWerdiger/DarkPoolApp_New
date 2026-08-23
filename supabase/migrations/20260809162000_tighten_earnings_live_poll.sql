-- ============================================================================
-- Near-real-time earnings actuals: tighten live poll.
-- update-earnings-results-live already no-ops outside BMO/AMC windows and on
-- weekends (no Parse call), so a denser cron is safe for API quota.
-- Target: discover new actuals within ~3 minutes during release windows.
-- ============================================================================

DO $$
BEGIN
  PERFORM cron.unschedule('update_earnings_results_live');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'update_earnings_results_live',
  '*/3 * * * *',
  $$SELECT public.invoke_update_earnings_results_live();$$
);

DO $$
BEGIN
  PERFORM cron.unschedule('earnings_results_notifications_sweep');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'earnings_results_notifications_sweep',
  '*/3 * * * *',
  $$SELECT public.invoke_earnings_results_notifications();$$
);

-- Fallback sync during BMO/AMC: every 10m (was 15m) if live path misses
DO $$
BEGIN
  PERFORM cron.unschedule('earnings-sync-bmo-window');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'earnings-sync-bmo-window',
  '*/10 10-13 * * 1-5',
  $$SELECT public.invoke_daily_earnings_sync_v2();$$
);

DO $$
BEGIN
  PERFORM cron.unschedule('earnings-sync-amc-window');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'earnings-sync-amc-window',
  '*/10 19-21 * * 1-5',
  $$SELECT public.invoke_daily_earnings_sync_v2();$$
);
