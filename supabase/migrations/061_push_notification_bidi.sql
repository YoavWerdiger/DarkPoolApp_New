-- ============================================================================
-- 061_push_notification_bidi.sql
-- BiDi להתראות: עטיפת קטעים לטיניים ב-LRI (U+2066) לתצוגה נכונה ב-RTL
-- ============================================================================

CREATE OR REPLACE FUNCTION public.push_notification_ltr(fragment TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN fragment IS NULL OR btrim(fragment) = '' THEN ''
    ELSE U&'\2066' || fragment || U&'\2069'
  END;
$$;

COMMENT ON FUNCTION public.push_notification_ltr IS
  'עוטף טקסט לטיני/מספרי ב-LRI ל-Push בעברית (RTL).';

-- יומן כלכלי — גוף עם BiDi
CREATE OR REPLACE FUNCTION public.send_economic_calendar_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  notification_title  TEXT;
  notification_body   TEXT;
  v_url               TEXT;
  v_key               TEXT;
  http_response_id    BIGINT;
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

  notification_title := 'פורסם דו"ח חדש!';
  notification_body :=
    'תוצאה: ' || public.push_notification_ltr(new_actual_text)
    || ' · צפי: ' || public.push_notification_ltr(forecast_text);

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
      'title',      NEW.title,
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

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NOT NULL AND v_key IS NOT NULL THEN
    SELECT net.http_post(
      url     := rtrim(v_url, '/') || '/functions/v1/process-pending-notifications',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_key
      ),
      body    := '{}'::jsonb
    ) INTO http_response_id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'send_economic_calendar_notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- עדכון טקסטי בדיקה ב-060 (אותו מבנה BiDi)
CREATE OR REPLACE FUNCTION public.test_earnings_upcoming_push(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  test_kind            TEXT,
  test_report_id       TEXT,
  users_targeted       BIGINT,
  pending_created      BIGINT,
  pending_sent         BIGINT,
  pending_still_waiting BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_report_id TEXT;
  v_title     TEXT;
  v_body      TEXT;
  v_now       TIMESTAMPTZ := NOW();
BEGIN
  v_report_id := 'test_push_upcoming_' || FLOOR(EXTRACT(EPOCH FROM v_now))::TEXT;
  v_title := public.push_notification_ltr('Apple Inc.') || ' מדווחת בקרוב!';
  v_body :=
    'דיווח לפני פתיחה · בעוד ' || public.push_notification_ltr('12') || ' דקות' || E'\n'
    || 'רווחיות (' || public.push_notification_ltr('EPS') || '): צפי ' || public.push_notification_ltr('$1.40') || E'\n'
    || 'הכנסות: צפי ' || public.push_notification_ltr('$94.50B');

  INSERT INTO public.pending_notifications (
    user_id, notification_type, title, body, data, is_sent
  )
  SELECT
    dt.user_id,
    'earnings',
    v_title,
    v_body,
    jsonb_build_object(
      'type', 'earnings',
      'earnings_report_id', v_report_id,
      'ticker', 'AAPL',
      'company_name', 'Apple Inc.',
      'code', 'AAPL.US',
      'report_date', CURRENT_DATE::TEXT,
      'before_after_market', 'BeforeMarket',
      'minutes_until', 12,
      'test', true
    ),
    false
  FROM public.device_tokens dt
  LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL
    AND (p_user_id IS NULL OR dt.user_id = p_user_id)
    AND COALESCE(uns.notifications_enabled, true)
    AND COALESCE(uns.earnings_notifications, true)
  ON CONFLICT DO NOTHING;

  PERFORM public._push_test_invoke_processor();
  PERFORM pg_sleep(2);

  RETURN QUERY
  SELECT
    'earnings_upcoming'::TEXT,
    v_report_id,
    t.users_targeted,
    s.created,
    s.sent,
    s.waiting
  FROM (
    SELECT COUNT(DISTINCT dt.user_id)::BIGINT AS users_targeted
    FROM public.device_tokens dt
    LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
    WHERE dt.is_active = true
      AND dt.user_id IS NOT NULL
      AND (p_user_id IS NULL OR dt.user_id = p_user_id)
      AND COALESCE(uns.notifications_enabled, true)
      AND COALESCE(uns.earnings_notifications, true)
  ) t,
  (
    SELECT
      COUNT(*)::BIGINT AS created,
      COUNT(*) FILTER (WHERE is_sent = true)::BIGINT AS sent,
      COUNT(*) FILTER (WHERE is_sent = false)::BIGINT AS waiting
    FROM public.pending_notifications
    WHERE notification_type = 'earnings'
      AND data->>'earnings_report_id' = v_report_id
      AND data->>'type' = 'earnings'
  ) s;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_earnings_results_push(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  test_kind            TEXT,
  test_report_id       TEXT,
  users_targeted       BIGINT,
  pending_created      BIGINT,
  pending_sent         BIGINT,
  pending_still_waiting BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_report_id TEXT;
  v_title     TEXT;
  v_body      TEXT;
  v_now       TIMESTAMPTZ := NOW();
BEGIN
  v_report_id := 'test_push_results_' || FLOOR(EXTRACT(EPOCH FROM v_now))::TEXT;
  v_title := public.push_notification_ltr('Apple Inc.') || ' פרסמה דוח רבעוני!';
  v_body :=
    'רווחיות (' || public.push_notification_ltr('EPS') || '): '
    || public.push_notification_ltr('$1.52') || ' · צפי ' || public.push_notification_ltr('$1.40')
    || ' · מעל הצפי ב-' || public.push_notification_ltr('8.6%') || E'\n'
    || 'הכנסות (' || public.push_notification_ltr('Revenue') || '): '
    || public.push_notification_ltr('$94.90B') || ' · צפי ' || public.push_notification_ltr('$94.50B')
    || ' · מעל הצפי ב-' || public.push_notification_ltr('0.4%');

  INSERT INTO public.pending_notifications (
    user_id, notification_type, title, body, data, is_sent
  )
  SELECT
    dt.user_id,
    'earnings',
    v_title,
    v_body,
    jsonb_build_object(
      'type', 'earnings_results',
      'earnings_report_id', v_report_id,
      'ticker', 'AAPL',
      'company_name', 'Apple Inc.',
      'code', 'AAPL.US',
      'report_date', CURRENT_DATE::TEXT,
      'actual', 1.52,
      'estimate', 1.40,
      'percent', 8.6,
      'test', true
    ),
    false
  FROM public.device_tokens dt
  LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL
    AND (p_user_id IS NULL OR dt.user_id = p_user_id)
    AND COALESCE(uns.notifications_enabled, true)
    AND COALESCE(uns.earnings_notifications, true)
  ON CONFLICT DO NOTHING;

  PERFORM public._push_test_invoke_processor();
  PERFORM pg_sleep(2);

  RETURN QUERY
  SELECT
    'earnings_results'::TEXT,
    v_report_id,
    t.users_targeted,
    s.created,
    s.sent,
    s.waiting
  FROM (
    SELECT COUNT(DISTINCT dt.user_id)::BIGINT AS users_targeted
    FROM public.device_tokens dt
    LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
    WHERE dt.is_active = true
      AND dt.user_id IS NOT NULL
      AND (p_user_id IS NULL OR dt.user_id = p_user_id)
      AND COALESCE(uns.notifications_enabled, true)
      AND COALESCE(uns.earnings_notifications, true)
  ) t,
  (
    SELECT
      COUNT(*)::BIGINT AS created,
      COUNT(*) FILTER (WHERE is_sent = true)::BIGINT AS sent,
      COUNT(*) FILTER (WHERE is_sent = false)::BIGINT AS waiting
    FROM public.pending_notifications
    WHERE notification_type = 'earnings'
      AND data->>'earnings_report_id' = v_report_id
      AND data->>'type' = 'earnings_results'
  ) s;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_economic_report_push(
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  test_kind            TEXT,
  test_event_id        TEXT,
  users_targeted       BIGINT,
  pending_created      BIGINT,
  pending_sent         BIGINT,
  pending_still_waiting BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_event_id TEXT;
  v_title    TEXT := 'פורסם דו"ח חדש!';
  v_body     TEXT;
  v_now      TIMESTAMPTZ := NOW();
BEGIN
  v_event_id := 'test_push_econ_' || FLOOR(EXTRACT(EPOCH FROM v_now))::TEXT;
  v_body :=
    'תוצאה: ' || public.push_notification_ltr('3.2%')
    || ' · צפי: ' || public.push_notification_ltr('3.1%');

  INSERT INTO public.pending_notifications (
    user_id, notification_type, title, body, data, article_id, is_sent
  )
  SELECT
    dt.user_id,
    'economic_calendar',
    v_title,
    v_body,
    jsonb_build_object(
      'type', 'economic_calendar',
      'eventId', v_event_id,
      'title', 'CPI — בדיקת Push',
      'actual', '3.2%',
      'forecast', '3.1%',
      'country', 'US',
      'importance', 'high',
      'date', CURRENT_DATE::TEXT,
      'test', true
    ),
    v_event_id,
    false
  FROM public.device_tokens dt
  LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL
    AND (p_user_id IS NULL OR dt.user_id = p_user_id)
    AND COALESCE(uns.notifications_enabled, true)
    AND COALESCE(uns.economic_calendar_notifications, true)
  ON CONFLICT DO NOTHING;

  PERFORM public._push_test_invoke_processor();
  PERFORM pg_sleep(2);

  RETURN QUERY
  SELECT
    'economic_report'::TEXT,
    v_event_id,
    t.users_targeted,
    s.created,
    s.sent,
    s.waiting
  FROM (
    SELECT COUNT(DISTINCT dt.user_id)::BIGINT AS users_targeted
    FROM public.device_tokens dt
    LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
    WHERE dt.is_active = true
      AND dt.user_id IS NOT NULL
      AND (p_user_id IS NULL OR dt.user_id = p_user_id)
      AND COALESCE(uns.notifications_enabled, true)
      AND COALESCE(uns.economic_calendar_notifications, true)
  ) t,
  (
    SELECT
      COUNT(*)::BIGINT AS created,
      COUNT(*) FILTER (WHERE is_sent = true)::BIGINT AS sent,
      COUNT(*) FILTER (WHERE is_sent = false)::BIGINT AS waiting
    FROM public.pending_notifications
    WHERE notification_type = 'economic_calendar'
      AND article_id = v_event_id
  ) s;
END;
$$;
