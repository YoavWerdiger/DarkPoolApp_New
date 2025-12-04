-- 🔧 תיקון ויצירת טריגר לחדשות
-- ===========================================

-- שלב 1: בדוק אם הטריגר קיים
SELECT 
  '🔍 בדיקת טריגרים קיימים' as check_name,
  tg.trigger_name,
  tg.event_manipulation as event,
  tg.action_timing as timing,
  tg.action_statement as function_name
FROM information_schema.triggers tg
WHERE tg.event_object_table = 'app_news_clean'
  AND tg.event_object_schema = 'public';

-- שלב 2: בדוק אם הפונקציה קיימת
SELECT 
  '🔍 בדיקת פונקציות קיימות' as check_name,
  p.proname as function_name,
  CASE 
    WHEN p.proname = 'send_news_notification_immediately' THEN '✅ קיימת'
    ELSE '❌ לא קיימת'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname = 'send_news_notification_immediately';

-- שלב 3: יצירת/עדכון הפונקציה
CREATE OR REPLACE FUNCTION send_news_notification_immediately()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- יצירת כותרת וגוף ההתראה
  notification_title := 'חדשה חדשה! 📰';
  notification_body := COALESCE(NEW.label, 'חדשה חדשה התפרסמה');
  
  -- אם הגוף ארוך מדי, נקצר אותו
  IF LENGTH(notification_body) > 100 THEN
    notification_body := LEFT(notification_body, 97) || '...';
  END IF;

  -- הוספת התראה לכל המשתמשים שיש להם device tokens פעילים
  -- עם בדיקת ההגדרות שלהם
  -- ⚠️ חשוב: יוצרים את ההתראות קודם, ואז קוראים ל-Edge Function
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
  LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL
    -- בדיקה: רק משתמשים שהפעילו התראות חדשות
    AND (uns.news_notifications = true OR uns.news_notifications IS NULL)
    -- בדיקה: רק משתמשים שהפעילו התראות בכלל
    AND (uns.notifications_enabled = true OR uns.notifications_enabled IS NULL);

  -- קריאה ל-Edge Function דרך pg_net (אחרי יצירת ההתראות)
  -- וודא ש-pg_net extension מופעל: CREATE EXTENSION IF NOT EXISTS pg_net;
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

-- שלב 4: וידוא שה-trigger קיים ומחובר
-- מחיקת trigger ישן (אם קיים)
DROP TRIGGER IF EXISTS on_new_news_article ON public.app_news_clean;

-- יצירת trigger חדש על app_news_clean
CREATE TRIGGER on_new_news_article
  AFTER INSERT ON public.app_news_clean
  FOR EACH ROW
  EXECUTE FUNCTION send_news_notification_immediately();

-- שלב 5: וידוא שהפונקציה וה-trigger נוצרו
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

-- שלב 6: בדוק ש-pg_net extension מופעל
SELECT 
  '🔍 בדיקת pg_net extension' as check_name,
  extname as extension_name,
  extversion as version
FROM pg_extension
WHERE extname = 'pg_net';

-- אם pg_net לא קיים, הרץ: CREATE EXTENSION IF NOT EXISTS pg_net;

