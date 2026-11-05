-- ריג'קט 05.11.2026: לוח הדוחות (והפושים) — רק שווי שוק 3B+ וגם נפח ממוצע 3M+ מניות ליום (היה 2B / 1M).
-- view לקריאה בלבד: לא מוחק כלום מהטבלה.
create or replace view public.earnings_calendar_curated
with (security_invoker = true) as
select e.*
from public.earnings_calendar e
left join public.stock_market_caps c
  on c.symbol = public.earnings_cap_symbol(e.ticker, e.code)
where coalesce(nullif(c.market_cap, 0), e.market_cap, 0) >= 3000000000
  and coalesce(c.avg_volume, 0) >= 3000000;

grant select on public.earnings_calendar_curated to authenticated, service_role;
