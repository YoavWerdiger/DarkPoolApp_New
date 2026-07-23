-- 🔧 יצירת/תיקון טריגר לחדשות
-- ===========================================
-- זה ייצור את הטריגר שיוצר התראות כשנוספת חדשה

-- שלב 1: וידוא ש-pg_net extension מופעל
CREATE EXTENSION IF NOT EXISTS pg_net;

-- שלב 2: יצירת/עדכון הפונקציה
CREATE OR REPLACE FUNCTION send_news_notification_immediately()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- יצירת כותרת וגוף ההתראה מהחדשה
  -- כותרת: נשתמש ב-label מהחדשה
  notification_title := COALESCE(NEW.label, 'חדשה חדשה! 📰');
  
  -- גוף: נשתמש ב-text מהחדשה, או ב-label אם אין text
  notification_body := COALESCE(NEW.text, NEW.label, 'חדשה חדשה התפרסמה');
  
  -- אם הגוף ארוך מדי, נקצר אותו (להתראות מומלץ עד 100-150 תווים)
  IF LENGTH(notification_body) > 150 THEN
    notification_body := LEFT(notification_body, 147) || '...';
  END IF;
  
  -- אם הכותרת ארוכה מדי, נקצר אותה
  IF LENGTH(notification_title) > 50 THEN
    notification_title := LEFT(notification_title, 47) || '...';
  END IF;

  -- הוספת התראה לכל המשתמשים שיש להם device tokens פעילים
  -- עם בדיקת ההגדרות שלהם
  INSERT INTO public.pending_notifications (user_id, title, body, data, notification_type, article_id)
  SELECT DISTINCT
    dt.user_id,
    notification_title,
    notification_body,
    jsonb_build_object(
      'type', 'news',
      'articleId', NEW.id,
      'title', NEW.label,
      'body', NEW.text,
      'source', COALESCE(NEW.source, 'מערכת'),
      'imageUrl', NEW.img,
      'time', NEW.time
    ),
    'news',
    NEW.id::TEXT
  FROM public.device_tokens dt
  LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL
    -- בדיקה: רק משתמשים שהפעילו התראות חדשות
    AND (uns.news_notifications = true OR uns.news_notifications IS NULL)
    -- בדיקה: רק משתמשים שהפעילו התראות בכלל
    AND (uns.notifications_enabled = true OR uns.notifications_enabled IS NULL);

  -- קריאה ל-Edge Function דרך pg_net (אחרי יצירת ההתראות)
  BEGIN
    PERFORM net.http_post(
      url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/process-pending-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbXJ0Y3piZmNpam9vY2d1aW1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTIwNzM1MSwiZXhwIjoyMDY2NzgzMzUxfQ.waqI1C-t6gthSCf8jP1v_gFRRVhhvaIcQG0effqsA1A'
      ),
      body := '{}'::jsonb
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- אם pg_net לא עובד, זה לא יכשל - ההתראות כבר נוצרו ב-pending_notifications
      NULL;
  END;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- אם יש שגיאה, נשמור ב-pending_notifications כגיבוי (בלי בדיקת הגדרות)
    INSERT INTO public.pending_notifications (user_id, title, body, data, notification_type, article_id)
    SELECT DISTINCT
      dt.user_id,
      notification_title,
      notification_body,
      jsonb_build_object(
        'type', 'news',
        'articleId', NEW.id,
        'source', COALESCE(NEW.source, 'מערכת'),
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

-- שלב 3: מחיקת trigger ישן (אם קיים)
DROP TRIGGER IF EXISTS on_new_news_article ON public.app_news_clean;

-- שלב 4: יצירת trigger חדש על app_news_clean
CREATE TRIGGER on_new_news_article
  AFTER INSERT ON public.app_news_clean
  FOR EACH ROW
  EXECUTE FUNCTION send_news_notification_immediately();

-- שלב 5: בדיקה שהפונקציה וה-trigger נוצרו
SELECT 
  '✅ הפונקציה נוצרה!' as status,
  proname as function_name
FROM pg_proc
WHERE proname = 'send_news_notification_immediately';

SELECT 
  '✅ ה-trigger קיים!' as status,
  trigger_name,
  event_object_table,
  event_manipulation as event
FROM information_schema.triggers
WHERE event_object_table = 'app_news_clean'
  AND trigger_name = 'on_new_news_article';

-- שלב 6: בדיקה ש-pg_net extension מופעל
SELECT 
  '✅ pg_net extension מופעל!' as status,
  extname as extension_name
FROM pg_extension
WHERE extname = 'pg_net';

