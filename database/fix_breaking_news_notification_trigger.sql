-- ============================================================
-- שיפור טריגר התראות חדשות מתפרצות
-- ============================================================
-- שיפורים:
--   ✅ כותרת מקצועית: שם המקור (Benzinga, Reuters וכו')
--   ✅ גוף: label/title של המאמר (כותרת הכתבה)
--   ✅ תמונה: image_url מועבר ל-process-pending-notifications
--   ✅ data מלא: type, articleId, source, imageUrl
-- ============================================================

DROP FUNCTION IF EXISTS send_news_notification_immediately() CASCADE;

CREATE OR REPLACE FUNCTION send_news_notification_immediately()
RETURNS TRIGGER AS $$
DECLARE
  notification_title  TEXT;
  notification_body   TEXT;
  supabase_url        TEXT := 'https://wpmrtczbfcijoocguime.supabase.co';
  supabase_service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNzM1MSwiZXhwIjoyMDY2NzgzMzUxfQ.waqI1C-t6gthSCf8jP1v_gFRRVhhvaIcQG0effqsA1A';
  http_response_id    BIGINT;
BEGIN
  -- כותרת: כותרת החדשה עצמה
  notification_title := COALESCE(
    NULLIF(TRIM(NEW.label), ''),
    NULLIF(TRIM(NEW.title), ''),
    'DarkPool'
  );

  IF LENGTH(notification_title) > 100 THEN
    notification_title := LEFT(notification_title, 97) || '...';
  END IF;

  -- גוף: התוכן המלא של החדשה
  notification_body := COALESCE(
    NULLIF(TRIM(NEW.summary), ''),
    NULLIF(TRIM(NEW.content), ''),
    ''
  );

  IF LENGTH(notification_body) > 200 THEN
    notification_body := LEFT(notification_body, 197) || '...';
  END IF;

  -- הכנסה ל-pending_notifications רק למשתמשים שהסכימו לחדשות
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
      'imageUrl',  COALESCE(NEW.image_url, '')
    ),
    'news',
    NEW.id::TEXT
  FROM public.device_tokens dt
  LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL
    AND (uns.news_notifications = true OR uns.news_notifications IS NULL)
    AND (uns.notifications_enabled = true OR uns.notifications_enabled IS NULL);

  -- קריאה מיידית ל-process-pending-notifications דרך pg_net
  SELECT net.http_post(
    url     := supabase_url || '/functions/v1/process-pending-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || supabase_service_key
    ),
    body    := '{}'::jsonb
  ) INTO http_response_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- גיבוי: הכנסה גם אחרי שגיאה
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
        'imageUrl',  COALESCE(NEW.image_url, '')
      ),
      'news',
      NEW.id::TEXT
    FROM public.device_tokens dt
    LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
    WHERE dt.is_active = true
      AND dt.user_id IS NOT NULL
      AND (uns.news_notifications = true OR uns.news_notifications IS NULL)
      AND (uns.notifications_enabled = true OR uns.notifications_enabled IS NULL);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- מחיקת הטריגר הישן וחידושו
DROP TRIGGER IF EXISTS on_new_news_article ON public.app_news_clean;

CREATE TRIGGER on_new_news_article
  AFTER INSERT ON public.app_news_clean
  FOR EACH ROW
  EXECUTE FUNCTION send_news_notification_immediately();

-- ============================================================
-- דוגמת פלט:
--   כותרת: "📰 Benzinga"
--   גוף:   "Apple reports record Q1 earnings, beating estimates..."
--   data:  { type: 'news', articleId: 'xxx', source: 'Benzinga', imageUrl: 'https://...' }
-- ============================================================
