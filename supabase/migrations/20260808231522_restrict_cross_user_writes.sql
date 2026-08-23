-- Stop authenticated users from writing to other people's rows.
--
-- Enabling RLS closed the anon hole, but public.users still carried three
-- permissive ALL/UPDATE policies keyed only on "a session exists"
-- ("Allow all for authenticated users", "Allow all operations for authenticated
-- users", "Allow update for authenticated"). Verified with a real signed-in
-- session that a brand new account could PATCH all 13 user rows, and could have
-- deleted them. public.channel_members had the same shape via its
-- "Allow all operations for authenticated users" policy.
--
-- Again nothing is dropped: restrictive policies AND with the permissive set.
-- Every client write path to these tables is already scoped to the caller
-- (AuthService.updateProfile, RegistrationSummaryScreen.finalizeExistingUser,
-- paymentService, chatRealtimeService presence), and the admin and
-- delete-account paths run in Edge Functions on the service role key, which
-- bypasses RLS.

drop policy if exists users_update_self_only on public.users;
create policy users_update_self_only
  on public.users
  as restrictive
  for update
  to public
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists users_delete_self_only on public.users;
create policy users_delete_self_only
  on public.users
  as restrictive
  for delete
  to public
  using (id = (select auth.uid()));

drop policy if exists channel_members_update_self_only on public.channel_members;
create policy channel_members_update_self_only
  on public.channel_members
  as restrictive
  for update
  to public
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists channel_members_delete_self_only on public.channel_members;
create policy channel_members_delete_self_only
  on public.channel_members
  as restrictive
  for delete
  to public
  using (user_id = (select auth.uid()));
