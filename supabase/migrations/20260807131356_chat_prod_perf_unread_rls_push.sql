-- ============================================================================
-- Chat production performance: unread fan-out, push throttle, RLS initplan
-- ============================================================================
-- 1) Skip unread bumps for members actively viewing the group (no Realtime flood)
-- 2) Rate-limit per-group push invokes (digest hot rooms)
-- 3) Move push secrets to vault (remove hardcoded service_role JWT)
-- 4) Fix auth.uid() initplan on hot chat RLS policies
-- 5) Fix buggy chat_messages INSERT membership check
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Active viewers (NOT in Realtime publication — no fan-out)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_active_viewers (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  viewing_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_active_viewers_group_fresh
  ON public.chat_active_viewers (group_id, viewing_at DESC);

ALTER TABLE public.chat_active_viewers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own chat viewing presence" ON public.chat_active_viewers;
CREATE POLICY "Users manage own chat viewing presence"
  ON public.chat_active_viewers
  FOR ALL
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.chat_active_viewers FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_active_viewers TO authenticated;
GRANT ALL ON public.chat_active_viewers TO service_role;

-- Client heartbeat / enter / leave
CREATE OR REPLACE FUNCTION public.set_chat_group_viewing(
  p_group_id uuid,
  p_is_viewing boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL OR p_group_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.chat_group_members m
    WHERE m.group_id = p_group_id
      AND m.user_id = v_uid
  ) THEN
    RETURN false;
  END IF;

  IF p_is_viewing THEN
    INSERT INTO public.chat_active_viewers (user_id, group_id, viewing_at)
    VALUES (v_uid, p_group_id, timezone('utc', now()))
    ON CONFLICT (user_id, group_id) DO UPDATE
      SET viewing_at = EXCLUDED.viewing_at;
  ELSE
    DELETE FROM public.chat_active_viewers
    WHERE user_id = v_uid
      AND group_id = p_group_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.set_chat_group_viewing(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_chat_group_viewing(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_chat_group_viewing(uuid, boolean) TO service_role;

COMMENT ON FUNCTION public.set_chat_group_viewing IS
  'Marks the caller as actively viewing a chat group so unread fan-out + push can skip them.';

-- --------------------------------------------------------------------------
-- 2. Unread increment: skip sender + active viewers (90s window)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_unread_count(
  p_group_id uuid,
  p_sender_id uuid,
  p_mentioned_users uuid[] DEFAULT '{}'::uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_group_members m
  SET
    unread_count = COALESCE(m.unread_count, 0) + 1,
    mentioned_count = CASE
      WHEN m.user_id = ANY (p_mentioned_users) THEN COALESCE(m.mentioned_count, 0) + 1
      ELSE m.mentioned_count
    END
  WHERE m.group_id = p_group_id
    AND m.user_id IS DISTINCT FROM p_sender_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.chat_active_viewers v
      WHERE v.user_id = m.user_id
        AND v.group_id = m.group_id
        AND v.viewing_at > (timezone('utc', now()) - interval '90 seconds')
    );
END;
$$;

-- --------------------------------------------------------------------------
-- 3. Push throttle + vault secrets (no hardcoded JWT)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_push_throttle (
  group_id uuid PRIMARY KEY REFERENCES public.chat_groups(id) ON DELETE CASCADE,
  last_enqueued_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  last_message_id uuid
);

ALTER TABLE public.chat_push_throttle ENABLE ROW LEVEL SECURITY;
-- service_role / SECURITY DEFINER only — no client policies

REVOKE ALL ON public.chat_push_throttle FROM PUBLIC;
GRANT ALL ON public.chat_push_throttle TO service_role;

CREATE OR REPLACE FUNCTION public.notify_chat_message()
RETURNS trigger
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

  -- Rate-limit: at most one edge invoke per group / 12s (hot-room digest)
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
    -- Fallback to GUC (if set) without hardcoding secrets in the function body
    v_url := COALESCE(v_url, NULLIF(trim(current_setting('app.chat_notify_url', true)), ''));
    v_key := COALESCE(v_key, NULLIF(trim(current_setting('app.chat_notify_service_jwt', true)), ''));
  ELSE
    v_url := rtrim(v_url, '/') || '/functions/v1/send-chat-notification';
  END IF;

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE WARNING 'notify_chat_message: missing vault secrets / app.chat_notify_* settings';
    RETURN NEW;
  END IF;

  -- If vault returned base URL only, ensure function path
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

COMMENT ON FUNCTION public.notify_chat_message IS
  'AFTER INSERT chat_messages: rate-limited pg_net invoke of send-chat-notification (vault secrets).';

-- --------------------------------------------------------------------------
-- 4. RLS initplan fixes + send policy bugfix (hot chat tables)
-- --------------------------------------------------------------------------

-- chat_group_members
DROP POLICY IF EXISTS "Members can view group memberships" ON public.chat_group_members;
CREATE POLICY "Members can view group memberships" ON public.chat_group_members
  FOR SELECT USING (
    (user_id = (SELECT auth.uid()))
    OR is_user_member_of_group(group_id, (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Members can update their own membership" ON public.chat_group_members;
CREATE POLICY "Members can update their own membership" ON public.chat_group_members
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Members can insert their own membership" ON public.chat_group_members;
CREATE POLICY "Members can insert their own membership" ON public.chat_group_members
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Admins can remove members, users can leave" ON public.chat_group_members;
CREATE POLICY "Admins can remove members, users can leave" ON public.chat_group_members
  FOR DELETE USING (
    (user_id = (SELECT auth.uid()))
    OR is_user_admin_of_group(group_id, (SELECT auth.uid()))
  );

-- chat_messages
DROP POLICY IF EXISTS "Members can view group messages" ON public.chat_messages;
CREATE POLICY "Members can view group messages" ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.chat_group_members
      WHERE chat_group_members.group_id = chat_messages.group_id
        AND chat_group_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can send messages" ON public.chat_messages;
CREATE POLICY "Members can send messages" ON public.chat_messages
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.chat_group_members
      WHERE chat_group_members.group_id = chat_messages.group_id
        AND chat_group_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Senders can edit their messages" ON public.chat_messages;
CREATE POLICY "Senders can edit their messages" ON public.chat_messages
  FOR UPDATE USING ((SELECT auth.uid()) = sender_id);

DROP POLICY IF EXISTS "Senders and admins can delete messages" ON public.chat_messages;
CREATE POLICY "Senders and admins can delete messages" ON public.chat_messages
  FOR DELETE USING (
    (SELECT auth.uid()) = sender_id
    OR EXISTS (
      SELECT 1
      FROM public.chat_group_members
      WHERE chat_group_members.group_id = chat_messages.group_id
        AND chat_group_members.user_id = (SELECT auth.uid())
        AND chat_group_members.role = 'admin'
    )
  );

-- chat_message_reactions
DROP POLICY IF EXISTS "Members can view reactions" ON public.chat_message_reactions;
CREATE POLICY "Members can view reactions" ON public.chat_message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.chat_messages m
      JOIN public.chat_group_members gm ON gm.group_id = m.group_id
      WHERE m.id = chat_message_reactions.message_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can add reactions" ON public.chat_message_reactions;
CREATE POLICY "Members can add reactions" ON public.chat_message_reactions
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1
      FROM public.chat_messages m
      JOIN public.chat_group_members gm ON gm.group_id = m.group_id
      WHERE m.id = chat_message_reactions.message_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can remove own reactions" ON public.chat_message_reactions;
CREATE POLICY "Users can remove own reactions" ON public.chat_message_reactions
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- chat_message_reads
DROP POLICY IF EXISTS "Members can view read receipts" ON public.chat_message_reads;
CREATE POLICY "Members can view read receipts" ON public.chat_message_reads
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.chat_messages m
      JOIN public.chat_group_members gm ON gm.group_id = m.group_id
      WHERE m.id = chat_message_reads.message_id
        AND gm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view their own read receipts" ON public.chat_message_reads;
CREATE POLICY "Users can view their own read receipts" ON public.chat_message_reads
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own read receipts" ON public.chat_message_reads;
CREATE POLICY "Users can insert their own read receipts" ON public.chat_message_reads
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can mark messages as read" ON public.chat_message_reads;
CREATE POLICY "Users can mark messages as read" ON public.chat_message_reads
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own read receipts" ON public.chat_message_reads;
CREATE POLICY "Users can update their own read receipts" ON public.chat_message_reads
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

-- chat_typing_indicators
DROP POLICY IF EXISTS "Members can view typing indicators" ON public.chat_typing_indicators;
CREATE POLICY "Members can view typing indicators" ON public.chat_typing_indicators
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.chat_group_members
      WHERE chat_group_members.group_id = chat_typing_indicators.group_id
        AND chat_group_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can set own typing status" ON public.chat_typing_indicators;
CREATE POLICY "Users can set own typing status" ON public.chat_typing_indicators
  FOR ALL
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- chat_pinned_messages
DROP POLICY IF EXISTS "Group members can view pinned messages" ON public.chat_pinned_messages;
CREATE POLICY "Group members can view pinned messages" ON public.chat_pinned_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.chat_group_members
      WHERE chat_group_members.group_id = chat_pinned_messages.group_id
        AND chat_group_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can pin messages" ON public.chat_pinned_messages;
CREATE POLICY "Admins can pin messages" ON public.chat_pinned_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.chat_group_members
      WHERE chat_group_members.group_id = chat_pinned_messages.group_id
        AND chat_group_members.user_id = (SELECT auth.uid())
        AND chat_group_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can unpin messages" ON public.chat_pinned_messages;
CREATE POLICY "Admins can unpin messages" ON public.chat_pinned_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.chat_group_members
      WHERE chat_group_members.group_id = chat_pinned_messages.group_id
        AND chat_group_members.user_id = (SELECT auth.uid())
        AND chat_group_members.role = 'admin'
    )
  );

-- chat_groups (admin/create/delete + drop duplicate SELECT true policies)
DROP POLICY IF EXISTS "All authenticated users can view all groups" ON public.chat_groups;
DROP POLICY IF EXISTS "All authenticated users can view groups" ON public.chat_groups;

DROP POLICY IF EXISTS "Authenticated users can create groups" ON public.chat_groups;
CREATE POLICY "Authenticated users can create groups" ON public.chat_groups
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = created_by);

DROP POLICY IF EXISTS "Admins can update groups" ON public.chat_groups;
CREATE POLICY "Admins can update groups" ON public.chat_groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.chat_group_members
      WHERE chat_group_members.group_id = chat_groups.id
        AND chat_group_members.user_id = (SELECT auth.uid())
        AND chat_group_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Creators can delete groups" ON public.chat_groups;
CREATE POLICY "Creators can delete groups" ON public.chat_groups
  FOR DELETE USING ((SELECT auth.uid()) = created_by);

-- starred / personal deletions (open-path adjacent)
DROP POLICY IF EXISTS "Users can view own starred messages" ON public.chat_starred_messages;
CREATE POLICY "Users can view own starred messages" ON public.chat_starred_messages
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can star messages" ON public.chat_starred_messages;
CREATE POLICY "Users can star messages" ON public.chat_starred_messages
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can unstar messages" ON public.chat_starred_messages;
CREATE POLICY "Users can unstar messages" ON public.chat_starred_messages
  FOR DELETE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can view their own personal deletions" ON public.chat_message_personal_deletions;
CREATE POLICY "Users can view their own personal deletions" ON public.chat_message_personal_deletions
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own personal deletions" ON public.chat_message_personal_deletions;
CREATE POLICY "Users can insert their own personal deletions" ON public.chat_message_personal_deletions
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own personal deletions" ON public.chat_message_personal_deletions;
CREATE POLICY "Users can delete their own personal deletions" ON public.chat_message_personal_deletions
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- Helpful FK indexes for chat open path
CREATE INDEX IF NOT EXISTS idx_chat_typing_indicators_user_id
  ON public.chat_typing_indicators (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_pinned_messages_message_id
  ON public.chat_pinned_messages (message_id);
CREATE INDEX IF NOT EXISTS idx_chat_pinned_messages_pinned_by
  ON public.chat_pinned_messages (pinned_by);
