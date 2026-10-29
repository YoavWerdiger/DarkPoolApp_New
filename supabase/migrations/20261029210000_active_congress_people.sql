-- חברי קונגרס פעילים לגריד «חקור» — מקובץ בשרת (שורה לכל חבר) במקום למשוך אלפי עסקאות לקליינט.
-- קריאה בלבד; לא משנה נתונים.
create or replace function public.dark_pool_active_congress_people(
  p_days integer default 730,
  p_limit integer default 200
)
returns table (
  politician_id text,
  politician_name text,
  politician_image_url text,
  trades_count bigint,
  last_filed_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.politician_id::text,
    max(t.politician_name)::text,
    max(t.politician_image_url)::text,
    count(*) as trades_count,
    max(t.filed_at)::timestamptz as last_filed_at
  from public.dark_pool_congress_trades t
  where t.politician_id is not null
    and t.transaction_date > (current_date - p_days)
  group by t.politician_id
  order by count(*) desc
  limit greatest(1, least(p_limit, 500));
$$;

grant execute on function public.dark_pool_active_congress_people(integer, integer) to anon, authenticated;
