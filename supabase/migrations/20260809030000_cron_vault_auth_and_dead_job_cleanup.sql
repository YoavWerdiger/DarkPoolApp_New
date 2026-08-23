-- Remove plaintext JWTs from cron.job and retire the cron jobs that never worked.
--
-- Two separate problems were found in cron.job:
--
-- 1. Eleven job commands embedded the project anon key as a literal string in
--    the command body. cron.job is a plain table: anyone able to read it gets
--    the key, and it also leaks into pg_dump, logical backups and the SQL
--    editor's history. anon is additionally the wrong identity for a cron job,
--    which is a trusted internal caller, not a browser.
--
-- 2. Jobs 13-16 shipped with the literal placeholder 'YOUR_ANON_KEY', so they
--    have been sending "Authorization: Bearer YOUR_ANON_KEY" since the day they
--    were created. cron.job_run_details recorded them as 'succeeded' the whole
--    time because net.http_post only enqueues the request and returns an id --
--    the HTTP status never reaches pg_cron. That is why nothing ever alerted.
--
-- The fix for (1) follows the pattern already used by the twelve working
-- invoke_* wrappers in this project (invoke_sync_darkpool, invoke_broker_colmex_sync,
-- invoke_daily_earnings_sync_v2, ...): a SECURITY DEFINER function that reads
-- SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY out of vault.decrypted_secrets at
-- call time and never stores a token anywhere. Both secrets already exist in
-- the vault. The cron command becomes a bare SELECT with no credential in it.
--
-- service_role satisfies verify_jwt on every function targeted here, and none
-- of them read the incoming Authorization header (verified by grepping
-- req.headers.get('authorization') across supabase/functions -- only the
-- user-facing broker/admin/chat functions do, and none of those are called by
-- cron except broker-colmex-sync, which already uses its own vault wrapper and
-- is deliberately left untouched so its recent auth hardening is preserved).
--
-- EXECUTE is revoked from anon/authenticated to match
-- 20260809021500_restrict_function_execute_grants.sql, which excludes every
-- invoke_% function from the authenticated grant.

begin;

-- ---------------------------------------------------------------------------
-- 1. Vault-backed wrappers for the jobs that work and must keep working.
-- ---------------------------------------------------------------------------

create or replace function public.invoke_fear_greed_update()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_url        text;
  v_key        text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;

  if v_url is null or v_key is null then
    raise warning 'invoke_fear_greed_update: missing vault secrets';
    return null;
  end if;

  select net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/fear-greed-update',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

create or replace function public.invoke_daily_economic_sync_simple()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_url        text;
  v_key        text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;

  if v_url is null or v_key is null then
    raise warning 'invoke_daily_economic_sync_simple: missing vault secrets';
    return null;
  end if;

  select net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/daily-economic-sync-simple',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

create or replace function public.invoke_update_economic_results()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_url        text;
  v_key        text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;

  if v_url is null or v_key is null then
    raise warning 'invoke_update_economic_results: missing vault secrets';
    return null;
  end if;

  select net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/update-economic-results',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

create or replace function public.invoke_benzinga_economics_sync()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_url        text;
  v_key        text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;

  if v_url is null or v_key is null then
    raise warning 'invoke_benzinga_economics_sync: missing vault secrets';
    return null;
  end if;

  select net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/benzinga-economics-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

-- economic-scheduler routes on the path suffix, so the sub-path is part of the URL.
create or replace function public.invoke_economic_scheduler_update()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_url        text;
  v_key        text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;

  if v_url is null or v_key is null then
    raise warning 'invoke_economic_scheduler_update: missing vault secrets';
    return null;
  end if;

  select net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/economic-scheduler/update-economic-data',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

create or replace function public.invoke_benzinga_update_results_live()
returns bigint
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_url        text;
  v_key        text;
  v_request_id bigint;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;

  if v_url is null or v_key is null then
    raise warning 'invoke_benzinga_update_results_live: missing vault secrets';
    return null;
  end if;

  select net.http_post(
    url     := rtrim(v_url, '/') || '/functions/v1/benzinga-update-results-live',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  ) into v_request_id;

  return v_request_id;
end;
$function$;

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'invoke_fear_greed_update',
        'invoke_daily_economic_sync_simple',
        'invoke_update_economic_results',
        'invoke_benzinga_economics_sync',
        'invoke_economic_scheduler_update',
        'invoke_benzinga_update_results_live'
      )
  loop
    execute format('revoke execute on routine %s from public, anon, authenticated', r.sig);
    execute format('grant execute on routine %s to service_role', r.sig);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Re-point the working jobs at the wrappers. alter_job keeps the jobid and
--    the run history, so before/after can be compared in job_run_details.
-- ---------------------------------------------------------------------------

do $$
declare
  mapping constant text[][] := array[
    ['fear-greed-index-update',       'SELECT public.invoke_fear_greed_update();'],
    ['daily-economic-sync-simple',    'SELECT public.invoke_daily_economic_sync_simple();'],
    ['update-economic-results-live',  'SELECT public.invoke_update_economic_results();'],
    ['benzinga-economics-sync',       'SELECT public.invoke_benzinga_economics_sync();'],
    ['benzinga-economic-scheduler',   'SELECT public.invoke_economic_scheduler_update();'],
    ['benzinga-update-results-live',  'SELECT public.invoke_benzinga_update_results_live();'],
    -- Both already target daily-earnings-sync-v2; reuse the wrapper that jobs
    -- earnings-sync-bmo-window / earnings-sync-amc-window have been using.
    ['benzinga-earnings-sync-morning','SELECT public.invoke_daily_earnings_sync_v2();'],
    ['benzinga-earnings-sync-evening','SELECT public.invoke_daily_earnings_sync_v2();']
  ];
  i int;
  v_jobid bigint;
  n int := 0;
begin
  for i in 1 .. array_length(mapping, 1) loop
    select jobid into v_jobid from cron.job where jobname = mapping[i][1];

    if v_jobid is null then
      raise warning 'cron job % not found, skipping', mapping[i][1];
      continue;
    end if;

    perform cron.alter_job(job_id => v_jobid, command => mapping[i][2]);
    n := n + 1;
  end loop;

  raise notice 're-pointed % cron job(s) at vault-backed wrappers', n;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Retire the jobs that have never done anything.
--
-- daily-earnings-trends-sync / daily-ipos-sync / daily-splits-sync /
-- daily-dividends-sync (13-16) and smart-economic-poller (12) all POST to Edge
-- Functions that are not deployed to this project -- the source exists under
-- supabase/functions but was never pushed, so the gateway answers
-- {"code":"NOT_FOUND","message":"Requested function was not found"}. That 404
-- is visible in net._http_response for smart-economic-poller, the only one of
-- the five whose schedule falls inside the response retention window.
--
-- Repairing the Authorization header would not make them work:
--   * the functions are not deployed (404 happens before any auth check);
--   * their destination tables ipos_calendar / splits_calendar /
--     dividends_calendar / earnings_trends do not exist in this database;
--   * the screens that would read them (screens/News/IPOsTab.tsx, SplitsTab.tsx,
--     DividendsTab.tsx, EarningsTrendsTab.tsx) are not imported from anywhere,
--     so nothing in the app consumes this data.
-- smart-economic-poller is additionally redundant: economic_events is already
-- populated by daily-economic-sync-simple, benzinga-economics-sync,
-- benzinga-economic-scheduler and update-economic-results-live, all healthy.
--
-- daily-earnings-sync (11) and benzinga-earnings-sync-daily (28) are already
-- active=false and have not run since 2026-04-24; daily-earnings-sync has been
-- superseded by daily-earnings-sync-v2. They are unscheduled rather than left
-- disabled because a disabled row still stores the anon key in plaintext.
--
-- Unscheduling only drops the schedule; the Edge Function sources and this
-- migration's comments are enough to re-create any of them with
-- cron.schedule(...) if the feature is ever finished and deployed.
-- ---------------------------------------------------------------------------

do $$
declare
  dead constant text[] := array[
    'daily-earnings-sync',           -- inactive since 2026-04-24, superseded by v2
    'smart-economic-poller',         -- 404: function not deployed; redundant
    'daily-earnings-trends-sync',    -- 404 + no table + no consumer
    'daily-ipos-sync',               -- 404 + no table + no consumer
    'daily-splits-sync',             -- 404 + no table + no consumer
    'daily-dividends-sync',          -- 404 + no table + no consumer
    'benzinga-earnings-sync-daily'   -- inactive since 2026-04-24, duplicate of -morning
  ];
  name text;
  n int := 0;
begin
  foreach name in array dead loop
    if exists (select 1 from cron.job where jobname = name) then
      perform cron.unschedule(name);
      n := n + 1;
    end if;
  end loop;

  raise notice 'unscheduled % dead cron job(s)', n;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Guard: no credential-shaped literal may remain in any cron command, and
--    nothing may still be pointing at the unreplaced placeholder.
-- ---------------------------------------------------------------------------

do $$
declare
  offenders text;
begin
  select string_agg(jobname, ', ')
    into offenders
  from cron.job
  where command ~ 'ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
     or command like '%YOUR_ANON_KEY%'
     or command ~* 'service_role_key\s*[:=]'
     or command ~* 'apikey["'']?\s*[:,]\s*["'']ey';

  if offenders is not null then
    raise exception 'cron.job still contains an inline credential: %', offenders;
  end if;
end
$$;

commit;
