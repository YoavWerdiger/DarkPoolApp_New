-- Free users may see premium groups in the list, but must not be able to join them.
-- A group whose settings.allowed_tiers excludes 'free' (e.g. ["premium"]) requires
-- a paid subscription (has_paid_learning_access) or an app admin.

drop policy if exists "Members can insert their own membership"
  on public.chat_group_members;

create policy "Members can insert their own membership"
  on public.chat_group_members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.chat_groups g
      where g.id = chat_group_members.group_id
        and (
          jsonb_typeof(g.settings -> 'allowed_tiers') is distinct from 'array'
          or jsonb_array_length(g.settings -> 'allowed_tiers') = 0
          or (g.settings -> 'allowed_tiers') ? 'free'
          or public.has_paid_learning_access((select auth.uid()))
          or public.is_app_admin((select auth.uid()))
        )
    )
  );
