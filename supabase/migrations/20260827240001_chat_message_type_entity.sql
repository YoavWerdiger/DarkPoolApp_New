-- Multiverse MVP: allow message_type = entity (TRADE remains for backward compat)

ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS valid_message_type;

ALTER TABLE public.chat_messages
  ADD CONSTRAINT valid_message_type CHECK (
    message_type IN (
      'text',
      'image',
      'video',
      'audio',
      'document',
      'system',
      'poll',
      'media_group',
      'trade',
      'entity'
    )
  );
