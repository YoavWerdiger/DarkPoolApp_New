-- Lock down EXECUTE on public functions.
--
-- Supabase's default privileges grant EXECUTE on every new function in public to
-- anon and authenticated, so a SECURITY DEFINER function is reachable by an
-- unauthenticated caller the moment it is created. That is how
-- broker_get_vault_secret ended up callable by anon while explicitly revoked
-- from authenticated: the earlier hardening pass revoked authenticated but the
-- anon grant from the default ACL survived.
--
-- Policy applied here:
--   1. Trigger functions get no EXECUTE for anyone. Postgres checks EXECUTE when
--      CREATE TRIGGER runs, never when the trigger fires, so this is inert.
--   2. anon is default-deny with a verified allowlist.
--   3. authenticated keeps what it has, minus the operational / test / cron /
--      vault surface that only the service role or pg_cron ever calls.
--   4. service_role keeps everything it already had.
--   5. Default privileges stop handing anon EXECUTE on future functions.
--
-- The allowlists below were derived by enumerating every `.rpc()` call in the
-- repository (no dynamic RPC names exist) and every function referenced from an
-- RLS policy, view, constraint, default or index.

do $$
declare
  r record;
  -- anon runs exactly two pre-login flows plus the RLS predicates that a
  -- PUBLIC-role policy on chat_group_members evaluates for anonymous requests.
  anon_allowlist constant text[] := array[
    'check_email_exists',        -- services/authService.ts: e-mail availability before signUp
    'check_phone_exists',        -- services/authService.ts: phone availability before signUp
    'is_user_member_of_group',   -- chat_group_members policy "Members can view group memberships" (PUBLIC)
    'is_user_admin_of_group'     -- chat_group_members policy "Admins can remove members..." (PUBLIC)
  ];
  -- Reached only by service-role Edge Functions or pg_cron. No app call site.
  authenticated_denylist constant text[] := array[
    '_push_test_invoke_processor',
    'add_user_to_basic_groups',                 -- fired by trigger_add_user_to_basic_groups
    'archive_old_messages',                     -- cron: archive-old-messages
    'atomic_rate_check',                        -- chat-send-message (adminClient/service role)
    'auto_cleanup_expired_data',
    'broker_delete_vault_secret',               -- broker-colmex-disconnect (service role)
    'broker_get_vault_secret',                  -- broker-colmex-sync (service role)
    'broker_upsert_vault_secret',               -- broker-colmex-connect (service role)
    'cleanup_chat_mock_unread',
    'cleanup_non_sp500_earnings',
    'cleanup_old_economic_events',              -- economic-scheduler (service role)
    'cleanup_old_typing_indicators',
    'cleanup_rate_limits',
    'ingest_broker_executions_to_portfolio',    -- broker-colmex-sync (service role)
    'ingest_broker_statements_to_portfolio',    -- broker-colmex-sync (service role)
    'insert_test_breaking_news',
    'news_push_diagnostics',
    'push_notifications_test_diagnostics',
    'push_processor_release_lock',              -- process-pending-notifications (service role)
    'push_processor_try_lock',                  -- process-pending-notifications (service role)
    'reconcile_colmex_opening_deposit',         -- broker-colmex-sync (service role)
    'renew_expired_subscriptions',
    'skip_stale_economic_pending_notifications',
    'trigger_earnings_sync',
    'trigger_earnings_sync_v2',
    'trigger_economics_sync',
    'trigger_economics_update_live',
    'update_channel_member_count',
    'upsert_daily_snapshot'                     -- broker-colmex-sync (service role)
  ];
  is_trigger_fn boolean;
  had_authenticated boolean;
  had_service_role boolean;
  keep_authenticated boolean;
  n_trigger int := 0;
  n_anon_revoked int := 0;
  n_auth_revoked int := 0;
begin
  for r in
    select p.oid,
           p.oid::regprocedure as sig,
           p.proname,
           p.prorettype = 'pg_catalog.trigger'::regtype as trig
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public'
      and p.prokind in ('f', 'p')
      and not exists (
        select 1
        from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
      )
    order by p.proname
  loop
    is_trigger_fn := r.trig;
    had_authenticated := has_function_privilege('authenticated', r.oid, 'EXECUTE');
    had_service_role := has_function_privilege('service_role', r.oid, 'EXECUTE');

    if has_function_privilege('anon', r.oid, 'EXECUTE')
       and not (r.proname = any (anon_allowlist)) then
      n_anon_revoked := n_anon_revoked + 1;
    end if;

    -- Strip the blanket PUBLIC grant that the default ACL leaves behind, then
    -- put back only what is actually needed.
    execute format('revoke execute on routine %s from public, anon, authenticated', r.sig);

    if had_service_role then
      execute format('grant execute on routine %s to service_role', r.sig);
    end if;

    if is_trigger_fn then
      n_trigger := n_trigger + 1;
      continue;
    end if;

    if r.proname = any (anon_allowlist) then
      execute format('grant execute on routine %s to anon', r.sig);
    end if;

    keep_authenticated := had_authenticated
      and not (r.proname = any (authenticated_denylist))
      and r.proname not like 'invoke\_%'
      and r.proname not like 'test\_%';

    if keep_authenticated then
      execute format('grant execute on routine %s to authenticated', r.sig);
    elsif had_authenticated then
      n_auth_revoked := n_auth_revoked + 1;
    end if;
  end loop;

  raise notice 'trigger functions stripped: %, anon revoked: %, authenticated revoked: %',
    n_trigger, n_anon_revoked, n_auth_revoked;
end
$$;

-- Future functions created by migrations must not silently become anon-callable.
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- Guard: the pre-login flows must survive this migration.
do $$
declare
  missing text;
begin
  select string_agg(fn, ', ')
    into missing
  from unnest(array['check_email_exists', 'check_phone_exists']) fn
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = fn
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  );

  if missing is not null then
    raise exception 'pre-login RPC lost anon EXECUTE: %', missing;
  end if;
end
$$;

notify pgrst, 'reload schema';
