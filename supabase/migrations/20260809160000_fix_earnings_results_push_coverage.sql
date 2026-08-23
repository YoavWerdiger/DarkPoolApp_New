-- ============================================================================
-- Earnings results push coverage fix
-- Evidence (pending_notifications vs earnings_calendar actuals):
--   2026-08-03: 13 actual / 3 pushed
--   2026-08-04: 48 / 33
--   2026-08-05: 38 / 10
-- Root causes:
--   1) Trigger required report_date = CURRENT_DATE (UTC) — late/backfilled actuals skipped
--   2) Trigger was AFTER UPDATE only — INSERT with actual never notified
--   3) No sweep cron if pg_net → edge failed
--   4) SP500 BEFORE UPDATE filter could silently abort actual updates on ticker mismatch
-- ============================================================================

-- Allow updates on existing rows; only filter new inserts to S&P 500
CREATE OR REPLACE FUNCTION public.filter_earnings_sp500_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_constituents INTEGER;
  is_sp500 BOOLEAN;
  candidate_ticker TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO total_constituents FROM public.sp500_constituents;
  IF total_constituents = 0 THEN
    RETURN NEW;
  END IF;

  candidate_ticker := COALESCE(NEW.ticker, REPLACE(NEW.code, '.US', ''));

  SELECT EXISTS (
    SELECT 1 FROM public.sp500_constituents
    WHERE symbol = NEW.code
       OR ticker = candidate_ticker
  ) INTO is_sp500;

  IF is_sp500 THEN
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_earnings_results_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
  v_et_today DATE;
BEGIN
  IF NEW.actual IS NULL
     OR (NEW.importance IS NOT NULL AND NEW.importance < 3)
     OR NEW.code NOT LIKE '%.US'
  THEN
    RETURN NEW;
  END IF;

  -- רק מילוי/שינוי ראשון של actual (לא עדכון revenue בלבד)
  IF TG_OP = 'UPDATE'
     AND NOT (OLD.actual IS NULL OR OLD.actual IS DISTINCT FROM NEW.actual)
  THEN
    RETURN NEW;
  END IF;

  -- חלון יום מסחר ET: היום או אתמול (AMC אחרי חצות UTC / סנכרון מאוחר)
  v_et_today := (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date;
  IF NEW.report_date < v_et_today - 1 OR NEW.report_date > v_et_today THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NOT NULL AND v_key IS NOT NULL THEN
    PERFORM net.http_post(
      url     := rtrim(v_url, '/') || '/functions/v1/earnings-results-notifications',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body    := jsonb_build_object(
        'record', jsonb_build_object(
          'id', NEW.id,
          'code', NEW.code,
          'ticker', NEW.ticker,
          'company_name', NEW.company_name,
          'report_date', NEW.report_date,
          'actual', NEW.actual,
          'estimate', NEW.estimate,
          'percent', NEW.percent,
          'revenue_actual', NEW.revenue_actual,
          'revenue_estimate_avg', NEW.revenue_estimate_avg,
          'revenue_surprise_percent', NEW.revenue_surprise_percent,
          'before_after_market', NEW.before_after_market,
          'updated_at', NEW.updated_at
        )
      )
    );
  ELSE
    RAISE WARNING 'earnings trigger: missing vault secrets';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS earnings_notification_trigger ON public.earnings_calendar;

CREATE TRIGGER earnings_notification_trigger
  AFTER INSERT OR UPDATE OF actual, revenue_actual ON public.earnings_calendar
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_earnings_results_notification();

-- Sweep: תופס miss אם pg_net/edge נכשל אחרי הטריגר
CREATE OR REPLACE FUNCTION public.invoke_earnings_results_notifications()
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
    RAISE WARNING 'invoke_earnings_results_notifications: missing vault secrets';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/earnings-results-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invoke_earnings_results_notifications() TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('earnings_results_notifications_sweep');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'earnings_results_notifications_sweep',
  '*/10 * * * *',
  $$SELECT public.invoke_earnings_results_notifications();$$
);
