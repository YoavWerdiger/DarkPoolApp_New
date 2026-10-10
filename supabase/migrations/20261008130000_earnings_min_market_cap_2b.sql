-- (הוחל בשרת דרך MCP ב-2026-10-08; נשמר כאן לגיבוי הריפו — זהה למה שרץ)
-- דיווחי רווחים: רק חברות בשווי שוק 2B ומעלה (היה 1B)
create or replace function public.purge_small_cap_earnings()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.earnings_calendar e
  using public.stock_market_caps c
  where c.symbol = public.earnings_cap_symbol(e.ticker, e.code)
    and c.market_cap > 0
    and c.market_cap < 2000000000
    and e.report_date >= current_date
    and e.actual is null;
  get diagnostics n = row_count;
  return n;
end; $$;
revoke all on function public.purge_small_cap_earnings() from public, anon, authenticated;
