-- מונע שגיאת 42725 אם חזרה גרסה כפולה של increment_unread_count
-- וגם מעביר mentioned_users מהשורה (בלי RPC כפול מה-edge function)
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
    PERFORM public.increment_unread_count(
      NEW.group_id,
      NEW.sender_id,
      COALESCE(NEW.mentioned_users, '{}'::uuid[])
    );
  END IF;
  RETURN NEW;
END;
$$;
