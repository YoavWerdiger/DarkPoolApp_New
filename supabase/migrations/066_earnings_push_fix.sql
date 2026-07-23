-- ============================================================================
-- 066_earnings_push_fix.sql
-- דיווחי רווח: backfill importance/earnings_date_time + cron עם vault + טריגר
-- ============================================================================

-- שדות חסרים ב-daily-earnings-sync-v2 גרמו לסינון 0 דיווחים (importance NULL, earnings_date_time NULL)
UPDATE public.earnings_calendar
SET importance = COALESCE(importance, 3)
WHERE code LIKE '%.US'
  AND importance IS NULL;

UPDATE public.earnings_calendar
SET earnings_date_time = CASE
  WHEN before_after_market = 'BeforeMarket' THEN
    ((report_date::text || ' 12:00:00')::timestamp AT TIME ZONE 'UTC')
  ELSE
    ((report_date::text || ' 21:00:00')::timestamp AT TIME ZONE 'UTC')
END
WHERE code LIKE '%.US'
  AND earnings_date_time IS NULL
  AND report_date >= CURRENT_DATE - INTERVAL '90 days';

-- Cron helpers — vault במקום current_setting (שבroken בפרודקשן)
CREATE OR REPLACE FUNCTION public.invoke_earnings_notifications()
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
    RAISE WARNING 'invoke_earnings_notifications: missing vault secrets';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/earnings-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoke_update_earnings_results_live()
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
    RAISE WARNING 'invoke_update_earnings_results_live: missing vault secrets';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/update-earnings-results-live',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('earnings_notifications_upcoming');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'earnings_notifications_upcoming',
  '*/5 * * * *',
  $$SELECT public.invoke_earnings_notifications();$$
);

DO $$
BEGIN
  PERFORM cron.unschedule('update_earnings_results_live');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'update_earnings_results_live',
  '*/10 * * * *',
  $$SELECT public.invoke_update_earnings_results_live();$$
);

-- טריגר תוצאות — גם importance NULL (נתונים ישנים / sync-v2)
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
     AND (NEW.importance IS NULL OR NEW.importance >= 3)
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
