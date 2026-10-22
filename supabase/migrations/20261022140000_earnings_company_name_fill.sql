-- דיווחי רווח: Finnhub לא שולח שם חברה (715/999 דיווחים קרובים בלי שם).
-- ממלאים לפי הטיקר: stock_market_caps (נקי מ-«Common Stock» וכו׳), אחרת השם האחרון מדיווח קודם.
-- רק כשהשם ריק / שווה לטיקר — שם קיים לא נדרס.

create or replace function public.clean_security_name(raw text)
returns text
language sql
immutable
as $$
  -- ב-Postgres \y הוא גבול מילה (\b הוא backspace)
  select nullif(btrim(regexp_replace(
    regexp_replace(
      regexp_replace(coalesce(raw, ''), '\s*\((DE|Canada|[A-Z]{2})\)', '', 'g'),
      '\s+(Class [A-Z]\s+)?(Common Stock|Ordinary Shares|American Depositary Shares|Common Shares|Depositary Shares|Shares of Beneficial Interest|Common Units|Units|Warrants?)\y.*$',
      '', 'i'),
    '[\s,\-]+$', '')), '')
$$;

create or replace function public.earnings_company_name_for(p_ticker text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select public.clean_security_name(s.name)
       from public.stock_market_caps s
      where upper(s.symbol) = upper(p_ticker)
      limit 1),
    (select e.company_name
       from public.earnings_calendar e
      where upper(coalesce(e.ticker, e.code, e.symbol)) = upper(p_ticker)
        and coalesce(e.company_name, '') <> ''
        and e.company_name <> coalesce(e.ticker, e.code, e.symbol)
      order by e.report_date desc
      limit 1)
  )
$$;

create or replace function public.earnings_calendar_fill_company_name()
returns trigger
language plpgsql
as $$
declare
  t text := coalesce(new.ticker, new.code, new.symbol);
begin
  if t is not null and (coalesce(btrim(new.company_name), '') = '' or new.company_name = t) then
    new.company_name := coalesce(public.earnings_company_name_for(t), new.company_name);
  end if;
  return new;
end;
$$;

-- השם «a0_» — טריגרים BEFORE רצים לפי סדר אלפביתי; חייב לרוץ לפני aa_skip_noop_update
drop trigger if exists a0_earnings_fill_company_name on public.earnings_calendar;
create trigger a0_earnings_fill_company_name
  before insert or update on public.earnings_calendar
  for each row execute function public.earnings_calendar_fill_company_name();

-- מילוי חד-פעמי לשורות קיימות בלי שם (רק company_name — לא מפעיל את טריגר ההתראות על actual)
update public.earnings_calendar
   set company_name = public.earnings_company_name_for(coalesce(ticker, code, symbol))
 where public.earnings_company_name_for(coalesce(ticker, code, symbol)) is not null
   and (coalesce(btrim(company_name), '') = ''
        or company_name = coalesce(ticker, code, symbol));
