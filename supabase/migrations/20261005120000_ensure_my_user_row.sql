-- יוצר שורת public.users למשתמש המחובר אם חסרה (חשבון auth ישן בלי שורה) — כמו handle_new_user
create or replace function public.ensure_my_user_row()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  insert into public.users (id, email, full_name, display_name)
  select a.id,
         a.email,
         coalesce(a.raw_user_meta_data->>'full_name', a.raw_user_meta_data->>'display_name', split_part(a.email, '@', 1)),
         coalesce(a.raw_user_meta_data->>'display_name', split_part(a.email, '@', 1))
  from auth.users a
  where a.id = uid
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.ensure_my_user_row() from public, anon;
grant execute on function public.ensure_my_user_row() to authenticated;
