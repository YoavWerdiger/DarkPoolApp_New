-- ============================================================================
-- 062_news_economic_push_bidi.sql
-- BiDi לחדשות + השלמה לדוח כלכלי (כותרת + מקור/שם דוח במשנה)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.push_notification_rtl(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RETURN '';
  END IF;
  IF position(U&'\2066' in p_text) > 0 THEN
    RETURN p_text;
  END IF;
  RETURN U&'\200F' || p_text;
END;
$$;

COMMENT ON FUNCTION public.push_notification_rtl IS
  'מוסיף RLM להקשר RTL; קטעי LTR נעטפים ב-process-pending-notifications.';

-- ---------------------------------------------------------------------------
-- חדשות מתפרצות — כותרת/גוף RTL + מקור LTR במשנה
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_news_notification_immediately()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  notification_title  TEXT;
  notification_body   TEXT;
  notification_source TEXT;
  v_url               TEXT;
  v_key               TEXT;
  http_response_id    BIGINT;
BEGIN
  notification_title := COALESCE(
    NULLIF(TRIM(NEW.label), ''),
    NULLIF(TRIM(NEW.title), ''),
    'DarkPool'
  );

  IF LENGTH(notification_title) > 100 THEN
    notification_title := LEFT(notification_title, 97) || '...';
  END IF;

  notification_body := COALESCE(
    NULLIF(TRIM(NEW.text), ''),
    NULLIF(TRIM(NEW.content), ''),
    NULLIF(TRIM(NEW.text_content), ''),
    NULLIF(TRIM(NEW.label), ''),
    ''
  );

  IF LENGTH(notification_body) > 200 THEN
    notification_body := LEFT(notification_body, 197) || '...';
  END IF;

  notification_title := public.push_notification_rtl(notification_title);
  notification_body := public.push_notification_rtl(notification_body);
  notification_source := public.push_notification_ltr(
    COALESCE(NULLIF(TRIM(NEW.source), ''), 'DarkPool')
  );

  INSERT INTO public.pending_notifications (
    user_id, title, body, data, notification_type, article_id
  )
  SELECT DISTINCT
    dt.user_id,
    notification_title,
    notification_body,
    jsonb_build_object(
      'type',      'news',
      'articleId', NEW.id::TEXT,
      'source',    notification_source,
      'imageUrl',  COALESCE(NEW.image_url, NEW.img, '')
    ),
    'news',
    NEW.id::TEXT
  FROM public.device_tokens dt
  LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL
    AND COALESCE(uns.notifications_enabled, true)
    AND COALESCE(uns.news_notifications, true);

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
  ELSE
    RAISE WARNING 'news push: missing vault secrets — queued in pending_notifications only';
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'send_news_notification_immediately failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_news_article ON public.app_news_clean;
CREATE TRIGGER on_new_news_article
  AFTER INSERT ON public.app_news_clean
  FOR EACH ROW
  EXECUTE FUNCTION public.send_news_notification_immediately();

-- ---------------------------------------------------------------------------
-- דוח כלכלי — כותרת RTL + שם דוח במשנה (data.title) עם LTR לקטעים לטיניים
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- בדיקת חדשות — טקסט מעורב עברית/אנגלית
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_test_breaking_news(
  p_label  TEXT DEFAULT NULL,
  p_text   TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'Reuters'
)
RETURNS TABLE (
  article_id           TEXT,
  article_label        TEXT,
  pending_created      BIGINT,
  pending_sent         BIGINT,
  pending_still_waiting BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_id    TEXT;
  v_label TEXT;
  v_text  TEXT;
  v_now   TIMESTAMPTZ := NOW();
BEGIN
  v_id := 'test_push_' || FLOOR(EXTRACT(EPOCH FROM v_now))::TEXT || '_' || FLOOR(RANDOM() * 10000)::TEXT;
  v_label := COALESCE(
    NULLIF(TRIM(p_label), ''),
    'בדיקת Push: Apple (AAPL) עולה 2.4% לפני דיווח'
  );
  v_text := COALESCE(
    NULLIF(TRIM(p_text), ''),
    'המניה AAPL ב-$198.50. תגובת השוק לפני דיווח רבעוני — בדיקת BiDi.'
  );

  INSERT INTO public.app_news_clean (id, label, text, source, time, img)
  VALUES (
    v_id,
    v_label,
    v_text,
    COALESCE(NULLIF(TRIM(p_source), ''), 'Reuters'),
    TO_CHAR(v_now, 'YYYY-MM-DD HH24:MI:SS'),
    NULL
  );

  PERFORM pg_sleep(2);

  RETURN QUERY
  SELECT
    v_id,
    v_label,
    s.created,
    s.sent,
    s.waiting
  FROM (
    SELECT
      COUNT(*)::BIGINT AS created,
      COUNT(*) FILTER (WHERE is_sent = true)::BIGINT AS sent,
      COUNT(*) FILTER (WHERE is_sent = false)::BIGINT AS waiting
    FROM public.pending_notifications pn
    WHERE pn.notification_type = 'news'
      AND pn.article_id = v_id
  ) s;
END;
$$;

GRANT EXECUTE ON FUNCTION public.push_notification_rtl(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_test_breaking_news(TEXT, TEXT, TEXT) TO service_role;
