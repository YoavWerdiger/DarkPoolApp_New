-- Enforce onlyAdminsCanSend / is_announcement on chat_messages INSERT.
-- Previously RLS allowed any member to insert; the client alone blocked
-- non-admins, and the UI only checked group role — so app "מנהל"
-- (subscription_role admin) could not post in הכרזות.
--
-- Allowed senders when the group is admin-only:
--   * chat_group_members.role = 'admin'
--   * public.is_app_admin(auth.uid())  -- subscription_role admin/super_admin
-- Ordinary members remain blocked.

DROP POLICY IF EXISTS "Members can send messages" ON public.chat_messages;

CREATE POLICY "Members can send messages" ON public.chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.chat_group_members
      WHERE chat_group_members.group_id = chat_messages.group_id
        AND chat_group_members.user_id = (SELECT auth.uid())
    )
    AND (
      NOT COALESCE(
        (
          SELECT
            COALESCE((g.settings->>'onlyAdminsCanSend')::boolean, false)
            OR COALESCE((g.settings->>'is_announcement')::boolean, false)
          FROM public.chat_groups g
          WHERE g.id = chat_messages.group_id
        ),
        false
      )
      OR public.is_user_admin_of_group(chat_messages.group_id, (SELECT auth.uid()))
      OR public.is_app_admin((SELECT auth.uid()))
    )
  );

COMMENT ON POLICY "Members can send messages" ON public.chat_messages IS
  'Members may insert; when onlyAdminsCanSend/is_announcement, only group admin or app admin.';
