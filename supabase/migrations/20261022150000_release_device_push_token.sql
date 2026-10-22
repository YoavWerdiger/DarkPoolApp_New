-- פושים למכשיר מנותק: השחרור ביציאה היה UPDATE עם RLS (צריך סשן) ובתקציב 3 שניות —
-- אם נכשל/נחתך, או שהסשן נגמר בלי יציאה (פג / בוטל / מכשיר אחר), הטוקן נשאר פעיל.

-- 1) שחרור לפי הטוקן עצמו, גם בלי סשן (המכשיר מחזיק את הטוקן; פעולה רק מכבה)
create or replace function public.release_device_push_token(p_expo_push_token text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if coalesce(btrim(p_expo_push_token), '') = '' then
    return 0;
  end if;
  update public.device_tokens
     set is_active = false,
         updated_at = timezone('utc', now())
   where expo_push_token = p_expo_push_token
     and is_active = true;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.release_device_push_token(text) from public;
grant execute on function public.release_device_push_token(text) to anon, authenticated;

-- 2) ניקוי שעתי: טוקנים פעילים של משתמשים בלי אף סשן (יצאו / הסשן בוטל)
create or replace function public.deactivate_orphan_push_tokens()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  n integer;
begin
  update public.device_tokens d
     set is_active = false,
         updated_at = timezone('utc', now())
   where d.is_active = true
     and not exists (select 1 from auth.sessions s where s.user_id = d.user_id);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.deactivate_orphan_push_tokens() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'deactivate-orphan-push-tokens';
select cron.schedule('deactivate-orphan-push-tokens', '17 * * * *', $$select public.deactivate_orphan_push_tokens()$$);
