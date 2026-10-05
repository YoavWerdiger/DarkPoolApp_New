-- כל משתמש חדש מצורף אוטומטית לקבוצת «הכרזות» (chat_groups). הפונקציה הישנה כתבה לטבלת channels הישנה.
create or replace function public.add_user_to_basic_groups(user_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.chat_group_members (group_id, user_id, role)
  select g.id, user_uuid, 'member'
  from public.chat_groups g
  where g.id = '00000000-0000-0000-0000-000000000001'::uuid
    and not exists (
      select 1 from public.chat_group_members m where m.group_id = g.id and m.user_id = user_uuid
    );
exception when others then
  -- לא מפילים יצירת משתמש בגלל הצטרפות לקבוצה
  raise log 'add_user_to_basic_groups failed for %: %', user_uuid, sqlerrm;
end;
$$;

create or replace function public.trigger_add_user_to_basic_groups()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.add_user_to_basic_groups(new.id);
  return new;
end;
$$;

revoke all on function public.add_user_to_basic_groups(uuid) from public, anon, authenticated;

-- מצרפים את כל המשתמשים הקיימים
insert into public.chat_group_members (group_id, user_id, role)
select '00000000-0000-0000-0000-000000000001'::uuid, u.id, 'member'
from public.users u
where not exists (
  select 1 from public.chat_group_members m
  where m.group_id = '00000000-0000-0000-0000-000000000001'::uuid and m.user_id = u.id
);

-- members_count היה שלילי בחלק מהקבוצות — חישוב מחדש
update public.chat_groups g
set members_count = (select count(*) from public.chat_group_members m where m.group_id = g.id);
