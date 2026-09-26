-- Strip % from economic calendar push body + data payload so push matches UI (decimal without %).
CREATE OR REPLACE FUNCTION public.send_economic_calendar_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $function$
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

  IF NEW.importance IS NULL OR NEW.importance NOT IN ('high', 'medium') THEN
    RETURN NEW;
  END IF;

  -- תצוגה בלי '%' (גם אם הגיע במחרוזת מהספק)
  new_actual_text := NULLIF(TRIM(regexp_replace(new_actual_text, '[%٪]', '', 'g')), '');
  IF new_actual_text IS NULL THEN
    RETURN NEW;
  END IF;

  forecast_text := COALESCE(NULLIF(TRIM(COALESCE(NEW.forecast::TEXT, '')), ''), '—');
  forecast_text := NULLIF(TRIM(regexp_replace(forecast_text, '[%٪]', '', 'g')), '');
  forecast_text := COALESCE(forecast_text, '—');

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
      'previous',   COALESCE(regexp_replace(NEW.previous::TEXT, '[%٪]', '', 'g'), ''),
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
$function$;
