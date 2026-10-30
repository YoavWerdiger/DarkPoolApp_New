-- לוח הדוחות באפליקציה: רק חברות בשווי שוק 2B+ ונפח מסחר ממוצע 1M+ מניות ליום — בכל התאריכים, גם עתידיים.
-- הסינון בסנכרון חל רק על שורות חדשות, והניקוי הלילי לא נוגע בשווי לא ידוע — ולכן חברות קטנות עדיין הופיעו.
-- view לקריאה בלבד: לא מוחק כלום מהטבלה. שווי לא ידוע נכנס רק אם המקור עצמו דיווח 2B+.
create or replace view public.earnings_calendar_curated
with (security_invoker = true) as
select e.*
from public.earnings_calendar e
left join public.stock_market_caps c
  on c.symbol = public.earnings_cap_symbol(e.ticker, e.code)
where coalesce(nullif(c.market_cap, 0), e.market_cap, 0) >= 2000000000
  and (c.avg_volume is null or c.avg_volume >= 1000000);

grant select on public.earnings_calendar_curated to authenticated;
