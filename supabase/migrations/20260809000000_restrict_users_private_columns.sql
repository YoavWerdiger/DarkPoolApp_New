-- Stop authenticated users from reading each other's email, phone and questionnaire.
--
-- public.users still carried "Allow authenticated users to view users"
-- (auth.uid() IS NOT NULL), so any registered account could read the whole
-- table: 12 email addresses and 3 phone numbers, plus intro_data (the
-- onboarding questionnaire), moderation state and subscription state.
--
-- Why column privileges and not a row filter + SECURITY DEFINER view:
-- the client embeds public.users through PostgREST in ~23 places
-- (sender:users!chat_messages_sender_id_fkey, user:users on chat_group_members,
-- ...). Locking the table to "own row only" would make every one of those
-- embeds silently resolve to null - names and avatars would vanish from chat
-- with no error anywhere. Routing them at a view was measured against the real
-- API instead of assumed:
--   * a view declared directly over public.users IS embeddable by PostgREST,
--     but with security_invoker off it raises the `security_definer_view`
--     advisor at ERROR level, and the brief requires 0 ERROR advisors;
--   * chaining a security_invoker view over a SECURITY DEFINER view in an
--     unexposed schema keeps advisors clean but is NOT embeddable -
--     PostgREST answers PGRST200 "Could not find a relationship".
-- Column privileges have neither problem: rows stay visible so every embed
-- keeps working untouched, the private columns become unreachable, and a
-- mistake fails loudly with 42501 instead of quietly returning less data.
--
-- Own-row access to the private columns moves to get_my_profile() below.

revoke select on public.users from anon, authenticated;

grant select (
  id,
  full_name,
  display_name,
  profile_picture,
  avatar_url,
  is_online,
  last_active,
  last_seen,
  created_at
) on public.users to anon, authenticated;

-- The directory surface for "somebody else's profile". Same columns as the
-- grant above, security_invoker so it inherits users' RLS and never becomes a
-- way around it. Anything a caller may not read is simply not in here, so a
-- future `select('*')` against it cannot leak.
drop view if exists public.v_public_profiles;
create view public.v_public_profiles
  with (security_invoker = true) as
select
  u.id,
  u.full_name,
  u.display_name,
  u.profile_picture,
  u.avatar_url,
  u.is_online,
  u.last_active,
  u.last_seen,
  u.created_at
from public.users u;

revoke all on public.v_public_profiles from anon;
grant select on public.v_public_profiles to authenticated;

comment on view public.v_public_profiles is
  'Publicly visible profile fields for any authenticated caller. Read other people from here; public.users only answers with these same columns and keeps the private ones for get_my_profile().';

-- The caller's own row, private columns included. SECURITY DEFINER because
-- authenticated no longer holds the column privileges, and hard-wired to
-- auth.uid() so it can never return anybody else.
create or replace function public.get_my_profile()
returns setof public.users
language sql
stable
security definer
set search_path = public
as $$
  select u.* from public.users u where u.id = (select auth.uid());
$$;

revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;

comment on function public.get_my_profile() is
  'Own public.users row with the private columns (email, phone, intro_data, subscription and moderation state). Scoped to auth.uid().';

notify pgrst, 'reload schema';
