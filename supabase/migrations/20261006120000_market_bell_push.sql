-- פוש פתיחה/סגירה של וול סטריט (הוחל דרך MCP ב-2026-10-06). ראה supabase/functions/market-bell-push.
create table if not exists public.market_bell_log (
  trade_date date not null,
  kind text not null check (kind in ('open','close')),
  title text,
  sent_count int default 0,
  failed_count int default 0,
  created_at timestamptz not null default now(),
  primary key (trade_date, kind)
);
alter table public.market_bell_log enable row level security;

create or replace function public.invoke_market_bell_push()
returns bigint language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text; v_request_id bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;
  if v_url is null or v_key is null then raise warning 'invoke_market_bell_push: missing vault secrets'; return null; end if;
  select net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/market-bell-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb
  ) into v_request_id;
  return v_request_id;
end; $$;
revoke all on function public.invoke_market_bell_push() from public, anon, authenticated;

-- כל 5 דקות בימי חול, 13:00–21:55 UTC — מכסה 09:30 ו-16:00 בניו יורק בשעון קיץ וחורף
select cron.schedule('market-bell-push', '*/5 13-21 * * 1-5', $$select public.invoke_market_bell_push();$$);
