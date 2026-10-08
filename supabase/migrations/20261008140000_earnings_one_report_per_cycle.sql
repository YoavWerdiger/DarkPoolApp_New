-- ============================================================================
-- דיווח אחד לכל חברה לכל מחזור (רבעון).
-- הטבלה ייחודית לפי (ticker, report_date): כשמקור מזיז את התאריך החזוי נוצרת שורה חדשה
-- והישנה נשארת, ומקורות שונים (Finnhub = תחזית אלגוריתמית, Benzinga/Earningshub = תאריך
-- שהחברה פרסמה) כותבים תאריכים שונים לאותו דיווח. נמדד: 1,451 מתוך 2,066 חברות עם כפילויות.
--
-- dedupe_earnings_cycles: שורות של אותה חברה במרחק ≤25 יום = אותו דיווח. נשארת אחת:
--   יש תוצאה > תאריך מאושר > Benzinga/Earningshub > Finnhub > UW > אחר > יש שעה > עדכנית.
-- שדות חסרים בשורה שנשארת מושלמים מהאחרות (תחזיות, שעה, דגלי פוש), והשאר נמחקות.
-- שתי שורות עם תוצאות באותו מחזור — שתיהן נשארות (לא מוחקים תוצאה אמיתית).
-- ============================================================================
create or replace function public.earnings_source_rank(p_source text)
returns int language sql immutable as $$
  select case
    when p_source ilike '%benzinga%' then 4
    when p_source ilike '%earningshub%' then 4
    when p_source ilike '%finnhub%' then 2
    when p_source ilike '%unusual%' then 1
    else 0 end;
$$;

create or replace function public.dedupe_earnings_cycles(p_days_back int default 45)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merged int := 0;
  v_deleted int := 0;
begin
  create temp table _ec on commit drop as
  with base as (
    select id,
      public.earnings_cap_symbol(ticker, code) as sym,
      report_date,
      (actual is not null or revenue_actual is not null) as has_act,
      coalesce(is_date_confirmed, false) as conf,
      public.earnings_source_rank(coalesce(source, api_source)) as src_rank,
      (before_after_market is not null) as has_time,
      updated_at
    from public.earnings_calendar
    where report_date >= current_date - p_days_back
  ), ordered as (
    select *, report_date - lag(report_date) over (partition by sym order by report_date) as gap
    from base where sym is not null
  ), clustered as (
    select *, sum(case when gap is null or gap > 25 then 1 else 0 end)
      over (partition by sym order by report_date rows unbounded preceding) as cl
    from ordered
  )
  select *,
    row_number() over (partition by sym, cl
      order by has_act desc, conf desc, src_rank desc, has_time desc, updated_at desc nulls last) as rn,
    count(*) over (partition by sym, cl) as n
  from clustered;

  -- השלמת שדות חסרים בשורה שנשארת מהכפילויות שלה
  with donors as (
    select k.id as keeper_id,
      (array_agg(o.eps_estimate order by x.rn) filter (where o.eps_estimate is not null))[1] as eps_estimate,
      (array_agg(o.estimate order by x.rn) filter (where o.estimate is not null))[1] as estimate,
      (array_agg(o.revenue_estimate order by x.rn) filter (where o.revenue_estimate is not null))[1] as revenue_estimate,
      (array_agg(o.revenue_estimate_avg order by x.rn) filter (where o.revenue_estimate_avg is not null))[1] as revenue_estimate_avg,
      (array_agg(o.revenue_estimate_low order by x.rn) filter (where o.revenue_estimate_low is not null))[1] as revenue_estimate_low,
      (array_agg(o.revenue_estimate_high order by x.rn) filter (where o.revenue_estimate_high is not null))[1] as revenue_estimate_high,
      (array_agg(o.revenue_estimate_year_ago order by x.rn) filter (where o.revenue_estimate_year_ago is not null))[1] as revenue_estimate_year_ago,
      (array_agg(o.eps_prior order by x.rn) filter (where o.eps_prior is not null))[1] as eps_prior,
      (array_agg(o.revenue_prior order by x.rn) filter (where o.revenue_prior is not null))[1] as revenue_prior,
      (array_agg(o.before_after_market order by x.rn) filter (where o.before_after_market is not null))[1] as before_after_market,
      (array_agg(o.company_name order by x.rn) filter (where o.company_name is not null))[1] as company_name,
      (array_agg(o.market_cap order by x.rn) filter (where o.market_cap is not null))[1] as market_cap,
      (array_agg(o.quarter order by x.rn) filter (where o.quarter is not null))[1] as quarter,
      (array_agg(o.period_year order by x.rn) filter (where o.period_year is not null))[1] as period_year,
      max(o.reminder_push_sent_at) as reminder_push_sent_at,
      max(o.results_push_sent_at) as results_push_sent_at
    from _ec k
    join _ec x on x.sym = k.sym and x.cl = k.cl and x.rn > 1
    join public.earnings_calendar o on o.id = x.id
    where k.rn = 1 and k.n > 1
    group by k.id
  )
  update public.earnings_calendar e set
    eps_estimate = coalesce(e.eps_estimate, d.eps_estimate),
    estimate = coalesce(e.estimate, d.estimate),
    revenue_estimate = coalesce(e.revenue_estimate, d.revenue_estimate),
    revenue_estimate_avg = coalesce(e.revenue_estimate_avg, d.revenue_estimate_avg),
    revenue_estimate_low = coalesce(e.revenue_estimate_low, d.revenue_estimate_low),
    revenue_estimate_high = coalesce(e.revenue_estimate_high, d.revenue_estimate_high),
    revenue_estimate_year_ago = coalesce(e.revenue_estimate_year_ago, d.revenue_estimate_year_ago),
    eps_prior = coalesce(e.eps_prior, d.eps_prior),
    revenue_prior = coalesce(e.revenue_prior, d.revenue_prior),
    before_after_market = coalesce(e.before_after_market, d.before_after_market),
    company_name = coalesce(e.company_name, d.company_name),
    market_cap = coalesce(e.market_cap, d.market_cap),
    quarter = coalesce(e.quarter, d.quarter),
    period_year = coalesce(e.period_year, d.period_year),
    -- פוש שכבר נשלח על כפילות — לא שולחים שוב על השורה שנשארת
    reminder_push_sent_at = coalesce(e.reminder_push_sent_at, d.reminder_push_sent_at),
    results_push_sent_at = coalesce(e.results_push_sent_at, d.results_push_sent_at)
  from donors d
  where e.id = d.keeper_id;
  get diagnostics v_merged = row_count;

  delete from public.earnings_calendar e
  using _ec x
  where e.id = x.id and x.rn > 1 and not x.has_act;
  get diagnostics v_deleted = row_count;

  return jsonb_build_object('merged', v_merged, 'deleted', v_deleted);
end;
$$;
revoke all on function public.dedupe_earnings_cycles(int) from public, anon, authenticated;
