-- pg_advisory_lock דרך PostgREST (pool של חיבורים) נתקע: lock נלקח בחיבור אחד והשחרור הולך לחיבור אחר.
-- התוצאה: «Processor already running» כמעט תמיד, והתראות (תיוגים/חדשות/מעקבים) נשלחו רק במזל.
-- במקום: חכירה בשורה עם תפוגה (2 דקות). נבדק: נעילה→true, שנייה→false, אחרי שחרור→true; תיוג תקוע נשלח.
create table if not exists public.push_processor_lease (
  id int primary key default 1 check (id = 1),
  locked_until timestamptz not null default 'epoch'
);
insert into public.push_processor_lease (id) values (1) on conflict (id) do nothing;
alter table public.push_processor_lease enable row level security;
revoke all on public.push_processor_lease from public, anon, authenticated;

create or replace function public.push_processor_try_lock()
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  update public.push_processor_lease
     set locked_until = now() + interval '2 minutes'
   where id = 1 and locked_until < now()
  returning true into v_ok;
  return coalesce(v_ok, false);
end; $$;

create or replace function public.push_processor_release_lock()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.push_processor_lease set locked_until = 'epoch' where id = 1;
end; $$;

revoke execute on function public.push_processor_try_lock() from public, anon, authenticated;
revoke execute on function public.push_processor_release_lock() from public, anon, authenticated;
