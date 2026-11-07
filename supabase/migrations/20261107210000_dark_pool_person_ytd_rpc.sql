-- תשואת YTD לרשימת אנשים (שיט החיפוש באינסיידרים) — מתוך dark_pool_person_portfolio_snapshots.
-- הטבלה עצמה סגורה ל-authenticated (service_role בלבד); ה-RPC חושף רק person_id, kind ו-YTD.
create or replace function public.dark_pool_person_ytd(p_ids text[])
returns table (person_id text, kind text, ytd numeric)
language sql
stable
security definer
set search_path = public
as $$
  select s.person_id,
         s.kind,
         nullif(s.period_returns->>'YTD', '')::numeric as ytd
  from public.dark_pool_person_portfolio_snapshots s
  where s.person_id = any(p_ids[1:50])
$$;

revoke all on function public.dark_pool_person_ytd(text[]) from public, anon;
grant execute on function public.dark_pool_person_ytd(text[]) to authenticated;
