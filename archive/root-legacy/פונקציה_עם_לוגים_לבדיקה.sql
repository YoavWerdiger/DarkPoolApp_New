-- 🔧 פונקציה עם לוגים לבדיקה
-- =============================

-- מחיקת הפונקציה הקיימת
DROP FUNCTION IF EXISTS send_news_notification_immediately() CASCADE;

-- יצירת פונקציה עם לוגים
CREATE OR REPLACE FUNCTION send_news_notification_immediately()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_body TEXT;
  device_tokens_count INTEGER;
  inserted_count INTEGER;
BEGIN
  -- לוג: התחלה
  RAISE NOTICE '🔔 Trigger activated for article: %', NEW.id;
  
  -- יצירת כותרת וגוף ההתראה
  notification_title := 'חדשה חדשה! 📰';
  notification_body := COALESCE(NEW.label, NEW.text, 'חדשה חדשה התפרסמה');
  
  RAISE NOTICE '📝 Notification: title=%, body=%', notification_title, LEFT(notification_body, 50);
  
  -- בדיקה כמה device tokens יש
  SELECT COUNT(*) INTO device_tokens_count
  FROM device_tokens
  WHERE is_active = true;
  
  RAISE NOTICE '📱 Found % active device tokens', device_tokens_count;
  
  IF device_tokens_count = 0 THEN
    RAISE NOTICE '⚠️ No active device tokens - skipping notification creation';
    RETURN NEW;
  END IF;

  -- הוספת התראות
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
  
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RAISE NOTICE '✅ Inserted % notifications into pending_notifications', inserted_count;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Error in trigger: %', SQLERRM;
    -- נשמור ב-pending_notifications כגיבוי
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


