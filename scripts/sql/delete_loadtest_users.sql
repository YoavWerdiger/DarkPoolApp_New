-- מחיקת 999 משתמשי בדיקת העומס (loadtest+N@darkpool.test, נוצרו 10.10.2026).
-- נבדק לפני: כל ההפניות למשתמשים הן CASCADE / SET NULL; ההודעות שלהם רק בקבוצת LOADTEST (3,266).
-- משתמשים אמיתיים לא נכללים.

begin;

-- 1) גיבוי לפני מחיקה
create table if not exists public.backup_loadtest_users_20261108 as
select au.id, au.email, au.created_at, u.display_name, u.full_name
from auth.users au
left join public.users u on u.id = au.id
where au.email ilike 'loadtest+%@darkpool.test';

-- 2) בדיקת שפיות — חייב להיות 999 בגיבוי
do $$
declare n int;
begin
  select count(*) into n from public.backup_loadtest_users_20261108;
  if n <> 999 then
    raise exception 'expected 999 loadtest users in backup, got %', n;
  end if;
end $$;

-- 3) מחיקה (CASCADE מנקה הודעות / חברות / הגדרות של אותם משתמשים)
delete from auth.users where email ilike 'loadtest+%@darkpool.test';

commit;

-- אחרי: select count(*) from auth.users;  -- צפוי 21
