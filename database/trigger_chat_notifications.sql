-- ============================================
-- 🔔 מערכת התראות צ'אט - כמו וואטסאפ
-- ============================================
-- Trigger שמפעיל התראות Push בכל הודעת צ'אט חדשה
-- שולח התראה לכל חברי הקבוצה שלא השתיקו
-- ============================================

-- 1. פונקציית Trigger לשליחת התראות צ'אט
CREATE OR REPLACE FUNCTION notify_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
  v_sender_id UUID;
  v_content TEXT;
  v_message_type TEXT;
  v_media_url TEXT;
  v_is_silent BOOLEAN;
  v_is_system_message BOOLEAN;
BEGIN
  -- שליפת נתונים מההודעה החדשה
  v_group_id := NEW.group_id;
  v_sender_id := NEW.sender_id;
  v_content := NEW.content;
  v_message_type := NEW.message_type;
  v_media_url := NEW.media_url;
  v_is_silent := COALESCE(NEW.is_silent, FALSE);
  v_is_system_message := COALESCE(NEW.is_system_message, FALSE);

  -- לא שולחים התראות על הודעות שקטות או הודעות מערכת
  IF v_is_silent OR v_is_system_message THEN
    RAISE NOTICE 'Skipping notification: silent=%, system=%', v_is_silent, v_is_system_message;
    RETURN NEW;
  END IF;

  -- קריאה ל-Edge Function לשליחת ההתראות
  -- הפונקציה תטפל בכל הלוגיקה: מי לשלוח, מי השתיק, וכו'
  PERFORM
    net.http_post(
      url := CONCAT(
        current_setting('app.settings.supabase_url', true),
        '/functions/v1/send-chat-notification'
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', CONCAT('Bearer ', current_setting('app.settings.service_role_key', true))
      ),
      body := jsonb_build_object(
        'message_id', NEW.id::text,
        'group_id', v_group_id::text,
        'sender_id', v_sender_id::text,
        'content', v_content,
        'message_type', v_message_type,
        'media_url', v_media_url
      )
    );

  RAISE NOTICE 'Chat notification triggered for message % in group %', NEW.id, v_group_id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- לא נכשיל את שליחת ההודעה אם ההתראה נכשלה
    RAISE WARNING 'Failed to send chat notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. מחיקת Trigger קודם אם קיים
DROP TRIGGER IF EXISTS trigger_chat_message_notification ON public.chat_messages;

-- 3. יצירת Trigger על הוספת הודעה חדשה
CREATE TRIGGER trigger_chat_message_notification
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_chat_message();

-- ============================================
-- הפעלה חלופית: באמצעות pg_net ישירות (מומלץ)
-- ============================================
-- אם יש בעיה עם הגדרות app.settings, ניתן להשתמש בגרסה הזו

CREATE OR REPLACE FUNCTION notify_chat_message_v2()
RETURNS TRIGGER AS $$
BEGIN
  -- לא שולחים התראות על הודעות שקטות או הודעות מערכת
  IF COALESCE(NEW.is_silent, FALSE) OR COALESCE(NEW.is_system_message, FALSE) THEN
    RETURN NEW;
  END IF;

  -- קריאה ל-Edge Function עם URL ישיר
  -- החלף את ה-SERVICE_ROLE_KEY בערך האמיתי שלך!
  PERFORM
    net.http_post(
      url := 'https://wpmrtczbfcijoocguime.supabase.co/functions/v1/send-chat-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY_HERE'
      ),
      body := jsonb_build_object(
        'message_id', NEW.id::text,
        'group_id', NEW.group_id::text,
        'sender_id', NEW.sender_id::text,
        'content', NEW.content,
        'message_type', NEW.message_type,
        'media_url', NEW.media_url
      )
    );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send chat notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- בדיקה שהפונקציה pg_net מותקנת
-- ============================================

-- הפעלת pg_net extension (אם לא מופעל)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- הגדרות Service Role Key (חד פעמי)
-- ============================================
-- הרץ את הפקודות האלה ב-SQL Editor (החלף את הערכים שלך):

-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';

-- ============================================
-- בדיקת הגדרות הטבלה chat_group_members
-- ============================================

-- וודא שהעמודות muted ו-notifications_enabled קיימות
DO $$ 
BEGIN
  -- הוסף עמודת muted אם לא קיימת
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'chat_group_members' 
    AND column_name = 'muted'
  ) THEN
    ALTER TABLE public.chat_group_members ADD COLUMN muted BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added muted column to chat_group_members';
  END IF;

  -- הוסף עמודת notifications_enabled אם לא קיימת
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'chat_group_members' 
    AND column_name = 'notifications_enabled'
  ) THEN
    ALTER TABLE public.chat_group_members ADD COLUMN notifications_enabled BOOLEAN DEFAULT TRUE;
    RAISE NOTICE 'Added notifications_enabled column to chat_group_members';
  END IF;
END $$;

-- ============================================
-- פונקציה להשתקת/ביטול השתקת קבוצה
-- ============================================

CREATE OR REPLACE FUNCTION toggle_group_mute(
  p_group_id UUID,
  p_user_id UUID,
  p_muted BOOLEAN
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.chat_group_members
  SET muted = p_muted,
      notifications_enabled = NOT p_muted
  WHERE group_id = p_group_id AND user_id = p_user_id;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- בדיקת התקנה
-- ============================================

-- בדוק ש-Trigger נוצר
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE event_object_table = 'chat_messages'
AND trigger_name LIKE '%notification%';

-- בדוק ש-pg_net מותקן
SELECT * FROM pg_extension WHERE extname = 'pg_net';

-- ============================================
-- ✅ סיום הגדרת מערכת ההתראות!
-- ============================================
-- 
-- לאחר הרצת הסקריפט:
-- 1. ודא ש-pg_net extension מופעל
-- 2. הגדר את app.settings.supabase_url
-- 3. הגדר את app.settings.service_role_key
-- 4. העלה את ה-Edge Function: supabase functions deploy send-chat-notification
-- 5. בדוק שהכל עובד בשליחת הודעת צ'אט!
-- ============================================

