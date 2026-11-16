-- created_at של פוסט/תשובה בקהילה נקבע בשרת ולא משתנה.
-- עד עכשיו מחבר יכול היה לשים created_at עתידי ולהצמיד את הפוסט לראש הפיד אצל כולם,
-- ולהעביר תשובה לפוסט אחר (post_id).

create or replace function public.community_row_ts_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
    if tg_table_name = 'community_post_replies' and new.post_id is distinct from old.post_id then
      raise exception 'reply post cannot change' using errcode = '42501';
    end if;
  end if;
  return new;
end; $$;
revoke execute on function public.community_row_ts_guard() from public, anon, authenticated;

drop trigger if exists aa_community_posts_ts on public.community_posts;
create trigger aa_community_posts_ts before insert or update on public.community_posts
  for each row execute function public.community_row_ts_guard();

drop trigger if exists aa_community_post_replies_ts on public.community_post_replies;
create trigger aa_community_post_replies_ts before insert or update on public.community_post_replies
  for each row execute function public.community_row_ts_guard();
