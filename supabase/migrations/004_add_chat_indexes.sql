-- Composite index for efficient message queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_chat_messages_group_created
  ON public.chat_messages(group_id, created_at DESC)
  WHERE is_deleted = false;

-- Index for unread count lookups
CREATE INDEX IF NOT EXISTS idx_chat_group_members_user_unread
  ON public.chat_group_members(user_id, unread_count);

-- Index for typing indicator cleanup
CREATE INDEX IF NOT EXISTS idx_chat_typing_cleanup
  ON public.chat_typing_indicators(started_typing_at);

-- Index for sender-based message queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_group
  ON public.chat_messages(sender_id, group_id, created_at DESC);

-- Index for message search (full-text)
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_search
  ON public.chat_messages USING gin(to_tsvector('simple', coalesce(content, '')));

-- Index for read receipts lookups
CREATE INDEX IF NOT EXISTS idx_chat_message_reads_message
  ON public.chat_message_reads(message_id, user_id);

-- Index for starred messages
CREATE INDEX IF NOT EXISTS idx_chat_starred_user
  ON public.chat_starred_messages(user_id, starred_at DESC);
