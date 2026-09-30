-- היקף התראות: הכול, או רק מה שהמשתמש בחר.
-- מי שהקטגוריה אצלו כבויה לא מקבל ברירת מחדל של «הכול».

ALTER TABLE public.user_notification_settings
  ADD COLUMN IF NOT EXISTS earnings_alert_scope text,
  ADD COLUMN IF NOT EXISTS earnings_alert_symbols text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS economic_alert_scope text,
  ADD COLUMN IF NOT EXISTS economic_alert_indicators text[] NOT NULL DEFAULT '{}';

UPDATE public.user_notification_settings
SET earnings_alert_scope = CASE
  WHEN earnings_notifications IS FALSE THEN 'selected'
  ELSE 'all'
END
WHERE earnings_alert_scope IS NULL;

UPDATE public.user_notification_settings
SET economic_alert_scope = CASE
  WHEN economic_calendar_notifications IS FALSE THEN 'selected'
  ELSE 'all'
END
WHERE economic_alert_scope IS NULL;

ALTER TABLE public.user_notification_settings
  ALTER COLUMN earnings_alert_scope SET DEFAULT 'all',
  ALTER COLUMN economic_alert_scope SET DEFAULT 'all';

UPDATE public.user_notification_settings
SET earnings_alert_scope = 'all'
WHERE earnings_alert_scope IS NULL;

UPDATE public.user_notification_settings
SET economic_alert_scope = 'all'
WHERE economic_alert_scope IS NULL;

ALTER TABLE public.user_notification_settings
  ALTER COLUMN earnings_alert_scope SET NOT NULL,
  ALTER COLUMN economic_alert_scope SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_notification_settings_earnings_alert_scope_chk'
  ) THEN
    ALTER TABLE public.user_notification_settings
      ADD CONSTRAINT user_notification_settings_earnings_alert_scope_chk
      CHECK (earnings_alert_scope IN ('all', 'selected'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_notification_settings_economic_alert_scope_chk'
  ) THEN
    ALTER TABLE public.user_notification_settings
      ADD CONSTRAINT user_notification_settings_economic_alert_scope_chk
      CHECK (economic_alert_scope IN ('all', 'selected'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.economic_event_matches_alert_keys(p_title text, p_keys text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_keys, ARRAY[]::text[])) AS k
    WHERE CASE lower(btrim(k))
      WHEN 'cpi' THEN p_title ILIKE '%cpi%' OR p_title ILIKE '%consumer price%' OR p_title ILIKE '%מדד המחירים לצרכן%'
      WHEN 'pce' THEN p_title ILIKE '%pce%' OR p_title ILIKE '%personal consumption%' OR p_title ILIKE '%מדד מחירי הצריכה%'
      WHEN 'nfp' THEN p_title ILIKE '%nonfarm%' OR p_title ILIKE '%non-farm%' OR p_title ILIKE '%nfp%' OR p_title ILIKE '%תעסוקה%'
      WHEN 'fomc' THEN p_title ILIKE '%fomc%' OR p_title ILIKE '%fed funds%' OR p_title ILIKE '%federal funds%' OR p_title ILIKE '%ריבית הפד%'
      WHEN 'gdp' THEN p_title ILIKE '%gdp%' OR p_title ILIKE '%gross domestic%' OR p_title ILIKE '%תוצר%'
      WHEN 'claims' THEN p_title ILIKE '%jobless%' OR p_title ILIKE '%initial claims%' OR p_title ILIKE '%תביעות אבטלה%'
      WHEN 'ism' THEN p_title ILIKE '%ism%' OR p_title ILIKE '%מנהלי הרכש%'
      WHEN 'retail' THEN p_title ILIKE '%retail sales%' OR p_title ILIKE '%מכירות קמעונ%'
      ELSE false
    END
  );
$$;

-- שומר את תצוגת האחוז הסלקטיבית שכבר חיה בפרודקשן, ומוסיף סינון לפי הבחירה.
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
  actual_display      TEXT;
  forecast_display    TEXT;
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

  new_actual_text := NULLIF(TRIM(regexp_replace(new_actual_text, '[%٪]', '', 'g')), '');
  IF new_actual_text IS NULL THEN
    RETURN NEW;
  END IF;

  forecast_text := COALESCE(NULLIF(TRIM(regexp_replace(COALESCE(NEW.forecast::TEXT, ''), '[%٪]', '', 'g')), ''), '—');

  actual_display := public.economic_display_value_for_push(NEW.title, new_actual_text);
  forecast_display := COALESCE(public.economic_display_value_for_push(NEW.title, NULLIF(forecast_text, '—')), '—');

  notification_title := public.push_notification_rtl('פורסם דו"ח חדש!');
  notification_body :=
    'תוצאה: ' || public.push_notification_ltr(actual_display)
    || ' · צפי: ' || public.push_notification_ltr(forecast_display);
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
      'previous',   COALESCE(regexp_replace(COALESCE(NEW.previous::TEXT, ''), '[%٪]', '', 'g'), ''),
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
    AND (
      COALESCE(uns.economic_alert_scope, 'all') IS DISTINCT FROM 'selected'
      OR public.economic_event_matches_alert_keys(
        COALESCE(NEW.title, ''),
        COALESCE(uns.economic_alert_indicators, ARRAY[]::text[])
      )
    )
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
