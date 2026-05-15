-- =============================================
-- Fix: reaction INSERT policy must verify group membership
-- =============================================
DROP POLICY IF EXISTS "Members can add reactions" ON public.chat_message_reactions;

CREATE POLICY "Members can add reactions" ON public.chat_message_reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.chat_messages m
      JOIN public.chat_group_members gm ON gm.group_id = m.group_id
      WHERE m.id = message_id
        AND gm.user_id = auth.uid()
    )
  );

-- =============================================
-- Fix: pinned messages policies used 'owner' role which doesn't exist in schema
-- =============================================
DROP POLICY IF EXISTS "Admins can pin messages" ON public.chat_pinned_messages;
DROP POLICY IF EXISTS "Admins can unpin messages" ON public.chat_pinned_messages;

CREATE POLICY "Admins can pin messages"
ON public.chat_pinned_messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE chat_group_members.group_id = chat_pinned_messages.group_id
      AND chat_group_members.user_id = auth.uid()
      AND chat_group_members.role = 'admin'
  )
);

CREATE POLICY "Admins can unpin messages"
ON public.chat_pinned_messages FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE chat_group_members.group_id = chat_pinned_messages.group_id
      AND chat_group_members.user_id = auth.uid()
      AND chat_group_members.role = 'admin'
  )
);

-- =============================================
-- Fix: storage foldername NULL safety
-- Wrap cast in a safe guard so malformed paths don't bypass the policy
-- =============================================
DROP POLICY IF EXISTS "Group members can read media" ON storage.objects;
DROP POLICY IF EXISTS "Group members can upload media" ON storage.objects;

CREATE POLICY "Group members can read media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE chat_group_members.group_id = (storage.foldername(name))[1]::uuid
      AND chat_group_members.user_id = auth.uid()
  )
);

CREATE POLICY "Group members can upload media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.chat_group_members
    WHERE chat_group_members.group_id = (storage.foldername(name))[1]::uuid
      AND chat_group_members.user_id = auth.uid()
  )
);
