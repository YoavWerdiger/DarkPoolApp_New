-- (הוחל בשרת דרך MCP ב-2026-10-08; נשמר כאן לגיבוי הריפו — זהה למה שרץ)
-- תיקון: «Finnhub לא מכיר» ≠ «קטן» (EQR/LC/SATS קיבלו 0 ונמחקו). ניסיונות כושלים נרשמים בנפרד.
delete from public.stock_market_caps where market_cap = 0;

create table if not exists public.market_cap_lookup_misses (
  symbol text primary key,
  attempted_at timestamptz not null default now()
);
alter table public.market_cap_lookup_misses enable row level security;

create or replace function public.earnings_symbols_missing_cap(p_limit int default 120)
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(sym), '{}') from (
    select e.sym from (
      select public.earnings_cap_symbol(ticker, code) as sym, min(report_date) as first_date
      from public.earnings_calendar
      where report_date >= current_date - 7
      group by 1
    ) e
    where e.sym is not null
      and not exists (select 1 from public.stock_market_caps c where c.symbol = e.sym)
      -- נבדק ב-24 השעות האחרונות בלי תוצאה — לא חוזרים עליו בכל ריצה
      and not exists (
        select 1 from public.market_cap_lookup_misses m
        where m.symbol = e.sym and m.attempted_at > now() - interval '24 hours'
      )
    order by e.first_date
    limit greatest(p_limit, 0)
  ) s;
$$;
revoke all on function public.earnings_symbols_missing_cap(int) from public, anon, authenticated;
