-- סטורי יכול להצביע רק על קובץ בתיקייה של בעליו: stories/<user_id>/...
-- cleanup-expired-stories מוחק את media_url עם service role, ולכן בלי הבדיקה הזו משתמש יכול היה
-- ליצור סטורי שמצביע על קובץ של מישהו אחר (או מדיה של קבוצה) ולגרום למחיקתו.
-- קישורי http (גרסאות ישנות) נשארים מותרים — הפונקציה מדלגת עליהם.
-- הטבלה נוצרה מחוץ ל-migrations, לכן הכל עטוף בבדיקת קיום.

create or replace function public.user_stories_media_path_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.media_url is not null
     and new.media_url !~* '^https?://'
     and (position('stories/' || new.user_id::text || '/' in new.media_url) <> 1
          or new.media_url like '%..%') then
    raise exception 'story media must be under stories/<own user id>/' using errcode = '42501';
  end if;
  if new.expires_at is not null and new.expires_at > now() + interval '25 hours' then
    new.expires_at := now() + interval '24 hours';
  end if;
  return new;
end; $$;
revoke execute on function public.user_stories_media_path_guard() from public, anon, authenticated;

do $$
begin
  if to_regclass('public.user_stories') is not null then
    drop trigger if exists aa_user_stories_media_path on public.user_stories;
    create trigger aa_user_stories_media_path before insert or update of media_url, user_id, expires_at
      on public.user_stories
      for each row execute function public.user_stories_media_path_guard();
  end if;
end $$;
