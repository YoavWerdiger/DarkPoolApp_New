-- ============================================================================
-- 053_news_push_notifications.sql
-- Push על INSERT ל-app_news_clean (חדשות מתפרצות).
--
-- BreakingNewsTab / newsService רק קוראים ומכניסים לטבלה — השליחה כאן:
--   INSERT → pending_notifications → process-pending-notifications (pg_net)
--
-- דורש vault secrets (כמו 030):
--   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

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
  -- תמיכה בשתי סכימות: label/text/img (legacy) ו-title/content/image_url (modern)
  notification_title := COALESCE(
    NULLIF(TRIM(NEW.title), ''),
    NULLIF(TRIM(NEW.label), ''),
    'DarkPool'
  );

  IF LENGTH(notification_title) > 100 THEN
    notification_title := LEFT(notification_title, 97) || '...';
  END IF;

  notification_body := COALESCE(
    NULLIF(TRIM(NEW.content), ''),
    NULLIF(TRIM(NEW.text), ''),
    NULLIF(TRIM(NEW.text_content), ''),
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
    RAISE WARNING 'news push: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in vault — rows queued in pending_notifications only';
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

CREATE OR REPLACE FUNCTION public.invoke_process_pending_notifications()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url        TEXT;
  v_key        TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'process_pending_notifications cron: missing vault secrets';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/process-pending-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  ) INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- גיבוי: שליחת תור ממתין כל 2 דקות (אם pg_net נכשל בטריגר)
DO $$
BEGIN
  PERFORM cron.unschedule('process_pending_notifications');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'process_pending_notifications',
  '*/2 * * * *',
  $$SELECT public.invoke_process_pending_notifications();$$
);

COMMENT ON FUNCTION public.send_news_notification_immediately() IS
  'Queues news push for active device tokens on app_news_clean INSERT; invokes process-pending-notifications via pg_net.';
