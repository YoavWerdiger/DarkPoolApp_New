-- Groups marked with the muted-microphone emoji become quiet rooms:
-- strip the emoji from the name, and only community managers may post.
-- Enforced in the database (trigger), not only in the client.

UPDATE public.chat_groups
SET
  name = btrim(regexp_replace(replace(replace(name, '🔇', ''), '🌟', ''), '\s+', ' ', 'g')),
  settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('onlyAdminsCanSend', true),
  updated_at = NOW()
WHERE position('🔇' in name) > 0
   OR id IN (
     '00000000-0000-0000-0000-000000000006',
     '00000000-0000-0000-0000-000000000007',
     '00000000-0000-0000-0000-000000000008',
     '00000000-0000-0000-0000-000000000009'
   );

CREATE OR REPLACE FUNCTION public.enforce_quiet_group_send()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_only boolean;
BEGIN
  IF COALESCE(NEW.is_system_message, false) THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE((g.settings->>'onlyAdminsCanSend')::boolean, false)
    OR COALESCE((g.settings->>'is_announcement')::boolean, false)
  INTO admin_only
  FROM public.chat_groups g
  WHERE g.id = NEW.group_id;

  IF NOT COALESCE(admin_only, false) THEN
    RETURN NEW;
  END IF;

  IF public.is_user_admin_of_group(NEW.group_id, NEW.sender_id)
     OR public.is_app_admin(NEW.sender_id)
     OR EXISTS (
       SELECT 1
       FROM public.chat_group_members m
       WHERE m.group_id = NEW.group_id
         AND m.user_id = NEW.sender_id
         AND m.role IN ('admin', 'owner')
     )
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'only community managers can send in this group'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_quiet_group_send ON public.chat_messages;
CREATE TRIGGER chat_messages_quiet_group_send
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quiet_group_send();
