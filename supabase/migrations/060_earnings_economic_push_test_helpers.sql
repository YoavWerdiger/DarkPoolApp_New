-- ============================================================================
-- 060_earnings_economic_push_test_helpers.sql
-- בדיקת Push: דיווח רווח (לפני) | תוצאות רווח (אחרי) | דוח כלכלי
--
-- אחרי הרצת המיגרציה, ב-SQL Editor (service_role):
--
--   SELECT * FROM public.push_notifications_test_diagnostics();
--
--   -- שליחה למכשיר ספציפי (מומלץ):
--   SELECT * FROM public.test_earnings_upcoming_push('YOUR-USER-UUID'::uuid);
--   SELECT * FROM public.test_earnings_results_push('YOUR-USER-UUID'::uuid);
--   SELECT * FROM public.test_economic_report_push('YOUR-USER-UUID'::uuid);
--
--   -- שליחה לכל המשתמשים עם טוקן פעיל + התראות מופעלות:
--   SELECT * FROM public.test_earnings_upcoming_push();
--
-- בדיקת pipeline מלא (טריגר / Edge Function):
--   SELECT * FROM public.test_earnings_upcoming_pipeline();
--   SELECT * FROM public.test_earnings_results_pipeline();
--   SELECT * FROM public.test_economic_report_pipeline();
--
-- Build לאפליקציה: לא נדרש לטקסט/טריגרים — כן אם עדיין לא ב-build:
--   ערוצי Android, ניווט בלחיצה (NewsEarnings / NewsCalendar).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- עזר: קריאה ל-process-pending-notifications
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._push_test_invoke_processor()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
  v_req BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'push test: missing vault secrets — rows stay in pending_notifications';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/process-pending-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  ) INTO v_req;

  RETURN v_req;
END;
$$;

-- ---------------------------------------------------------------------------
-- אבחון
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.push_notifications_test_diagnostics()
RETURNS TABLE (check_name TEXT, detail TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earnings_trigger INT;
  v_economic_trigger INT;
  v_active_tokens    INT;
  v_pending_earnings INT;
  v_pending_economic INT;
  v_vault_url        BOOLEAN;
  v_vault_key        BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_earnings_trigger
  FROM information_schema.triggers
  WHERE event_object_schema = 'public'
    AND event_object_table = 'earnings_calendar'
    AND trigger_name = 'earnings_notification_trigger';

  SELECT COUNT(*) INTO v_economic_trigger
  FROM information_schema.triggers
  WHERE event_object_schema = 'public'
    AND event_object_table = 'economic_events'
    AND trigger_name = 'on_economic_event_result';

  SELECT COUNT(*) INTO v_active_tokens
  FROM public.device_tokens
  WHERE is_active = true AND user_id IS NOT NULL;

  SELECT COUNT(*) INTO v_pending_earnings
  FROM public.pending_notifications
  WHERE notification_type = 'earnings' AND is_sent = false;

  SELECT COUNT(*) INTO v_pending_economic
  FROM public.pending_notifications
  WHERE notification_type = 'economic_calendar' AND is_sent = false;

  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1
  ) INTO v_vault_url;

  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1
  ) INTO v_vault_key;

  RETURN QUERY SELECT 'earnings_results_trigger'::TEXT,
    CASE WHEN v_earnings_trigger > 0 THEN '✅ קיים' ELSE '❌ חסר' END;
  RETURN QUERY SELECT 'economic_report_trigger'::TEXT,
    CASE WHEN v_economic_trigger > 0 THEN '✅ קיים' ELSE '❌ חסר' END;
  RETURN QUERY SELECT 'active_device_tokens'::TEXT,
    v_active_tokens::TEXT || ' טוקנים פעילים';
  RETURN QUERY SELECT 'pending_earnings_queue'::TEXT,
    v_pending_earnings::TEXT || ' ממתינות';
  RETURN QUERY SELECT 'pending_economic_queue'::TEXT,
    v_pending_economic::TEXT || ' ממתינות';
  RETURN QUERY SELECT 'vault_SUPABASE_URL'::TEXT,
    CASE WHEN v_vault_url THEN '✅ קיים' ELSE '❌ חסר' END;
  RETURN QUERY SELECT 'vault_SERVICE_ROLE_KEY'::TEXT,
    CASE WHEN v_vault_key THEN '✅ קיים' ELSE '❌ חסר' END;
  RETURN QUERY SELECT 'app_build_required'::TEXT,
    'לא לטקסט Push | כן לערוצי Android + ניווט בלחיצה אם לא ב-build 195+';
END;
$$;

-- ---------------------------------------------------------------------------
-- 1) דיווח רווח מתקרב — מבנה זהה ל-earnings-notifications
-- ---------------------------------------------------------------------------
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
  v_title     TEXT := 'Apple Inc. מדווחת בקרוב!';
  v_body      TEXT;
  v_now       TIMESTAMPTZ := NOW();
BEGIN
  v_report_id := 'test_push_upcoming_' || FLOOR(EXTRACT(EPOCH FROM v_now))::TEXT;
  v_body := E'דיווח לפני פתיחה בעוד 12 דקות\nEPS: צפי $1.40\nהכנסות: צפי $94.50B';

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

-- ---------------------------------------------------------------------------
-- 2) תוצאות דיווח רווח — מבנה זהה ל-earnings-results-notifications
-- ---------------------------------------------------------------------------
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
  v_title     TEXT := 'Apple Inc. פרסמה דוח רבעוני!';
  v_body      TEXT;
  v_now       TIMESTAMPTZ := NOW();
BEGIN
  v_report_id := 'test_push_results_' || FLOOR(EXTRACT(EPOCH FROM v_now))::TEXT;
  v_body := E'EPS: $1.52 · צפי $1.40 · מעל הצפי 8.6%\nהכנסות: $94.90B · צפי $94.50B · מעל הצפי 0.4%';

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

-- ---------------------------------------------------------------------------
-- 3) דוח כלכלי — מבנה זהה ל-send_economic_calendar_notification (058)
-- ---------------------------------------------------------------------------
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
  v_body     TEXT := 'תוצאה: 3.2% | צפי: 3.1%';
  v_now      TIMESTAMPTZ := NOW();
BEGIN
  v_event_id := 'test_push_econ_' || FLOOR(EXTRACT(EPOCH FROM v_now))::TEXT;

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

-- ---------------------------------------------------------------------------
-- Pipeline: דיווח קרוב דרך Edge Function + שורת בדיקה ב-earnings_calendar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.test_earnings_upcoming_pipeline()
RETURNS TABLE (step TEXT, detail TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_id  TEXT;
  v_url TEXT;
  v_key TEXT;
  v_req BIGINT;
BEGIN
  v_id := 'test_pipeline_upcoming_' || FLOOR(EXTRACT(EPOCH FROM NOW()))::TEXT;

  INSERT INTO public.earnings_calendar (
    id, code, ticker, company_name, report_date, date,
    before_after_market, actual, estimate, importance,
    earnings_date_time, updated_at, source
  ) VALUES (
    v_id, 'AAPL.US', 'AAPL', 'Apple Inc.', CURRENT_DATE, CURRENT_DATE,
    'BeforeMarket', NULL, 1.40, 5,
    NOW() + INTERVAL '12 minutes', NOW(), 'push_test'
  )
  ON CONFLICT (id) DO UPDATE SET
    actual = NULL,
    earnings_date_time = NOW() + INTERVAL '12 minutes',
    updated_at = NOW();

  RETURN QUERY SELECT 'earnings_row'::TEXT, '✅ ' || v_id;

  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RETURN QUERY SELECT 'edge_function'::TEXT, '❌ חסר vault';
    RETURN;
  END IF;

  SELECT net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/earnings-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  ) INTO v_req;

  RETURN QUERY SELECT 'edge_function'::TEXT, 'earnings-notifications req=' || COALESCE(v_req::TEXT, 'null');
  PERFORM pg_sleep(3);
  PERFORM public._push_test_invoke_processor();
  RETURN QUERY SELECT 'processor'::TEXT, '✅ נקרא process-pending-notifications';
END;
$$;

-- ---------------------------------------------------------------------------
-- Pipeline: תוצאות דרך טריגר earnings_calendar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.test_earnings_results_pipeline()
RETURNS TABLE (step TEXT, detail TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_id TEXT;
BEGIN
  v_id := 'test_pipeline_results_' || FLOOR(EXTRACT(EPOCH FROM NOW()))::TEXT;

  INSERT INTO public.earnings_calendar (
    id, code, ticker, company_name, report_date, date,
    before_after_market, actual, estimate, percent,
    revenue_actual, revenue_estimate_avg, revenue_surprise_percent,
    importance, updated_at, source
  ) VALUES (
    v_id, 'AAPL.US', 'AAPL', 'Apple Inc.', CURRENT_DATE, CURRENT_DATE,
    'BeforeMarket', NULL, 1.40, NULL,
    NULL, 94500000000, NULL,
    5, NOW(), 'push_test'
  )
  ON CONFLICT (id) DO UPDATE SET
    actual = NULL,
    percent = NULL,
    revenue_actual = NULL,
    updated_at = NOW();

  RETURN QUERY SELECT 'earnings_row_insert'::TEXT, '✅ ' || v_id || ' (actual=NULL)';

  UPDATE public.earnings_calendar
  SET
    actual = 1.52,
    percent = 8.6,
    revenue_actual = 94900000000,
    revenue_surprise_percent = 0.4,
    updated_at = NOW()
  WHERE id = v_id;

  RETURN QUERY SELECT 'earnings_trigger'::TEXT, '✅ עודכן actual — אמור להפעיל earnings-results-notifications';
  PERFORM pg_sleep(3);
  PERFORM public._push_test_invoke_processor();
  RETURN QUERY SELECT 'processor'::TEXT, '✅ נקרא process-pending-notifications';
END;
$$;

-- ---------------------------------------------------------------------------
-- Pipeline: דוח כלכלי דרך טריגר economic_events
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.test_economic_report_pipeline()
RETURNS TABLE (step TEXT, detail TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_id TEXT;
BEGIN
  v_id := 'test_pipeline_econ_' || FLOOR(EXTRACT(EPOCH FROM NOW()))::TEXT;

  INSERT INTO public.economic_events (
    id, title, description, country, currency, importance,
    date, time, actual, forecast, previous, source
  ) VALUES (
    v_id,
    'CPI — בדיקת Push Pipeline',
    'אירוע בדיקה',
    'US',
    'USD',
    'high',
    CURRENT_DATE,
    '08:30:00',
    NULL,
    '3.1',
    '3.0',
    'push_test'
  )
  ON CONFLICT (id) DO UPDATE SET
    actual = NULL,
    date = CURRENT_DATE,
    forecast = '3.1';

  RETURN QUERY SELECT 'economic_row_insert'::TEXT, '✅ ' || v_id || ' (actual=NULL)';

  UPDATE public.economic_events
  SET actual = '3.2'
  WHERE id = v_id;

  RETURN QUERY SELECT 'economic_trigger'::TEXT, '✅ עודכן actual — אמור להפעיל send_economic_calendar_notification';
  PERFORM pg_sleep(2);
  RETURN QUERY SELECT 'processor'::TEXT,
    CASE
      WHEN public._push_test_invoke_processor() IS NOT NULL THEN '✅ נקרא process-pending-notifications'
      ELSE '⚠️ תור נוצר — בדוק vault / cron'
    END;
END;
$$;

-- ---------------------------------------------------------------------------
-- הרשאות
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._push_test_invoke_processor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.push_notifications_test_diagnostics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_earnings_upcoming_push(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_earnings_results_push(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_economic_report_push(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_earnings_upcoming_pipeline() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_earnings_results_pipeline() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_economic_report_pipeline() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.push_notifications_test_diagnostics() TO service_role;
GRANT EXECUTE ON FUNCTION public.test_earnings_upcoming_push(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.test_earnings_results_push(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.test_economic_report_push(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.test_earnings_upcoming_pipeline() TO service_role;
GRANT EXECUTE ON FUNCTION public.test_earnings_results_pipeline() TO service_role;
GRANT EXECUTE ON FUNCTION public.test_economic_report_pipeline() TO service_role;

COMMENT ON FUNCTION public.test_earnings_upcoming_push IS
  'בדיקת Push דיווח רווח מתקרב — מכניס לתור + שולח. אופציונלי: UUID משתמש.';
COMMENT ON FUNCTION public.test_earnings_results_push IS
  'בדיקת Push תוצאות דיווח רווח — מכניס לתור + שולח. אופציונלי: UUID משתמש.';
COMMENT ON FUNCTION public.test_economic_report_push IS
  'בדיקת Push דוח כלכלי — מכניס לתור + שולח. אופציונלי: UUID משתמש.';
