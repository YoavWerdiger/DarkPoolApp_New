-- ============================================================================
-- 030_chat_pinned_and_viewers_rpc.sql
-- RPC functions for pinned messages (chat_pinned_messages) and read receipts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_chat_pinned_messages(p_group_id uuid)
RETURNS TABLE (
  id uuid,
  message_id uuid,
  message_content text,
  message_type text,
  message_created_at timestamptz,
  pinned_by uuid,
  pinned_by_name text,
  pinned_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE group_id = p_group_id AND user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    pm.id,
    pm.message_id,
    COALESCE(
      CASE
        WHEN m.message_type = 'media_group' AND m.content IS NOT NULL THEN
          COALESCE((m.content::jsonb ->> 'caption'), 'מדיה')
        WHEN m.message_type IN ('image', 'video', 'audio', 'document') THEN
          CASE m.message_type
            WHEN 'image' THEN 'תמונה'
            WHEN 'video' THEN 'סרטון'
            WHEN 'audio' THEN 'הודעה קולית'
            WHEN 'document' THEN 'מסמך'
            ELSE 'מדיה'
          END
        ELSE COALESCE(m.content, '')
      END,
      ''
    ) AS message_content,
    m.message_type::text,
    m.created_at AS message_created_at,
    pm.pinned_by,
    COALESCE(u.display_name, u.full_name, 'משתמש') AS pinned_by_name,
    pm.created_at AS pinned_at
  FROM public.chat_pinned_messages pm
  JOIN public.chat_messages m ON m.id = pm.message_id
  LEFT JOIN public.users u ON u.id = pm.pinned_by
  WHERE pm.group_id = p_group_id
    AND m.is_deleted = false
  ORDER BY pm.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_pinned_messages(uuid) TO authenticated;

-- Read-receipt viewers for chat messages (replaces legacy messages.viewed_by RPC)
CREATE OR REPLACE FUNCTION public.get_message_viewers(message_uuid uuid)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  profile_picture text,
  viewed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid;
  v_group_id uuid;
BEGIN
  SELECT m.sender_id, m.group_id
  INTO v_sender_id, v_group_id
  FROM public.chat_messages m
  WHERE m.id = message_uuid;

  IF v_group_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE group_id = v_group_id AND user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    r.user_id,
    COALESCE(u.display_name, u.full_name, 'משתמש')::text AS full_name,
    u.profile_picture::text,
    r.read_at AS viewed_at
  FROM public.chat_message_reads r
  JOIN public.users u ON u.id = r.user_id
  WHERE r.message_id = message_uuid
    AND r.user_id IS DISTINCT FROM v_sender_id
  ORDER BY r.read_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_message_viewers(uuid) TO authenticated;
