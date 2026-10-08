-- דיווחי רווחים 1B+: השלמת שווי שוק שלא «נתקעת» + ניקוי דיווחים עתידיים של חברות קטנות.
-- (1) הבאקפיל חישב «חסר» מול רשימת ה-screener של אותו לילה בלבד → אותם 50 בכל לילה, השאר לעולם לא.
--     עכשיו: הרשימה מהמסד — סימבולים בדיווחים (7 ימים אחורה והלאה) בלי שורה ב-stock_market_caps.
-- (2) הסינון ב-sync חל רק על כתיבות חדשות — דיווח שנכנס לפני שהשווי נודע נשאר. purge מנקה אותם.

create or replace function public.earnings_cap_symbol(p_ticker text, p_code text)
returns text language sql immutable as $$
  select nullif(upper(translate(coalesce(nullif(trim(p_ticker), ''), split_part(coalesce(p_code, ''), '.', 1)), '/-', '..')), '');
$$;

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
    order by e.first_date
    limit greatest(p_limit, 0)
  ) s;
$$;

create or replace function public.purge_small_cap_earnings()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.earnings_calendar e
  using public.stock_market_caps c
  where c.symbol = public.earnings_cap_symbol(e.ticker, e.code)
    and c.market_cap < 1000000000
    and e.report_date >= current_date
    and e.actual is null;
  get diagnostics n = row_count;
  return n;
end; $$;

revoke all on function public.earnings_symbols_missing_cap(int) from public, anon, authenticated;
revoke all on function public.purge_small_cap_earnings() from public, anon, authenticated;

-- הרצה מהירה של באקפיל בלבד (בלי screener) — כל 20 דקות עד שהפער נסגר; זול כשאין חסרים
create or replace function public.invoke_backfill_market_caps()
returns bigint language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text; v_request_id bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'SUPABASE_URL' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'SUPABASE_SERVICE_ROLE_KEY' limit 1;
  if v_url is null or v_key is null then
    raise warning 'invoke_backfill_market_caps: missing vault secrets';
    return null;
  end if;
  select net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/refresh-market-caps?mode=backfill',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  ) into v_request_id;
  return v_request_id;
end; $$;
revoke all on function public.invoke_backfill_market_caps() from public, anon, authenticated;

select cron.unschedule('backfill-market-caps') where exists (select 1 from cron.job where jobname = 'backfill-market-caps');
select cron.schedule('backfill-market-caps', '*/20 * * * *', $$select public.invoke_backfill_market_caps();$$);
