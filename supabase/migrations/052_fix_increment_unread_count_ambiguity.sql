-- =============================================
-- Fix: increment_unread_count(uuid, uuid) is not unique (42725)
-- Two overloads existed: (uuid,uuid) and (uuid,uuid,uuid[] DEFAULT).
-- Keep a single 3-arg function; 2-arg calls (trigger) use the default.
-- =============================================

DROP FUNCTION IF EXISTS public.increment_unread_count(uuid, uuid);
DROP FUNCTION IF EXISTS public.increment_unread_count(uuid, uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.increment_unread_count(
  p_group_id uuid,
  p_sender_id uuid,
  p_mentioned_users uuid[] DEFAULT '{}'::uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_group_members
  SET
    unread_count = COALESCE(unread_count, 0) + 1,
    mentioned_count = CASE
      WHEN user_id = ANY (p_mentioned_users) THEN COALESCE(mentioned_count, 0) + 1
      ELSE mentioned_count
    END
  WHERE group_id = p_group_id
    AND user_id IS DISTINCT FROM p_sender_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_unread_count(uuid, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_unread_count(uuid, uuid, uuid[]) TO service_role;
