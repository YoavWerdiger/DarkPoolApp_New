-- ============================================================================
-- 064_push_notification_accumulation_fix.sql
-- מניעת הצטברות התראות:
--   1. נעילה (advisory lock) — ריצה אחת של process-pending-notifications בכל פעם
--   2. דוח כלכלי — רק ההתראה האחרונה למשתמש נשארת בתור (השאר מסומנות כנשלחו)
--   3. טריגר כלכלי — בלי http_post מיידי (cron כל דקה מרוקן את התור)
-- ============================================================================

-- נעילת מעבד התור — מונע שליחה כפולה מריצות מקבילות
CREATE OR REPLACE FUNCTION public.push_processor_try_lock()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN pg_try_advisory_lock(867530901);
END;
$$;

CREATE OR REPLACE FUNCTION public.push_processor_release_lock()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_unlock(867530901);
END;
$$;

GRANT EXECUTE ON FUNCTION public.push_processor_try_lock() TO service_role;
GRANT EXECUTE ON FUNCTION public.push_processor_release_lock() TO service_role;

-- משאיר רק דוח כלכלי אחד (האחרון) לכל משתמש בתור הפעיל
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
        PARTITION BY pn.user_id
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

GRANT EXECUTE ON FUNCTION public.skip_stale_economic_pending_notifications(INTEGER) TO service_role;

COMMENT ON FUNCTION public.skip_stale_economic_pending_notifications IS
  'מסמן כנשלחו דוחות כלכליים ישנים יותר בתור — נשאר רק האחרון למשתמש.';

-- דוח כלכלי: תור בלבד, בלי קריאה מקבילה ל-edge function מכל טריגר
CREATE OR REPLACE FUNCTION public.send_economic_calendar_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  notification_title  TEXT;
  notification_body   TEXT;
  event_title_bidi    TEXT;
  old_actual_text     TEXT;
  new_actual_text     TEXT;
  forecast_text       TEXT;
BEGIN
  old_actual_text := NULLIF(TRIM(COALESCE(OLD.actual::TEXT, '')), '');
  new_actual_text := NULLIF(TRIM(COALESCE(NEW.actual::TEXT, '')), '');

  IF old_actual_text IS NOT NULL OR new_actual_text IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.date < CURRENT_DATE - INTERVAL '1 day' OR NEW.date > CURRENT_DATE THEN
    RETURN NEW;
  END IF;

  forecast_text := COALESCE(NULLIF(TRIM(COALESCE(NEW.forecast::TEXT, '')), ''), '—');

  notification_title := public.push_notification_rtl('פורסם דו"ח חדש!');
  notification_body :=
    'תוצאה: ' || public.push_notification_ltr(new_actual_text)
    || ' · צפי: ' || public.push_notification_ltr(forecast_text);
  event_title_bidi := public.push_notification_rtl(LEFT(COALESCE(NEW.title, ''), 80));

  INSERT INTO public.pending_notifications (
    user_id, title, body, data, notification_type, article_id
  )
  SELECT DISTINCT
    dt.user_id,
    notification_title,
    notification_body,
    jsonb_build_object(
      'type',       'economic_calendar',
      'eventId',    NEW.id,
      'title',      event_title_bidi,
      'actual',     new_actual_text,
      'forecast',   forecast_text,
      'previous',   COALESCE(NEW.previous::TEXT, ''),
      'country',    NEW.country,
      'importance', NEW.importance,
      'date',       NEW.date::TEXT
    ),
    'economic_calendar',
    NEW.id::TEXT
  FROM public.device_tokens dt
  LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL
    AND COALESCE(uns.notifications_enabled, true)
    AND COALESCE(uns.economic_calendar_notifications, true)
    AND NOT EXISTS (
      SELECT 1
      FROM public.pending_notifications pn
      WHERE pn.user_id = dt.user_id
        AND pn.notification_type = 'economic_calendar'
        AND pn.article_id = NEW.id::TEXT
    );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'send_economic_calendar_notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- תור: כל דקה (במקום 2) — מספיק מהיר בלי הצפת edge functions
DO $$
BEGIN
  PERFORM cron.unschedule('process_pending_notifications');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'process_pending_notifications',
  '* * * * *',
  $$SELECT public.invoke_process_pending_notifications();$$
);
