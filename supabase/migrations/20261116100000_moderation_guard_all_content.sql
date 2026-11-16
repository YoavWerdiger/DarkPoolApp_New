-- משתמש מושתק/מושעה לא כותב תוכן בשום מסלול — לא רק בהוספת הודעת צ'אט.
-- עד עכשיו ה-guard (20261012130000) ישב רק על INSERT ל-chat_messages, ולכן משתמש מושתק
-- עדיין כתב תגובות להודעות, פוסטים/תשובות בקהילה (כולל פושים של @mention) וערך הודעות ישנות.
-- מחיקת הודעה (content=null) ועדכוני מונים לא נחסמים.

create or replace function public.content_author_status_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if exists (select 1 from public.users u
             where u.id = auth.uid()
               and (coalesce(u.is_suspended, false) or coalesce(u.is_muted, false))) then
    raise exception 'user is muted or suspended' using errcode = '42501';
  end if;
  return new;
end; $$;
revoke execute on function public.content_author_status_guard() from public, anon, authenticated;

drop trigger if exists aa_chat_message_comments_author_status on public.chat_message_comments;
create trigger aa_chat_message_comments_author_status before insert on public.chat_message_comments
  for each row execute function public.content_author_status_guard();

drop trigger if exists aa_community_posts_author_status on public.community_posts;
create trigger aa_community_posts_author_status before insert or update of body, attachments, attachment, image_url, mentions
  on public.community_posts
  for each row execute function public.content_author_status_guard();

drop trigger if exists aa_community_post_replies_author_status on public.community_post_replies;
create trigger aa_community_post_replies_author_status before insert or update of body
  on public.community_post_replies
  for each row execute function public.content_author_status_guard();

-- עריכת תוכן הודעה קיימת (לא מחיקה — מחיקה מאפסת content ל-null)
drop trigger if exists aa_chat_messages_edit_author_status on public.chat_messages;
create trigger aa_chat_messages_edit_author_status before update of content on public.chat_messages
  for each row
  when (new.content is not null and new.content is distinct from old.content)
  execute function public.content_author_status_guard();
