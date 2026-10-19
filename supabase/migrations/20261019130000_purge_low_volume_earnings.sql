-- גיבוי לפני הניקוי הראשון לפי נפח (692 דוחות עתידיים, 19.10.2026) — הוחל ידנית לפני הניקוי:
-- create table public.earnings_calendar_backup_low_volume_20261019 as
--   select e.*, c.avg_volume as backup_avg_volume, now() as backed_up_at
--   from public.earnings_calendar e join public.stock_market_caps c on c.symbol = public.earnings_cap_symbol(e.ticker, e.code)
--   where e.report_date >= current_date and e.actual is null and c.avg_volume < 1000000;

-- ניקוי לילי: דוחות עתידיים (בלי תוצאה) של חברות מתחת ל-2B שווי או מתחת ל-1M מניות נפח ממוצע ליום
create or replace function public.purge_small_cap_earnings()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare n integer;
begin
  delete from public.earnings_calendar e
  using public.stock_market_caps c
  where c.symbol = public.earnings_cap_symbol(e.ticker, e.code)
    and (
      (c.market_cap > 0 and c.market_cap < 2000000000)
      or (c.avg_volume is not null and c.avg_volume < 1000000)
    )
    and e.report_date >= current_date
    and e.actual is null;
  get diagnostics n = row_count;
  return n;
end; $function$;
