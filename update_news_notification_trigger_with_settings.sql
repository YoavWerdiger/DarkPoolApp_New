-- עדכון טריגר התראות חדשות לבדיקת הגדרות משתמש
-- ===================================================
-- טריגר זה יוצר התראות רק למשתמשים שרוצים התראות חדשות

-- מחיקת הפונקציה הקיימת
DROP FUNCTION IF EXISTS send_news_notification_immediately() CASCADE;

-- יצירת פונקציה מעודכנת עם בדיקת הגדרות
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
  notification_body := COALESCE(NEW.label, NEW.title, NEW.text_content, 'חדשה חדשה התפרסמה');
  
  -- אם הגוף ארוך מדי, נקצר אותו
  IF LENGTH(notification_body) > 100 THEN
    notification_body := LEFT(notification_body, 97) || '...';
  END IF;

  -- שליחת HTTP request ל-Edge Function דרך pg_net
  -- זה קורה מיידית כשנוספת חדשה!
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/process-pending-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || supabase_service_key
    ),
    body := '{}'::jsonb
  ) INTO http_response_id;

  -- הוספת התראות רק למשתמשים שרוצים התראות חדשות
  -- ✅ שיפור: בדיקת הגדרות המשתמש לפני יצירת התראה
  INSERT INTO public.pending_notifications (user_id, title, body, data, notification_type, article_id)
  SELECT DISTINCT
    dt.user_id,
    notification_title,
    notification_body,
    jsonb_build_object(
      'type', 'news',
      'articleId', NEW.id,
      'source', NEW.source,
      'imageUrl', NEW.image_url
    ),
    'news',
    NEW.id::TEXT
  FROM public.device_tokens dt
  LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL
    -- ✅ בדיקה: רק משתמשים שהפעילו התראות חדשות
    AND (uns.news_notifications = true OR uns.news_notifications IS NULL)
    -- ✅ בדיקה: רק משתמשים שהפעילו התראות בכלל
    -- אם אין הגדרות למשתמש, נשלח (ברירת מחדל - הכל פעיל)
    AND (uns.notifications_enabled = true OR uns.notifications_enabled IS NULL);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- אם יש שגיאה, נשמור ב-pending_notifications כגיבוי
    -- (אבל עדיין נבדוק את ההגדרות)
    INSERT INTO public.pending_notifications (user_id, title, body, data, notification_type, article_id)
    SELECT DISTINCT
      dt.user_id,
      notification_title,
      notification_body,
      jsonb_build_object(
        'type', 'news',
        'articleId', NEW.id,
        'source', NEW.source,
        'imageUrl', NEW.image_url
      ),
      'news',
      NEW.id::TEXT
    FROM public.device_tokens dt
    LEFT JOIN public.user_notification_settings uns ON dt.user_id = uns.user_id
    WHERE dt.is_active = true
      AND dt.user_id IS NOT NULL
      -- ✅ בדיקה גם במקרה שגיאה
      AND (uns.news_notifications = true OR uns.news_notifications IS NULL)
      AND (uns.notifications_enabled = true OR uns.notifications_enabled IS NULL);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- וידוא שה-trigger קיים ומחובר
DROP TRIGGER IF EXISTS on_new_news_article ON public.app_news;

CREATE TRIGGER on_new_news_article
  AFTER INSERT ON public.app_news
  FOR EACH ROW
  EXECUTE FUNCTION send_news_notification_immediately();

-- הערות:
-- 1. הפונקציה בודקת את ההגדרות של המשתמש לפני יצירת התראה
-- 2. אם המשתמש כיבה התראות חדשות - לא תיווצר התראה
-- 3. אם המשתמש כיבה התראות בכלל - לא תיווצר התראה
-- 4. אם אין הגדרות למשתמש (משתמש חדש) - נשלח (ברירת מחדל)
-- 5. Edge Function `process-pending-notifications` בודקת שוב את ההגדרות לפני שליחה

