-- Cron hygiene follow-up + throwaway probe account cleanup.
--
-- 20260809030000 already re-pointed working jobs at vault wrappers and
-- unscheduled the dead YOUR_ANON_KEY jobs (13-16 and friends). This migration:
--   1. Asserts no credential / placeholder remains in cron.job.
--   2. Retires update-economic-results-live: vault auth is fine, but the Edge
--      Function returns HTTP 500 (EODHD API 401) every 15 minutes. The same
--      surface is already covered by benzinga-update-results-live (healthy).
--      Re-schedule with cron.schedule(...) once the EODHD secret is fixed if
--      the EODHD path is still wanted alongside Benzinga.
--   3. Deletes only auth.users rows whose email ends in @example.invalid
--      (RLS / password-reset probe leftovers). Real users are untouched.

begin;

-- ---------------------------------------------------------------------------
-- 1. Guard: no inline credentials / placeholders in cron commands.
-- ---------------------------------------------------------------------------
do $$
declare
  offenders text;
begin
  select string_agg(jobname, ', ' order by jobname)
    into offenders
  from cron.job
  where command like '%YOUR_ANON_KEY%'
     or command ~ 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
     or command ~* 'service_role_key\s*[:=]'
     or command ~* 'apikey["'']?\s*[:,]\s*["'']ey';

  if offenders is not null then
    raise exception 'cron.job still contains an inline credential: %', offenders;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Retire the broken EODHD economic-results poller (soft duplicate).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'update-economic-results-live') then
    perform cron.unschedule('update-economic-results-live');
    raise notice 'unscheduled update-economic-results-live (EODHD 401; covered by benzinga-update-results-live)';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Delete @example.invalid probe accounts only.
-- ---------------------------------------------------------------------------
do $$
declare
  n_before int;
  n_deleted int;
  n_after int;
  sample text;
begin
  -- Domain must be exactly example.invalid (not foo@example.invalid.evil.com).
  select count(*) into n_before
  from auth.users
  where lower(split_part(email, '@', 2)) = 'example.invalid';

  select string_agg(email, ', ' order by created_at)
    into sample
  from (
    select email, created_at
    from auth.users
    where lower(split_part(email, '@', 2)) = 'example.invalid'
    order by created_at
    limit 20
  ) s;

  raise notice 'example.invalid auth.users before delete: % (sample: %)', n_before, coalesce(sample, '<none>');

  if n_before = 0 then
    raise notice 'nothing to delete';
    return;
  end if;

  delete from auth.users
  where lower(split_part(email, '@', 2)) = 'example.invalid';

  get diagnostics n_deleted = row_count;

  select count(*) into n_after
  from auth.users
  where lower(split_part(email, '@', 2)) = 'example.invalid';

  raise notice 'deleted % auth.users (@example.invalid); remaining=%', n_deleted, n_after;

  if n_after <> 0 then
    raise exception 'expected 0 @example.invalid users after delete, found %', n_after;
  end if;
end
$$;

commit;
