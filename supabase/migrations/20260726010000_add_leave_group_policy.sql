-- ============================================
-- Restore missing DELETE RLS policy on chat_group_members
-- ============================================
-- Root cause: an older script (`database/fix_unread_messages_system.sql`)
-- dropped the DELETE policy "Admins can remove members, users can leave"
-- from `chat_group_members` and never recreated it. RLS is enabled on the
-- table, so with no DELETE policy every leave/remove attempt is silently
-- rejected (0 rows affected, no PostgREST error). The client thinks the
-- delete succeeded, updates local state, and on the next server refresh
-- the group reappears.
--
-- Fix: recreate the DELETE policy so:
--   - a user can always remove their OWN membership row (leave group)
--   - group admins can remove any member row from a group they admin
--
-- Uses a SECURITY DEFINER helper (`is_user_admin_of_group`) to avoid
-- self-recursion into `chat_group_members` when evaluating admin status,
-- mirroring the pattern already used by `is_user_member_of_group`.
-- ============================================

CREATE OR REPLACE FUNCTION public.is_user_admin_of_group(p_group_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_group_members
    WHERE group_id = p_group_id
      AND user_id = p_user_id
      AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_user_admin_of_group(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_admin_of_group(uuid, uuid) TO anon;

DROP POLICY IF EXISTS "Admins can remove members, users can leave" ON public.chat_group_members;
DROP POLICY IF EXISTS "Members can delete their own membership"     ON public.chat_group_members;
DROP POLICY IF EXISTS "Users can leave groups"                       ON public.chat_group_members;

CREATE POLICY "Admins can remove members, users can leave"
  ON public.chat_group_members
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_user_admin_of_group(group_id, auth.uid())
  );
