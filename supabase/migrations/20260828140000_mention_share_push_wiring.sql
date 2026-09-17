-- Mentions & shares ↔ push wiring
-- 1) Chat: pass mentioned_users; bypass 12s throttle when message has @mentions
-- 2) Community posts: queue push for tagged users via pending_notifications

-- --------------------------------------------------------------------------
-- 1. notify_chat_message — mentions must not be silently dropped by throttle
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  v_url text;
  v_key text;
  v_claimed uuid;
  v_has_mentions boolean;
  v_mentioned uuid[];
BEGIN
  IF COALESCE(NEW.is_silent, FALSE)
     OR COALESCE(NEW.is_system_message, FALSE)
     OR COALESCE(NEW.is_deleted, FALSE)
     OR NEW.sender_id IS NULL
     OR NEW.message_type = 'system'
  THEN
    RETURN NEW;
  END IF;

  v_mentioned := COALESCE(NEW.mentioned_users, '{}'::uuid[]);
  v_has_mentions := COALESCE(cardinality(v_mentioned), 0) > 0;

  IF v_has_mentions THEN
    -- Always enqueue when someone was @mentioned (do not rate-limit mentions away)
    INSERT INTO public.chat_push_throttle AS t (group_id, last_enqueued_at, last_message_id)
    VALUES (NEW.group_id, timezone('utc', now()), NEW.id)
    ON CONFLICT (group_id) DO UPDATE
      SET last_enqueued_at = EXCLUDED.last_enqueued_at,
          last_message_id = EXCLUDED.last_message_id
    RETURNING group_id INTO v_claimed;
  ELSE
    -- Hot-room digest: at most one edge invoke per group / 12s
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
    RAISE WARNING 'notify_chat_message: missing vault secrets / app.chat_notify_* settings';
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
      'media_url', NEW.media_url,
      'mentioned_users', to_jsonb(v_mentioned)
    ),
    timeout_milliseconds := 8000
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Chat notification failed: %', SQLERRM;
    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.notify_chat_message IS
  'AFTER INSERT chat_messages: pg_net → send-chat-notification; bypasses 12s throttle when mentioned_users is non-empty.';

-- --------------------------------------------------------------------------
-- 2. Community post @mentions → pending_notifications (+ process invoke)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_community_post_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_author_name text;
  v_body_preview text;
  v_mention jsonb;
  v_uid uuid;
  v_article text;
  v_queued boolean := false;
BEGIN
  IF NEW.mentions IS NULL OR jsonb_typeof(NEW.mentions) <> 'array'
     OR jsonb_array_length(NEW.mentions) = 0
  THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(btrim(u.display_name), ''), NULLIF(btrim(u.full_name), ''), 'משתמש')
    INTO v_author_name
  FROM public.users u
  WHERE u.id = NEW.user_id;

  v_author_name := COALESCE(v_author_name, 'משתמש');
  v_body_preview := left(regexp_replace(COALESCE(NEW.body, ''), '\s+', ' ', 'g'), 100);

  FOR v_mention IN
    SELECT value FROM jsonb_array_elements(NEW.mentions)
  LOOP
    BEGIN
      v_uid := NULLIF(btrim(COALESCE(v_mention->>'userId', v_mention->>'user_id', '')), '')::uuid;
    EXCEPTION
      WHEN OTHERS THEN
        v_uid := NULL;
    END;

    IF v_uid IS NULL OR v_uid = NEW.user_id THEN
      CONTINUE;
    END IF;

    v_article := 'cmention:' || NEW.id::text || ':' || v_uid::text;

    INSERT INTO public.pending_notifications (
      user_id, title, body, data, notification_type, article_id
    )
    SELECT
      v_uid,
      'תיוג בציוץ',
      v_author_name || ' הזכיר אותך' ||
        CASE WHEN NULLIF(v_body_preview, '') IS NOT NULL
          THEN ': ' || v_body_preview
          ELSE ''
        END,
      jsonb_build_object(
        'type', 'community_mention',
        'post_id', NEW.id::text,
        'author_id', NEW.user_id::text,
        'author_name', v_author_name
      ),
      'community_mention',
      v_article
    WHERE EXISTS (
      SELECT 1 FROM public.device_tokens dt
      WHERE dt.user_id = v_uid AND dt.is_active = true
    )
    AND COALESCE(
      (SELECT uns.notifications_enabled
         FROM public.user_notification_settings uns
        WHERE uns.user_id = v_uid),
      true
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.pending_notifications pn
      WHERE pn.user_id = v_uid
        AND pn.notification_type = 'community_mention'
        AND pn.article_id = v_article
    );

    IF FOUND THEN
      v_queued := true;
    END IF;
  END LOOP;

  IF v_queued THEN
    PERFORM public.invoke_process_pending_notifications_best_effort();
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'notify_community_post_mentions failed: %', SQLERRM;
    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_community_post_mentions ON public.community_posts;
CREATE TRIGGER trg_notify_community_post_mentions
  AFTER INSERT ON public.community_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_community_post_mentions();

COMMENT ON FUNCTION public.notify_community_post_mentions IS
  'AFTER INSERT community_posts: queue push for each @mentioned user (pending_notifications).';
