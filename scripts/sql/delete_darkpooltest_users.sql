-- מחיקת 4 משתמשי בדיקה darkpooltest*@gmail.com (מעולם לא התחברו, בלי הודעות).
-- נמחקים גם מ-public.users (לא מחובר ב-CASCADE ל-auth.users) — אחרת נשארים כיתומים ומופיעים בקבוצות.

begin;

create table if not exists public.backup_darkpooltest_users_20261108 as
select au.id, au.email, au.created_at, u.display_name
from auth.users au
left join public.users u on u.id = au.id
where au.email ilike 'darkpooltest%@gmail.com';

do $$
declare n int;
begin
  select count(*) into n from public.backup_darkpooltest_users_20261108;
  if n <> 4 then
    raise exception 'expected 4 darkpooltest users, got %', n;
  end if;
end $$;

-- קודם public.users (CASCADE מנקה חברות בקבוצות וכו'), ואז auth
delete from public.users where id in (select id from public.backup_darkpooltest_users_20261108);
delete from auth.users where id in (select id from public.backup_darkpooltest_users_20261108);

commit;
