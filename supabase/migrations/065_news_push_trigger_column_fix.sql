-- ============================================================================
-- 065_news_push_trigger_column_fix.sql
-- תיקון רגרסיה מ-062: הטריגר ניגש ל-NEW.title / NEW.content / NEW.image_url
-- שלא קיימים ב-app_news_clean (העמודות האמיתיות: label, text, img).
-- השגיאה נבלעה ב-EXCEPTION → חדשות נכנסות לטבלה אבל אין שורות ב-pending_notifications.
-- ============================================================================

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

COMMENT ON FUNCTION public.send_news_notification_immediately() IS
  'Push על INSERT ל-app_news_clean — עמודות label/text/img בלבד + BiDi (תוקן ב-065).';

DROP TRIGGER IF EXISTS on_new_news_article ON public.app_news_clean;

CREATE TRIGGER on_new_news_article
  AFTER INSERT ON public.app_news_clean
  FOR EACH ROW
  EXECUTE FUNCTION public.send_news_notification_immediately();
