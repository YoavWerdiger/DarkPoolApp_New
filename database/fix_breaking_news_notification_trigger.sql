-- ============================================================
-- טריגר התראות Push לחדשות (app_news_clean)
-- ============================================================
-- מבנה ה-Push:
--   title    = label
--   subtitle = source   (נקבע ב-Edge Function)
--   body     = text
--   image    = img
-- ============================================================

CREATE OR REPLACE FUNCTION public.send_news_notification_immediately()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  notification_title  TEXT;
  notification_body   TEXT;
  notification_source TEXT;
  notification_label  TEXT;
  v_url               TEXT;
  v_key               TEXT;
  http_response_id    BIGINT;
BEGIN
  -- title = label, subtitle = source, body = text, image = img
  notification_label := NULLIF(TRIM(NEW.label), '');
  notification_source := COALESCE(NULLIF(TRIM(NEW.source), ''), 'DarkPool');

  notification_title := COALESCE(
    notification_label,
    NULLIF(LEFT(TRIM(COALESCE(NEW.text, '')), 80), ''),
    'חדשה'
  );

  IF LENGTH(notification_title) > 100 THEN
    notification_title := LEFT(notification_title, 97) || '...';
  END IF;

  notification_body := COALESCE(NULLIF(TRIM(NEW.text), ''), '');

  IF LENGTH(notification_body) > 200 THEN
    notification_body := LEFT(notification_body, 197) || '...';
  END IF;

  notification_title := public.push_notification_rtl(notification_title);
  notification_body := public.push_notification_rtl(notification_body);
  notification_source := public.push_notification_ltr(notification_source);
  IF notification_label IS NOT NULL THEN
    notification_label := public.push_notification_rtl(notification_label);
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
      'source',    notification_source,
      'label',     COALESCE(notification_label, ''),
      'imageUrl',  COALESCE(NEW.img, NEW.image_url, '')
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
$function$;

DROP TRIGGER IF EXISTS on_new_news_article ON public.app_news_clean;

CREATE TRIGGER on_new_news_article
  AFTER INSERT ON public.app_news_clean
  FOR EACH ROW
  EXECUTE FUNCTION send_news_notification_immediately();
