-- ============================================
-- עדכונים אוטומטיים בצ'אט (Realtime + Triggers)
-- ============================================
-- הרץ ב-Supabase SQL Editor.
-- אחרי ההרצה: כל הוספת הודעה תעדכן אוטומטית unread_count (טריגר),
-- ו-Realtime יעדכן את האפליקציה (הודעות, ריאקשנים, באדג').
-- ============================================

-- 1. טריגר: כל הודעה חדשה (לא שקטה/מערכת) מעדכנת unread_count לכל החברים מלבד השולח
CREATE OR REPLACE FUNCTION public.trigger_increment_unread_on_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_silent, FALSE) = FALSE
     AND COALESCE(NEW.is_system_message, FALSE) = FALSE
  THEN
    PERFORM public.increment_unread_count(NEW.group_id, NEW.sender_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_chat_message_insert_unread ON public.chat_messages;
CREATE TRIGGER after_chat_message_insert_unread
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_increment_unread_on_new_message();

-- 2. Realtime: וידוא שכל טבלאות הצ'אט ב-Publication
-- (אם הטבלה כבר ב-publication – השגיאה נתפסת והסקריפט ממשיך)
DO $$
DECLARE
  tables text[] := ARRAY['chat_groups','chat_group_members','chat_messages','chat_message_reactions','chat_message_reads','chat_typing_indicators'];
  t text;
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- כבר בפרסום או שגיאה אחרת
    END;
  END LOOP;
END $$;

-- 3. סיום
SELECT 'Chat realtime + triggers ready. Tables in publication: chat_groups, chat_group_members, chat_messages, chat_message_reactions, chat_message_reads, chat_typing_indicators. Trigger: after_chat_message_insert_unread.' AS status;
