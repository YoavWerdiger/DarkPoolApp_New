-- ניקוי אחרי מחיקת משתמשי הבדיקה:
-- 1) שורות public.users של 999 משתמשי loadtest שנמחקו מ-auth (public.users לא מחובר ב-CASCADE ל-auth.users)
--    — מחיקתן מנקה ב-CASCADE את החברות בקבוצות / ההודעות שלהם (רק בקבוצת LOADTEST).
-- 2) קבוצת LOADTEST עצמה.
-- 3) «משתמש שנמחק» (מחקו את החשבון בעצמם): רק יציאה מהקבוצות — המשתמש וההודעות נשארים.

begin;

-- גיבוי
create table if not exists public.backup_orphan_users_20261108 as
select u.* from public.users u
where not exists (select 1 from auth.users a where a.id = u.id);

create table if not exists public.backup_loadtest_group_20261108 as
select * from public.chat_groups where name = 'LOADTEST';

-- 1) משתמשי הבדיקה
delete from public.users u
where u.email ilike 'loadtest+%@darkpool.test'
  and not exists (select 1 from auth.users a where a.id = u.id);

-- 2) קבוצת LOADTEST (הודעות וחברות שנותרו נמחקות איתה)
delete from public.chat_messages where group_id in (select id from public.chat_groups where name = 'LOADTEST');
delete from public.chat_group_members where group_id in (select id from public.chat_groups where name = 'LOADTEST');
delete from public.chat_groups where name = 'LOADTEST';

-- 3) משתמשים שמחקו את החשבון: יציאה מהקבוצות בלבד
delete from public.chat_group_members m
where m.user_id in (
  select u.id from public.users u
  where not exists (select 1 from auth.users a where a.id = u.id)
);

commit;

-- אחרי:
-- select count(*) from public.users;                                  -- צפוי 21 + 8 «משתמש שנמחק» = 29
-- select count(*) from public.chat_groups where name = 'LOADTEST';    -- צפוי 0
