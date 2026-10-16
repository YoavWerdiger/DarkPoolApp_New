-- אחזקות אינסיידרים מהמקור (SEC EDGAR, Form 4 XML): יתרה לכל «קו אחזקה» בנפרד —
-- מניה/נגזר, ישיר/עקיף, ודרך מה (נאמנות וכו'). form4api מערבב את הקווים ולכן «היתרה אחרי העסקה» שלו לא אמינה לשווי תיק.
-- נמלא ע"י sync-insider-ownership (cron כל 15 דק'); נקרא ע"י materialize-darkpool-portfolios / uw-investor-profile.
create table if not exists public.insider_ownership_points (
  accession text not null,
  line_key text not null,           -- n|d : title : D|I : nature
  insider_cik text not null,
  ticker text not null,
  is_derivative boolean not null,
  security_title text,
  ownership text,                   -- D / I
  nature text,
  shares_owned numeric not null,
  as_of_date date not null,
  filed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (accession, line_key)
);
create index if not exists insider_ownership_points_cik_idx
  on public.insider_ownership_points (insider_cik, ticker, line_key, as_of_date desc);

create table if not exists public.insider_filings_parsed (
  accession text primary key,
  insider_cik text,
  status text not null,             -- ok / no_xml / error
  error text,
  lines int not null default 0,
  parsed_at timestamptz not null default now()
);

alter table public.insider_ownership_points enable row level security;
alter table public.insider_filings_parsed enable row level security;
revoke all on public.insider_ownership_points from anon, authenticated;
revoke all on public.insider_filings_parsed from anon, authenticated;

-- קבצים שעוד לא נקראו — קודם אנשים עם פרופיל, אחר כך החדשים ביותר
create or replace function public.insider_ownership_pending(p_limit int default 150)
returns table(accession text, insider_cik text, filed_at timestamptz, priority int)
language sql stable security definer set search_path = public as $$
  with f as (
    select split_part(b.external_id, ':', 2) acc, b.insider_cik, max(b.filed_at) filed_at,
           max(case when exists (
             select 1 from dark_pool_person_portfolio_snapshots s
             where s.kind = 'insider' and split_part(s.person_id, ':', 1) = b.ticker
           ) then 1 else 0 end) prio
    from dark_pool_insider_buys b
    where b.external_id like 'f4:%' and coalesce(b.insider_cik, '') <> ''
    group by 1, 2
  )
  select f.acc, f.insider_cik, f.filed_at, f.prio
  from f
  where not exists (select 1 from insider_filings_parsed p where p.accession = f.acc)
  order by f.prio desc, f.filed_at desc nulls last
  limit greatest(1, least(p_limit, 500));
$$;
revoke execute on function public.insider_ownership_pending(int) from public, anon, authenticated;

create or replace function public.insider_ownership_current(p_cik text)
returns table(ticker text, line_key text, is_derivative boolean, security_title text, ownership text, nature text,
              shares_owned numeric, as_of_date date)
language sql stable security definer set search_path = public as $$
  select distinct on (ticker, line_key) ticker, line_key, is_derivative, security_title, ownership, nature, shares_owned, as_of_date
  from insider_ownership_points
  where insider_cik = p_cik
  order by ticker, line_key, as_of_date desc, filed_at desc nulls last;
$$;
revoke execute on function public.insider_ownership_current(text) from public, anon, authenticated;

-- גרסה עם p_cik — סנכרון אינסיידר ספציפי
drop function if exists public.insider_ownership_pending(int);
create or replace function public.insider_ownership_pending(p_limit int default 150, p_cik text default null)
returns table(accession text, insider_cik text, filed_at timestamptz, priority int)
language sql stable security definer set search_path = public as $$
  with f as (
    select split_part(b.external_id, ':', 2) acc, b.insider_cik, max(b.filed_at) filed_at,
           max(case when exists (
             select 1 from dark_pool_person_portfolio_snapshots s
             where s.kind = 'insider' and split_part(s.person_id, ':', 1) = b.ticker
           ) then 1 else 0 end) prio
    from dark_pool_insider_buys b
    where b.external_id like 'f4:%' and coalesce(b.insider_cik, '') <> ''
      and (p_cik is null or b.insider_cik = p_cik)
    group by 1, 2
  )
  select f.acc, f.insider_cik, f.filed_at, f.prio
  from f
  where not exists (select 1 from insider_filings_parsed p where p.accession = f.acc)
  order by f.prio desc, f.filed_at desc nulls last
  limit greatest(1, least(p_limit, 500));
$$;
revoke execute on function public.insider_ownership_pending(int, text) from public, anon, authenticated;
