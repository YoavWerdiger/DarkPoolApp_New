-- ============================================================================
-- 055_news_push_test_helpers.sql
-- בדיקת Push לחדשות מתפרצות (app_news_clean).
--
-- אחרי הרצת המיגרציה, ב-SQL Editor:
--   SELECT * FROM public.insert_test_breaking_news();
--   SELECT * FROM public.news_push_diagnostics();
--
-- זרימה: INSERT ל-app_news_clean → טריגר → pending_notifications →
--        process-pending-notifications (pg_net / cron כל 2 דק').
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- טריגר — עמודות אמיתיות בלבד: label, text, img (לא title/content/image_url)
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
  v_url               TEXT;
  v_key               TEXT;
  http_response_id    BIGINT;
BEGIN
  notification_title := COALESCE(NULLIF(TRIM(NEW.label), ''), 'DarkPool');

  IF LENGTH(notification_title) > 100 THEN
    notification_title := LEFT(notification_title, 97) || '...';
  END IF;

  notification_body := COALESCE(
    NULLIF(TRIM(NEW.text), ''),
    NULLIF(TRIM(NEW.label), ''),
    ''
  );

  IF LENGTH(notification_body) > 200 THEN
    notification_body := LEFT(notification_body, 197) || '...';
  END IF;

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
      'source',    COALESCE(NEW.source, ''),
      'imageUrl',  COALESCE(NEW.img, '')
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
-- אבחון מהיר לפני/אחרי בדיקה
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_push_diagnostics()
RETURNS TABLE (
  check_name TEXT,
  detail     TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trigger_count INT;
  v_active_tokens INT;
  v_pending_news  INT;
  v_vault_url     BOOLEAN;
  v_vault_key     BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_trigger_count
  FROM information_schema.triggers
  WHERE event_object_schema = 'public'
    AND event_object_table = 'app_news_clean'
    AND trigger_name = 'on_new_news_article';

  SELECT COUNT(*) INTO v_active_tokens
  FROM public.device_tokens
  WHERE is_active = true AND user_id IS NOT NULL;

  SELECT COUNT(*) INTO v_pending_news
  FROM public.pending_notifications
  WHERE notification_type = 'news' AND is_sent = false;

  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1
  ) INTO v_vault_url;

  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1
  ) INTO v_vault_key;

  RETURN QUERY SELECT 'trigger_on_new_news_article'::TEXT,
    CASE WHEN v_trigger_count > 0 THEN '✅ קיים' ELSE '❌ חסר' END;

  RETURN QUERY SELECT 'active_device_tokens'::TEXT,
    v_active_tokens::TEXT || ' טוקנים פעילים';

  RETURN QUERY SELECT 'pending_news_queue'::TEXT,
    v_pending_news::TEXT || ' ממתינות לשליחה';

  RETURN QUERY SELECT 'vault_SUPABASE_URL'::TEXT,
    CASE WHEN v_vault_url THEN '✅ קיים' ELSE '❌ חסר — pg_net לא יקרא ל-Edge Function' END;

  RETURN QUERY SELECT 'vault_SERVICE_ROLE_KEY'::TEXT,
    CASE WHEN v_vault_key THEN '✅ קיים' ELSE '❌ חסר' END;
END;
$$;

-- ---------------------------------------------------------------------------
-- הוספת חדשת בדיקה — מפעילה את הטריגר אוטומטית
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.insert_test_breaking_news(
  p_label  TEXT DEFAULT NULL,
  p_text   TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'בדיקת Push'
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
    '🔔 בדיקת Push — ' || TO_CHAR(v_now, 'HH24:MI:SS')
  );
  v_text := COALESCE(
    NULLIF(TRIM(p_text), ''),
    'חדשת בדיקה מ-' || TO_CHAR(v_now, 'YYYY-MM-DD HH24:MI:SS') ||
    '. אם קיבלת התראה — המערכת עובדת.'
  );

  INSERT INTO public.app_news_clean (id, label, text, source, time, img)
  VALUES (
    v_id,
    v_label,
    v_text,
    COALESCE(NULLIF(TRIM(p_source), ''), 'בדיקת Push'),
    TO_CHAR(v_now, 'YYYY-MM-DD HH24:MI:SS'),
    NULL
  );

  -- המתנה קצרה לטריגר + pg_net
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

REVOKE ALL ON FUNCTION public.news_push_diagnostics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_test_breaking_news(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.news_push_diagnostics() TO service_role;
GRANT EXECUTE ON FUNCTION public.insert_test_breaking_news(TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.insert_test_breaking_news IS
  'מוסיף חדשת בדיקה ל-app_news_clean ומפעיל Push. הרצה: SELECT * FROM insert_test_breaking_news();';

COMMENT ON FUNCTION public.news_push_diagnostics IS
  'סטטוס טריגר, טוקנים, תור והגדרות vault לבדיקת Push חדשות.';
