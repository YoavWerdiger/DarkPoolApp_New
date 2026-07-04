-- ============================================================================
-- 059_earnings_push_fix.sql
-- תיקון טריגר דיווחי רווח — vault במקום current_setting / מפתח קשיח
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.trigger_earnings_results_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  IF NEW.actual IS NOT NULL
     AND NEW.actual != 0
     AND (OLD.actual IS NULL OR OLD.actual = 0 OR OLD.actual IS DISTINCT FROM NEW.actual)
     AND NEW.importance >= 3
     AND NEW.code LIKE '%.US'
     AND NEW.report_date = CURRENT_DATE
  THEN
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS earnings_notification_trigger ON public.earnings_calendar;

CREATE TRIGGER earnings_notification_trigger
  AFTER UPDATE ON public.earnings_calendar
  FOR EACH ROW
  WHEN (
    (OLD.actual IS DISTINCT FROM NEW.actual)
    OR (OLD.revenue_actual IS DISTINCT FROM NEW.revenue_actual)
  )
  EXECUTE FUNCTION public.trigger_earnings_results_notification();
