-- 13F ישירות מ-SEC EDGAR (sync-fund-13f-sec) — לקרנות ש-Quiver לא מחזיר להן אחזקות (TCI, D1).
-- CUSIP → טיקר דרך OpenFIGI, עם cache בטבלה.
create table if not exists public.cusip_ticker_map (
  cusip text primary key,
  ticker text,
  name text,
  security_type text,
  source text not null default 'openfigi',
  updated_at timestamptz not null default now()
);
alter table public.cusip_ticker_map enable row level security;
revoke all on public.cusip_ticker_map from anon, authenticated;

create or replace function public.invoke_sync_fund_13f_sec()
returns bigint language plpgsql security definer set search_path = public, extensions, vault as $$
declare v_url text; v_key text; v_req bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;
  if v_url is null or v_key is null then return null; end if;
  select net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/sync-fund-13f-sec',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{"filings":8}'::jsonb,
    timeout_milliseconds := 150000
  ) into v_req;
  return v_req;
end; $$;
revoke execute on function public.invoke_sync_fund_13f_sec() from public, anon, authenticated;
select cron.schedule('sync-fund-13f-sec-daily', '30 6 * * *', $$ select public.invoke_sync_fund_13f_sec(); $$);

-- דאליו / סורוס לא מנהלים את הקרנות — שם הקרן ולא האדם
update public.dark_pool_fund_managers set manager_name = 'Bridgewater Associates' where cik = '1350694';
update public.dark_pool_fund_managers set manager_name = 'Soros Fund Management' where cik = '1029160';
