-- ============================================
-- הגדרת מערכת התראות צ'אט (pg_net → Edge Function)
-- ============================================
-- ⚠️ אל תשמור Service Role Key בריפו.
-- לפני שהטריגר שולח Push, הגדר במסד (פעם אחת, ב-Supabase SQL Editor בלבד):
--
--   ALTER DATABASE postgres SET app.chat_notify_url
--     TO 'https://<PROJECT_REF>.supabase.co/functions/v1/send-chat-notification';
--   ALTER DATABASE postgres SET app.chat_notify_service_jwt TO '<Service Role מ-Settings → API>';
--
-- אם הפרמטרים לא מוגדרים — ההודעה נשמרת בצ'אט אך Push ידולג (WARNING בלוג).
-- מומלץ גם לסובב (rotate) כל מפתח service_role שהודבק בעבר בריפו.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_group_members' AND column_name = 'muted'
  ) THEN
    ALTER TABLE public.chat_group_members ADD COLUMN muted BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_group_members' AND column_name = 'notifications_enabled'
  ) THEN
    ALTER TABLE public.chat_group_members ADD COLUMN notifications_enabled BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn_url text;
  fn_jwt text;
BEGIN
  IF COALESCE(NEW.is_silent, FALSE) OR COALESCE(NEW.is_system_message, FALSE) THEN
    RETURN NEW;
  END IF;

  fn_url := NULLIF(trim(current_setting('app.chat_notify_url', true)), '');
  fn_jwt := NULLIF(trim(current_setting('app.chat_notify_service_jwt', true)), '');

  IF fn_url IS NULL OR fn_jwt IS NULL THEN
    RAISE WARNING 'Chat push skipped: set database parameters app.chat_notify_url and app.chat_notify_service_jwt (see header in setup_chat_notifications.sql)';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || fn_jwt
    ),
    body := jsonb_build_object(
      'message_id', NEW.id::text,
      'group_id', NEW.group_id::text,
      'sender_id', NEW.sender_id::text,
      'content', COALESCE(NEW.content, ''),
      'message_type', COALESCE(NEW.message_type, 'text'),
      'media_url', NEW.media_url
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Chat notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_chat_message_notification ON public.chat_messages;

CREATE TRIGGER trigger_chat_message_notification
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_message();

CREATE OR REPLACE FUNCTION public.toggle_group_mute(
  p_group_id UUID,
  p_user_id UUID,
  p_muted BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_group_members
  SET muted = p_muted,
      notifications_enabled = NOT p_muted
  WHERE group_id = p_group_id AND user_id = p_user_id;

  RETURN FOUND;
END;
$$;

SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'chat_messages'
  AND trigger_name = 'trigger_chat_message_notification';
