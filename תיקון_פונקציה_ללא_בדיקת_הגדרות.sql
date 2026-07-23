-- 🔧 תיקון: פונקציה פשוטה יותר - בלי בדיקת הגדרות
-- ===================================================
-- זה יוודא שההתראות נוצרות גם אם אין הגדרות משתמש

-- מחיקת הפונקציה הקיימת
DROP FUNCTION IF EXISTS send_news_notification_immediately() CASCADE;

-- יצירת פונקציה פשוטה יותר (ללא בדיקת הגדרות)
CREATE OR REPLACE FUNCTION send_news_notification_immediately()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
  supabase_url TEXT := 'https://wpmrtczbfcijoocguime.supabase.co';
  supabase_service_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNzM1MSwiZXhwIjoyMDY2NzgzMzUxfQ.waqI1C-t6gthSCf8jP1v_gFRRVhhvaIcQG0effqsA1A';
  http_response_id BIGINT;
BEGIN
  -- יצירת כותרת וגוף ההתראה
  notification_title := 'חדשה חדשה! 📰';
  notification_body := COALESCE(NEW.label, NEW.text, 'חדשה חדשה התפרסמה');
  
  -- אם הגוף ארוך מדי, נקצר אותו
  IF LENGTH(notification_body) > 100 THEN
    notification_body := LEFT(notification_body, 97) || '...';
  END IF;

  -- שליחת HTTP request ל-Edge Function דרך pg_net
  BEGIN
    SELECT net.http_post(
      url := supabase_url || '/functions/v1/process-pending-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || supabase_service_key
      ),
      body := '{}'::jsonb
    ) INTO http_response_id;
  EXCEPTION
    WHEN OTHERS THEN
      -- אם pg_net לא עובד, נמשיך - ההתראות יישמרו ב-pending_notifications
      NULL;
  END;

  -- הוספת התראות לכל המשתמשים עם device tokens פעילים
  -- ✅ גרסה פשוטה - בלי בדיקת הגדרות (לבדיקה)
  INSERT INTO public.pending_notifications (user_id, title, body, data, notification_type, article_id)
  SELECT DISTINCT
    dt.user_id,
    notification_title,
    notification_body,
    jsonb_build_object(
      'type', 'news',
      'articleId', NEW.id,
      'source', NEW.source,
      'imageUrl', NEW.img
    ),
    'news',
    NEW.id::TEXT
  FROM public.device_tokens dt
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- אם יש שגיאה, נשמור ב-pending_notifications כגיבוי
    INSERT INTO public.pending_notifications (user_id, title, body, data, notification_type, article_id)
    SELECT DISTINCT
      dt.user_id,
      notification_title,
      notification_body,
      jsonb_build_object(
        'type', 'news',
        'articleId', NEW.id,
        'source', NEW.source,
        'imageUrl', NEW.img
      ),
      'news',
      NEW.id::TEXT
    FROM public.device_tokens dt
    WHERE dt.is_active = true
      AND dt.user_id IS NOT NULL;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- וידוא שה-trigger קיים
DROP TRIGGER IF EXISTS on_new_news_article ON public.app_news_clean;

CREATE TRIGGER on_new_news_article
  AFTER INSERT ON public.app_news_clean
  FOR EACH ROW
  EXECUTE FUNCTION send_news_notification_immediately();

-- בדיקה שהפונקציה נוצרה
SELECT 
  '✅ הפונקציה נוצרה!' as status,
  proname as function_name
FROM pg_proc
WHERE proname = 'send_news_notification_immediately';

-- בדיקה שה-trigger קיים
SELECT 
  '✅ ה-trigger קיים!' as status,
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'app_news_clean'
  AND trigger_name = 'on_new_news_article';


