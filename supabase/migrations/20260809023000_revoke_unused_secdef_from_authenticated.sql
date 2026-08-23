-- Close the remaining SECURITY DEFINER surface that authenticated clients can
-- reach but never call.
--
-- Each function below bypasses RLS by definition, and most take a user,
-- portfolio or message id as a parameter, so any logged-in user could pass
-- someone else's id and read across the tenant boundary. get_daily_pnl and
-- get_monthly_pnl return another user's P&L; get_chat_messages and
-- search_chat_messages return messages from groups the caller never joined.
--
-- Verification performed before revoking, for every name in this list:
--   * no `.rpc('<name>')` call anywhere in the repository, and no dynamic RPC
--     names exist (every call site is a string literal);
--   * no reference from any RLS policy, view, constraint, column default or
--     index (pg_depend);
--   * not invoked by an Edge Function (all of which use the service role and
--     keep their grants here).
--
-- The only textual hit for increment_unread_count is a comment in
-- chat-send-message that explicitly says not to call it: the unread badge is
-- maintained by the after_chat_message_insert_unread trigger, and a trigger
-- does not consult EXECUTE privileges.
--
-- service_role and postgres retain EXECUTE, so cron jobs, Edge Functions and
-- the trigger paths that call these internally are unaffected. Re-granting is a
-- one-line GRANT if a future feature needs one of them from the client.

do $$
declare
  target text;
  unused_secdef constant text[] := array[
    'add_user_to_viewed_by',
    'append_user_to_deleted_array',
    'finalize_quiz',
    'get_chat_messages',
    'get_current_user_id',
    'get_current_user_info',
    'get_daily_pnl',
    'get_message_reactions',
    'get_message_with_reactions',
    'get_messages_with_deletion_filter',
    'get_messages_with_reactions_new',
    'get_monthly_pnl',
    'get_pinned_messages',
    'get_poll_with_user_votes',
    'get_reaction_details',
    'get_signed_media_url',
    'get_starred_messages',
    'increment_unread_count',
    'is_message_deleted_for_user',
    'is_message_starred',
    'is_user_authenticated',
    'recalc_portfolio_stats',
    'safe_add_reaction',
    'safe_remove_reaction',
    'safe_toggle_reaction',
    'search_chat_messages',
    'toggle_reaction',
    'update_poll_vote_counts'
  ];
  r record;
  n int := 0;
begin
  foreach target in array unused_secdef loop
    for r in
      select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
      where ns.nspname = 'public'
        and p.proname = target
    loop
      execute format('revoke execute on routine %s from public, anon, authenticated', r.sig);
      n := n + 1;
    end loop;
  end loop;

  raise notice 'revoked authenticated EXECUTE on % routine(s)', n;
end
$$;

-- Guard: everything the app actually calls must survive.
do $$
declare
  broken text;
  app_rpcs constant text[] := array[
    'check_email_exists',
    'check_phone_exists',
    'claim_device_push_token',
    'complete_user_registration',
    'get_last_messages_for_groups',
    'get_message_viewers',
    'get_user_display_names',
    'range_recalc_snapshots',
    'reset_portfolio',
    'reset_unread_count',
    'set_chat_group_viewing',
    'sync_broker_positions_to_trades',
    'toggle_group_mute',
    -- RLS policy predicates: a missing grant turns every read on the guarded
    -- table into "permission denied for function".
    'is_app_admin',
    'is_user_admin_of_group',
    'is_user_member_of_group'
  ];
begin
  select string_agg(fn, ', ')
    into broken
  from unnest(app_rpcs) fn
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = fn
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  );

  if broken is not null then
    raise exception 'app RPC lost authenticated EXECUTE: %', broken;
  end if;
end
$$;

notify pgrst, 'reload schema';
