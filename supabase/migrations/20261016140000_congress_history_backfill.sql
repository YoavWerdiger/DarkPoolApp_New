-- השלמת היסטוריה לכל חברי הקונגרס עם עסקאות (Quiver: 256), לא רק 20 ה«מאוצרים».
-- sync-congress-backfill (cron כל 20 דק', 6 בכל ריצה) — אחרי ההשלמה ה-cron לא קורא לפונקציה (אין ממתינים).
create table if not exists public.congress_backfill_state (
  bioguide text primary key,
  name text,
  trade_count int,
  status text not null,          -- ok / empty / error
  rows_upserted int not null default 0,
  error text,
  processed_at timestamptz not null default now()
);
alter table public.congress_backfill_state enable row level security;
revoke all on public.congress_backfill_state from anon, authenticated;

create or replace function public.congress_backfill_pending(p_limit int default 5)
returns table(bioguide text, name text, trade_count int)
language sql stable security definer set search_path = public as $$
  select p->>'BioGuideID', p->>'Name', coalesce((p->>'TradeCount')::int, 0)
  from public.dark_pool_uw_snapshots s, jsonb_array_elements(s.payload->'politicians') p
  where s.cache_key = 'quiver_congress_politicians'
    and coalesce((p->>'TradeCount')::int, 0) > 0
    and coalesce(p->>'BioGuideID', '') <> ''
    and not exists (select 1 from public.congress_backfill_state b where b.bioguide = p->>'BioGuideID')
  order by coalesce((p->>'TradeCount')::int, 0) desc
  limit greatest(1, least(p_limit, 25));
$$;
revoke execute on function public.congress_backfill_pending(int) from public, anon, authenticated;

create or replace function public.invoke_sync_congress_backfill(p_limit int default 5)
returns bigint language plpgsql security definer set search_path = public, extensions, vault as $$
declare v_url text; v_key text; v_req bigint;
begin
  if not exists (select 1 from public.congress_backfill_pending(1)) then return null; end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;
  if v_url is null or v_key is null then return null; end if;
  select net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/sync-congress-backfill',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object('limit', p_limit),
    timeout_milliseconds := 150000
  ) into v_req;
  return v_req;
end; $$;
revoke execute on function public.invoke_sync_congress_backfill(int) from public, anon, authenticated;

select cron.schedule('sync-congress-backfill', '*/20 * * * *', $$ select public.invoke_sync_congress_backfill(6); $$);
