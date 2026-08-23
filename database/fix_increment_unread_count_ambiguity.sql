-- Unread increment: skip sender + active viewers (see chat_active_viewers)
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
  UPDATE public.chat_group_members m
  SET
    unread_count = COALESCE(m.unread_count, 0) + 1,
    mentioned_count = CASE
      WHEN m.user_id = ANY (p_mentioned_users) THEN COALESCE(m.mentioned_count, 0) + 1
      ELSE m.mentioned_count
    END
  WHERE m.group_id = p_group_id
    AND m.user_id IS DISTINCT FROM p_sender_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.chat_active_viewers v
      WHERE v.user_id = m.user_id
        AND v.group_id = m.group_id
        AND v.viewing_at > (timezone('utc', now()) - interval '90 seconds')
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_unread_count(uuid, uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_unread_count(uuid, uuid, uuid[]) TO service_role;
