-- Index for reply message lookups (jump-to-reply feature)
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to
  ON public.chat_messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

-- Index for reaction queries by message
CREATE INDEX IF NOT EXISTS idx_chat_message_reactions_message
  ON public.chat_message_reactions(message_id, emoji);

-- Index for reaction queries by user (check if user already reacted)
CREATE INDEX IF NOT EXISTS idx_chat_message_reactions_user
  ON public.chat_message_reactions(message_id, user_id);

-- Index for starred messages per group
CREATE INDEX IF NOT EXISTS idx_chat_starred_group
  ON public.chat_starred_messages(group_id, user_id);
