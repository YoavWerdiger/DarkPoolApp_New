-- ============================================================================
-- Fix: economic calendar push kept only the latest pending row per user.
-- When several actuals landed in the same minute, the rest were marked is_sent
-- without ever being delivered to Expo — so users missed most results.
--
-- New rule: dedupe only true duplicates of the same event (article_id / eventId).
-- Also allow earnings EPS actual = 0 to trigger results push.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.skip_stale_economic_pending_notifications(
  p_max_age_hours INTEGER DEFAULT 2
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_skipped BIGINT;
BEGIN
  WITH ranked AS (
    SELECT
      pn.id,
      ROW_NUMBER() OVER (
        PARTITION BY
          pn.user_id,
          COALESCE(NULLIF(pn.article_id, ''), pn.data->>'eventId', pn.id::text)
        ORDER BY pn.created_at DESC
      ) AS rn
    FROM public.pending_notifications pn
    WHERE pn.is_sent = false
      AND pn.notification_type = 'economic_calendar'
      AND pn.created_at >= NOW() - make_interval(hours => p_max_age_hours)
  ),
  stale AS (
    SELECT id FROM ranked WHERE rn > 1
  )
  UPDATE public.pending_notifications pn
  SET
    is_sent = true,
    sent_at = NOW()
  FROM stale s
  WHERE pn.id = s.id;

  GET DIAGNOSTICS v_skipped = ROW_COUNT;
  RETURN v_skipped;
END;
$$;

COMMENT ON FUNCTION public.skip_stale_economic_pending_notifications IS
  'מסמן כנשלחו רק כפילויות של אותו אירוע כלכלי (אותו article_id/eventId) — לא מוחק תוצאות שונות.';

-- EPS בפועל יכול להיות 0; עדיין צריך להודיע על פרסום הדוח
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
     AND (OLD.actual IS NULL OR OLD.actual IS DISTINCT FROM NEW.actual)
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
