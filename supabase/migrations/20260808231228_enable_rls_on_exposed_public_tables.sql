-- Close anon read/write access to six public tables that had RLS switched off.
--
-- Five of them (users, channel_members, messages, polls, poll_votes) already carried
-- policies that were never enforced because relrowsecurity was false; the sixth
-- (user_channel_state) had no policies at all. Verified with the packaged anon key
-- that all six were fully readable and that users accepted anon INSERT and UPDATE.
--
-- No existing policy is dropped. Where a permissive policy is too wide for anon,
-- a RESTRICTIVE policy is added instead: restrictive policies AND with the
-- permissive set, so the legitimate authenticated paths keep working.

-- ---------------------------------------------------------------------------
-- users -- 13 rows including email and phone, readable and writable by anon.
--
-- After enabling RLS the existing policies already deny anon SELECT/UPDATE/DELETE
-- (every one requires auth.uid() IS NOT NULL). The remaining gap is
-- "Allow insert for all" (WITH CHECK true, role public), which still lets anon
-- create arbitrary rows. auth.signUp returns a session immediately, so the
-- registration upsert runs authenticated with id = auth.uid() and is unaffected.
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;

drop policy if exists users_insert_self_only on public.users;
create policy users_insert_self_only
  on public.users
  as restrictive
  for insert
  to public
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- channel_members -- legacy channel membership, still read by BreakingNewsTab.
--
-- The "Allow all operations for authenticated users" policy covers every
-- authenticated path. "Allow insert to all" (WITH CHECK true, role public) is the
-- anon gap; the only insert site in the app writes the caller's own user_id.
-- ---------------------------------------------------------------------------
alter table public.channel_members enable row level security;

drop policy if exists channel_members_insert_self_only on public.channel_members;
create policy channel_members_insert_self_only
  on public.channel_members
  as restrictive
  for insert
  to public
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- messages -- legacy channel messages, written by BreakingNewsTab.
--
-- Existing policies already deny anon on every command: SELECT requires
-- auth.uid() IS NOT NULL, INSERT requires sender_id = auth.uid(), UPDATE and
-- DELETE require ownership. Nothing to add.
-- ---------------------------------------------------------------------------
alter table public.messages enable row level security;

-- ---------------------------------------------------------------------------
-- polls -- the existing SELECT policy joins channel_members, but all 29 polls
-- live in chat_groups groups and only 14 are reachable through channel_members.
-- Enabling RLS without a chat_group_members-aware policy would silently hide
-- 15 of them, so that policy is added before RLS goes on.
--
-- is_user_member_of_group is SECURITY DEFINER, which avoids recursing into
-- chat_group_members' own policies.
-- ---------------------------------------------------------------------------
drop policy if exists polls_group_members_select on public.polls;
create policy polls_group_members_select
  on public.polls
  for select
  to authenticated
  using (public.is_user_member_of_group(chat_id, (select auth.uid())));

-- "Authenticated users can create polls" only checks that a session exists, so a
-- poll could be created under someone else's name. Pin the creator to the caller.
drop policy if exists polls_insert_creator_is_self on public.polls;
create policy polls_insert_creator_is_self
  on public.polls
  as restrictive
  for insert
  to public
  with check (creator_id = (select auth.uid()));

alter table public.polls enable row level security;

-- ---------------------------------------------------------------------------
-- poll_votes -- same channel_members/chat_group_members mismatch as polls.
--
-- The existing INSERT policy checks group membership but never checks that
-- user_id is the caller, so one member could vote as another. Both the RN and
-- Swift clients always write the current user's id.
-- ---------------------------------------------------------------------------
drop policy if exists poll_votes_group_members_select on public.poll_votes;
create policy poll_votes_group_members_select
  on public.poll_votes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.polls p
      where p.id = poll_votes.poll_id
        and public.is_user_member_of_group(p.chat_id, (select auth.uid()))
    )
  );

drop policy if exists poll_votes_group_members_insert on public.poll_votes;
create policy poll_votes_group_members_insert
  on public.poll_votes
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.polls p
      where p.id = poll_votes.poll_id
        and public.is_user_member_of_group(p.chat_id, (select auth.uid()))
    )
  );

drop policy if exists poll_votes_insert_voter_is_self on public.poll_votes;
create policy poll_votes_insert_voter_is_self
  on public.poll_votes
  as restrictive
  for insert
  to public
  with check (user_id = (select auth.uid()));

alter table public.poll_votes enable row level security;

-- ---------------------------------------------------------------------------
-- user_channel_state -- legacy per-user read markers, superseded by
-- chat_group_members. No policies existed and no client, edge function or DB
-- function references it, so owner-scoped policies are added for correctness
-- rather than to preserve a live flow.
-- ---------------------------------------------------------------------------
drop policy if exists user_channel_state_owner_all on public.user_channel_state;
create policy user_channel_state_owner_all
  on public.user_channel_state
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.user_channel_state enable row level security;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER views over portfolio and broker data.
--
-- These run as the view owner, so RLS on portfolios, portfolio_transactions and
-- the broker_* tables never applied and anon could read every user's holdings,
-- cash flow and account balances. security_invoker makes the caller's RLS apply,
-- which is what the callers in portfolioService/brokerService already assume.
-- Owners keep full access, and portfolios_public_read / portfolio_tx_public_read
-- keep the community portfolio views working.
-- ---------------------------------------------------------------------------
alter view public.v_broker_portfolio_summary set (security_invoker = true);
alter view public.v_portfolio_cash_flow set (security_invoker = true);
alter view public.v_portfolio_holdings_raw set (security_invoker = true);
