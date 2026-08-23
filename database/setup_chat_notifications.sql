-- הגדרת מערכת התראות צ׳אט (pg_net → Edge Function)
-- מקור אמת: supabase/migrations/*_chat_prod_perf_unread_rls_push.sql
-- Secrets: vault SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (לא להטמיע JWT בפונקציה)

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS public.chat_push_throttle (
  group_id uuid PRIMARY KEY REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  last_enqueued_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_message_id uuid
);

ALTER TABLE public.chat_push_throttle ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_push_throttle FROM PUBLIC;
GRANT ALL ON public.chat_push_throttle TO service_role;

CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url text;
  v_key text;
  v_claimed uuid;
BEGIN
  IF COALESCE(NEW.is_silent, FALSE)
     OR COALESCE(NEW.is_system_message, FALSE)
     OR COALESCE(NEW.is_deleted, FALSE)
     OR NEW.sender_id IS NULL
     OR NEW.message_type = 'system'
  THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.chat_push_throttle AS t (group_id, last_enqueued_at, last_message_id)
  VALUES (NEW.group_id, timezone('utc', now()), NEW.id)
  ON CONFLICT (group_id) DO UPDATE
    SET last_enqueued_at = EXCLUDED.last_enqueued_at,
        last_message_id = EXCLUDED.last_message_id
    WHERE t.last_enqueued_at < (timezone('utc', now()) - interval '12 seconds')
  RETURNING group_id INTO v_claimed;

  IF v_claimed IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    v_url := COALESCE(v_url, NULLIF(trim(current_setting('app.chat_notify_url', true)), ''));
    v_key := COALESCE(v_key, NULLIF(trim(current_setting('app.chat_notify_service_jwt', true)), ''));
  ELSE
    v_url := rtrim(v_url, '/') || '/functions/v1/send-chat-notification';
  END IF;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'notify_chat_message: missing vault secrets';
    RETURN NEW;
  END IF;

  IF position('/functions/v1/send-chat-notification' in v_url) = 0 THEN
    v_url := rtrim(v_url, '/') || '/functions/v1/send-chat-notification';
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'message_id', NEW.id::text,
      'group_id', NEW.group_id::text,
      'sender_id', NEW.sender_id::text,
      'content', COALESCE(NEW.content, ''),
      'message_type', COALESCE(NEW.message_type, 'text'),
      'media_url', NEW.media_url
    ),
    timeout_milliseconds := 8000
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Chat notification failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_chat_message_notification ON public.chat_messages;
CREATE TRIGGER trigger_chat_message_notification
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_chat_message();
