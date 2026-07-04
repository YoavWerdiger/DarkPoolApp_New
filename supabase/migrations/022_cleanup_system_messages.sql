-- Remove existing "user left" and "member removed" system messages from chat
-- These notifications are distracting and disabled by design going forward.
UPDATE public.chat_messages
SET is_deleted = true, deleted_at = NOW()
WHERE is_system_message = true
  AND system_message_type IN ('user_left', 'member_removed', 'user_joined');

-- Disable showJoinMessages on all groups (future-proof)
UPDATE public.chat_groups
SET settings = settings || '{"showJoinMessages": false}'::jsonb
WHERE (settings->>'showJoinMessages')::boolean = true;
