-- Stop authenticated users from reading the whole legacy membership table.
--
-- Writes were closed already (channel_members_insert/update/delete_self_only),
-- but SELECT was still wide open: "Allow authenticated users to view channel
-- members", "Enable read access for authenticated users" and "Allow all
-- operations for authenticated users" all reduce to "a session exists", so any
-- account could enumerate who belongs to which channel.
--
-- Scoped to the caller's own membership rows rather than "everyone in the
-- channels I am in", for two reasons: every live caller already filters that
-- way - BreakingNewsTab loads .eq('user_id', user.id) to build the group
-- picker, RegisterScreen.addUserToDefaultChannels checks its own row before
-- inserting - and a policy on channel_members that queries channel_members
-- recurses (42P17) unless it is routed through a SECURITY DEFINER helper,
-- which would be a wider surface than anything here needs.
--
-- Own-row visibility is also what the neighbouring policies depend on: the
-- messages and channels SELECT policies test `cm.user_id = auth.uid()`, which
-- stays visible under this rule.

drop policy if exists channel_members_select_self_only on public.channel_members;
create policy channel_members_select_self_only
  on public.channel_members
  as restrictive
  for select
  to public
  using (user_id = (select auth.uid()));
