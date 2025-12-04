-- ✅ פונקציה לשליחה ישירה - בלי pending_notifications
-- ======================================================
-- זה שולח ישר מה-trigger, פשוט ומהיר!

-- שלב 1: מחיקת הפונקציה הקיימת
DROP FUNCTION IF EXISTS send_news_notification_immediately() CASCADE;

-- שלב 2: יצירת פונקציה חדשה - שליחה ישירה
CREATE OR REPLACE FUNCTION send_news_notification_immediately()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
  supabase_url TEXT := 'https://wpmrtczbfcijoocguime.supabase.co';
  supabase_service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNzM1MSwiZXhwIjoyMDY2NzgzMzUxfQ.waqI1C-t6gthSCf8jP1v_gFRRVhhvaIcQG0effqsA1A';
  http_response_id BIGINT;
  user_ids_array TEXT[];
BEGIN
  -- יצירת כותרת וגוף ההתראה
  notification_title := 'חדשה חדשה! 📰';
  notification_body := COALESCE(NEW.label, NEW.text, 'חדשה חדשה התפרסמה');
  
  -- אם הגוף ארוך מדי, נקצר אותו
  IF LENGTH(notification_body) > 100 THEN
    notification_body := LEFT(notification_body, 97) || '...';
  END IF;

  -- קבלת כל ה-user_ids שיש להם device tokens פעילים
  SELECT ARRAY_AGG(DISTINCT dt.user_id::TEXT)
  INTO user_ids_array
  FROM device_tokens dt
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL;

  -- אם אין משתמשים, לא נשלח כלום
  IF user_ids_array IS NULL OR array_length(user_ids_array, 1) = 0 THEN
    RAISE NOTICE '⚠️ No active device tokens - skipping notification';
    RETURN NEW;
  END IF;

  -- שליחה ישירה ל-Edge Function send-push-notification
  BEGIN
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_service_key
      ),
      body := jsonb_build_object(
        'userIds', user_ids_array,
        'title', notification_title,
        'body', notification_body,
        'data', jsonb_build_object(
          'type', 'news',
          'articleId', NEW.id,
          'source', NEW.source,
          'imageUrl', NEW.img
        ),
        'sound', 'default',
        'priority', 'high'
      )::jsonb
    ) INTO http_response_id;
    
    RAISE NOTICE '✅ Sent notification directly to % users', array_length(user_ids_array, 1);
  EXCEPTION
    WHEN OTHERS THEN
      -- אם pg_net לא עובד, נדפיס שגיאה אבל לא נכשל
      RAISE NOTICE '⚠️ Failed to send notification directly: %', SQLERRM;
      -- אפשר להוסיף כאן fallback ל-pending_notifications אם רוצים
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- שלב 3: וידוא שה-trigger קיים
DROP TRIGGER IF EXISTS on_new_news_article ON public.app_news_clean;

CREATE TRIGGER on_new_news_article
  AFTER INSERT ON public.app_news_clean
  FOR EACH ROW
  EXECUTE FUNCTION send_news_notification_immediately();

-- שלב 4: בדיקה שהפונקציה נוצרה
SELECT 
  '✅ הפונקציה נוצרה!' as status,
  proname as function_name
FROM pg_proc
WHERE proname = 'send_news_notification_immediately';

-- שלב 5: בדיקה שה-trigger קיים
SELECT 
  '✅ ה-trigger קיים!' as status,
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'app_news_clean'
  AND trigger_name = 'on_new_news_article';

-- הערות:
-- ======
-- 1. זה שולח ישר מה-trigger, בלי pending_notifications
-- 2. אם pg_net לא עובד, ההתראה לא תישלח (אבל לא תיכשל)
-- 3. פשוט ומהיר - שליחה מיידית!
-- 4. אם רוצים גיבוי, אפשר להוסיף fallback ל-pending_notifications


