-- פונקציה לשליחת התראותתפרסמת חדשה
CREATE OR REPLACE FUNCTION send_news_notification()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
  user_record RECORD;
  device_token_record RECORD;
BEGIN
  -- יצירת כותרת וגוף ההתראה
  notification_title := 'חדשה חדשה! 📰';
  notification_body := COALESCE(NEW.label, NEW.title, NEW.text_content, 'חדשה חדשה התפרסמה');
  
  -- אם הגוף ארוך מדי, נקצר אותו
  IF LENGTH(notification_body) > 100 THEN
    notification_body := LEFT(notification_body, 97) || '...';
  END IF;

  -- שליחת התראות לכל המשתמשים שהפעילו התראות חדשות
  -- נשתמש ב-Edge Function דרך HTTP request
  -- זה יקרא ל-send-push-notification function
  
  -- נשתמש ב-pg_net extension לשליחת HTTP requests
  -- או נשתמש ב-Edge Function דרך Supabase client
  
  -- בינתיים, נשמור את המידע בטבלה נפרדת שתטופל על ידי cron job
  -- או נשתמש ב-Edge Function ישירות
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger ישן - נמחק למטה
-- (ה-trigger החדש נוצר בסוף הקובץ)

-- טבלה זמנית לניהול התראות (אם נרצה לשלוח דרך cron)
CREATE TABLE IF NOT EXISTS public.pending_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  notification_type TEXT NOT NULL, -- 'news', 'earnings', 'community', etc.
  article_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  is_sent BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_pending_notifications_user_id ON public.pending_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_notifications_sent ON public.pending_notifications(is_sent) WHERE is_sent = false;

-- RLS Policies for pending_notifications
ALTER TABLE public.pending_notifications ENABLE ROW LEVEL SECURITY;

-- מחיקת פוליסיות קיימות (אם קיימות)
DROP POLICY IF EXISTS "Users can view their own pending notifications" ON public.pending_notifications;
DROP POLICY IF EXISTS "Service role can manage all pending notifications" ON public.pending_notifications;

-- משתמשים יכולים לראות רק את ההתראות שלהם
CREATE POLICY "Users can view their own pending notifications"
  ON public.pending_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role יכול לעשות הכל (לצורך Edge Functions)
CREATE POLICY "Service role can manage all pending notifications"
  ON public.pending_notifications
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- הפעלת pg_net extension (אם עדיין לא הופעל)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- מחיקת הפונקציות הישנות (אם קיימות) - לפני יצירת חדשות
DROP FUNCTION IF EXISTS send_news_notification() CASCADE;
DROP FUNCTION IF EXISTS queue_news_notification() CASCADE;
DROP FUNCTION IF EXISTS send_news_notification_immediately() CASCADE;

-- מחיקת ה-trigger הישן (אם קיים) - לפני יצירת חדש
DROP TRIGGER IF EXISTS on_new_news_article ON public.app_news;

-- פונקציה ששולחת התראות ישירות דרך Edge Function (מיידי!)
CREATE OR REPLACE FUNCTION send_news_notification_immediately()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
  supabase_url TEXT := 'https://wpmrtczbfcijoocguime.supabase.co';
  -- Service Role Key - צריך להחליף ב-SERVICE_ROLE_KEY שלך!
  -- מצאת אותו ב-Supabase Dashboard > Settings > API > service_role (secret)
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

  -- שומרים גם ב-pending_notifications (כדי שה-Edge Function תמצא)
  -- זה גם משמש כגיבוי אם ה-HTTP request נכשל
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
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- אם יש שגיאה, נשמור ב-pending_notifications כגיבוי
    -- (אפשר להוסיף cron job שיטפל בהתראות שלא נשלחו)
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
    WHERE dt.is_active = true
      AND dt.user_id IS NOT NULL;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- גרסה פשוטה יותר - שימוש ב-Database Webhook (מומלץ)
-- במקום pg_net, נשתמש ב-Database Webhook ב-Supabase Dashboard
-- זה יותר פשוט ולא דורש pg_net extension
CREATE OR REPLACE FUNCTION queue_news_notification()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- יצירת כותרת וגוף ההתראה
  notification_title := 'חדשה חדשה! 📰';
  notification_body := COALESCE(NEW.label, NEW.title, NEW.text_content, 'חדשה חדשה התפרסמה');
  
  -- אם הגוף ארוך מדי, נקצר אותו
  IF LENGTH(notification_body) > 100 THEN
    notification_body := LEFT(notification_body, 97) || '...';
  END IF;

  -- הוספת התראה לכל המשתמשים שיש להם device tokens פעילים
  -- Database Webhook יקרא ל-Edge Function אוטומטית
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
  WHERE dt.is_active = true
    AND dt.user_id IS NOT NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- שימוש בפונקציה המיידית (עם pg_net) - התראות נשלחות מיד!
CREATE TRIGGER on_new_news_article
  AFTER INSERT ON public.app_news
  FOR EACH ROW
  EXECUTE FUNCTION send_news_notification_immediately();

