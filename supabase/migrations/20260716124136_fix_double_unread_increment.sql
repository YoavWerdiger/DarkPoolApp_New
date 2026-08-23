-- Fix: unread_count was incremented twice on every chat_messages INSERT.
-- Cause: on_new_chat_message (update_group_on_new_message) AND
--        after_chat_message_insert_unread (increment_unread_count) both +1.
-- Keep last_message metadata in update_group_on_new_message; unread only via trigger.

CREATE OR REPLACE FUNCTION public.update_group_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.chat_groups
  SET
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(COALESCE(NEW.content,
      CASE
        WHEN NEW.message_type = 'image' THEN '📷 תמונה'
        WHEN NEW.message_type = 'video' THEN '🎥 סרטון'
        WHEN NEW.message_type = 'audio' THEN '🎤 הודעה קולית'
        WHEN NEW.message_type = 'document' THEN '📎 מסמך'
        ELSE ''
      END
    ), 100),
    messages_count = COALESCE(messages_count, 0) + 1
  WHERE id = NEW.group_id;

  -- unread_count is owned exclusively by after_chat_message_insert_unread
  RETURN NEW;
END;
$function$;

-- Pass mentioned_users from the row so mentions stay accurate without a second RPC.
CREATE OR REPLACE FUNCTION public.trigger_increment_unread_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.is_silent, FALSE) = FALSE
     AND COALESCE(NEW.is_system_message, FALSE) = FALSE
  THEN
    PERFORM public.increment_unread_count(
      NEW.group_id,
      NEW.sender_id,
      COALESCE(NEW.mentioned_users, '{}'::uuid[])
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- Heal existing inflated counters (typical ~2× from the double trigger).
UPDATE public.chat_group_members cgm
SET unread_count = sub.actual_unread
FROM (
  SELECT
    m.user_id,
    m.group_id,
    (
      SELECT COUNT(*)::integer
      FROM public.chat_messages msg
      WHERE msg.group_id = m.group_id
        AND msg.is_deleted = false
        AND COALESCE(msg.is_silent, false) = false
        AND COALESCE(msg.is_system_message, false) = false
        AND msg.sender_id IS DISTINCT FROM m.user_id
        AND (
          CASE
            WHEN m.last_read_message_id IS NOT NULL THEN
              msg.created_at > (
                SELECT lr.created_at
                FROM public.chat_messages lr
                WHERE lr.id = m.last_read_message_id
              )
            WHEN m.last_read_at IS NOT NULL THEN
              msg.created_at > m.last_read_at
            ELSE true
          END
        )
    ) AS actual_unread
  FROM public.chat_group_members m
) sub
WHERE cgm.user_id = sub.user_id
  AND cgm.group_id = sub.group_id
  AND cgm.unread_count IS DISTINCT FROM sub.actual_unread;
