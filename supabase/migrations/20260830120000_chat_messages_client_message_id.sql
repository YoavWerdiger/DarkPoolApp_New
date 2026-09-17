-- Stable client identity for chat sends.
-- Lets the optimistic bubble morph into the realtime/server row
-- (same list key) and dedupes offline-queue retries.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS client_message_id uuid;

COMMENT ON COLUMN public.chat_messages.client_message_id IS
  'Client-generated UUID for an outbound message. Used to merge the optimistic row with the server/realtime insert and to dedupe retries.';

CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_client_message_id_unique
  ON public.chat_messages (client_message_id)
  WHERE client_message_id IS NOT NULL;
