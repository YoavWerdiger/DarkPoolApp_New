-- Community-style @mentions metadata on chat messages.
-- Keeps existing mentioned_users uuid[] for unread/notification triggers.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS mentions jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.chat_messages.mentions IS
  'CommunityMention[] — { userId, displayName } tagged members (tap-to-profile)';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chat_messages_mentions_is_array'
      AND conrelid = 'public.chat_messages'::regclass
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_mentions_is_array
      CHECK (jsonb_typeof(mentions) = 'array');
  END IF;
END $$;
