-- Stop authenticated users from reading legacy channel messages they are not in.
--
-- public.messages already had "View messages in own channels" scoped to
-- channel_members, but "messages_select_policy" (auth.uid() IS NOT NULL) sits
-- next to it and PERMISSIVE policies OR together, so the scoped one never
-- narrowed anything: all 413 rows were readable by any account.
--
-- The table is legacy. Every remaining client reference was checked:
--   * screens/News/BreakingNewsTab.tsx INSERTs a broadcast message into a
--     channel the sender picked from their own memberships (write path,
--     untouched here);
--   * the same screen lists 'messages' in an `alternativeTables` fallback that
--     only runs if app_news_clean errors, and treats it as news rows;
--   * nothing else selects from it - the live chat reads chat_messages.
-- So no screen depends on reading foreign channels, and the restrictive policy
-- below only removes rows nobody was meant to see.
--
-- Nothing is dropped: restrictive policies AND with the permissive set, so the
-- effective rule becomes "permissive set AND member of the channel".
--
-- The subquery is safe under the channel_members restriction added alongside
-- this migration: it only ever looks at the caller's own membership rows.

drop policy if exists messages_select_own_channels_only on public.messages;
create policy messages_select_own_channels_only
  on public.messages
  as restrictive
  for select
  to public
  using (
    exists (
      select 1
      from public.channel_members cm
      where cm.channel_id = messages.channel_id
        and cm.user_id = (select auth.uid())
    )
  );
