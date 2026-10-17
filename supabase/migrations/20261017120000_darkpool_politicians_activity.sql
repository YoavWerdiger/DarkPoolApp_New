-- פעילות לכל פוליטיקאי מכל הטבלה — ל«חקור». קודם: הלקוח קרא מדגם לא ממוין (1000 שורות) והציג רק את המאוצרים (~15 מתוך 241).
create or replace function public.darkpool_politicians_activity(p_limit int default 200)
returns table(politician_id text, politician_name text, politician_image_url text,
              trades_12m bigint, trades_total bigint, last_trade date)
language sql stable security invoker set search_path = public as $$
  select t.politician_id,
         (array_agg(t.politician_name order by t.transaction_date desc))[1],
         (array_agg(t.politician_image_url order by t.transaction_date desc) filter (where t.politician_image_url is not null))[1],
         count(*) filter (where t.transaction_date > current_date - 365),
         count(*),
         max(t.transaction_date)::date
  from public.dark_pool_congress_trades t
  where coalesce(t.politician_id, '') <> '' and coalesce(t.politician_name, '') <> ''
  group by t.politician_id
  order by count(*) filter (where t.transaction_date > current_date - 365) desc, max(t.transaction_date) desc
  limit greatest(1, least(p_limit, 500));
$$;
grant execute on function public.darkpool_politicians_activity(int) to anon, authenticated;
