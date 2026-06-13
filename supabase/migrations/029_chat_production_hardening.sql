-- ============================================================================
-- 029_chat_production_hardening.sql
-- Production hardening for the chat system:
--   1. UNIQUE constraint on client_message_id (dedup offline-queue retries)
--   2. CHECK constraint on message content length (server-side 10K cap)
--   3. Fix chat_message_reactions INSERT RLS (add group membership guard)
--   4. Push-notification trigger via pg_net → send-chat-notification function
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. UNIQUE index on client_message_id
--    Only enforced when the column is non-null (partial index), so legacy rows
--    and system messages that omit client_message_id are unaffected.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS chat_messages_client_message_id_unique
  ON public.chat_messages (client_message_id)
  WHERE client_message_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. Server-side content length cap (10,000 characters)
--    Mirrors the client-side limit so a bypassed client can't flood the DB.
--    NULL is allowed for media-only messages that have no text.
-- ----------------------------------------------------------------------------
ALTER TABLE public.chat_messages
  DROP CONSTRAINT IF EXISTS chat_messages_content_length_check,
  ADD CONSTRAINT chat_messages_content_length_check
    CHECK (content IS NULL OR char_length(content) <= 10000);

-- ----------------------------------------------------------------------------
-- 3. Fix chat_message_reactions INSERT RLS
--    The original policy only checked auth.uid() = user_id but did NOT verify
--    the reactor is still a member of the group that owns the message.
--    Drop + recreate with a proper membership subquery.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can add reactions" ON public.chat_message_reactions;

CREATE POLICY "Members can add reactions" ON public.chat_message_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.chat_group_members gm
      JOIN public.chat_messages        m  ON m.id = chat_message_reactions.message_id
      WHERE gm.group_id = m.group_id
        AND gm.user_id  = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 4. Push-notification trigger
--    Fires AFTER INSERT on chat_messages, calls the send-chat-notification
--    Edge Function via pg_net (non-blocking, fire-and-forget).
--    Skipped for: deleted messages, system messages, and messages from the
--    bot/system user (sender_id IS NULL).
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_chat_message_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url  TEXT;
  v_key  TEXT;
BEGIN
  -- Skip system / deleted / empty messages
  IF NEW.message_type = 'system'
     OR NEW.is_deleted = true
     OR NEW.sender_id IS NULL
  THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'notify_chat_message_push: missing vault secrets';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/send-chat-notification',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object(
      'message_id',   NEW.id,
      'group_id',     NEW.group_id,
      'sender_id',    NEW.sender_id,
      'content',      COALESCE(NEW.content, ''),
      'message_type', NEW.message_type,
      'media_url',    NEW.media_url
    ),
    timeout_milliseconds := 8000
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never let push failure break message delivery
  RAISE WARNING 'notify_chat_message_push: pg_net error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Drop old trigger if exists, then create fresh
DROP TRIGGER IF EXISTS chat_message_push_notification_trigger ON public.chat_messages;

CREATE TRIGGER chat_message_push_notification_trigger
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_message_push();

-- Restrict direct invocation
REVOKE EXECUTE ON FUNCTION public.notify_chat_message_push() FROM PUBLIC, authenticated;
GRANT  EXECUTE ON FUNCTION public.notify_chat_message_push() TO service_role;

COMMENT ON FUNCTION public.notify_chat_message_push IS
  'Fires after every new chat message. Calls send-chat-notification edge function
   via pg_net to deliver Expo push notifications to offline group members.
   Silently skips system/deleted messages and never throws on push failure.';
