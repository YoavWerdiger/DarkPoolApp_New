-- ציוצים בזמן אמת (כמו הצ'אט): Broadcast from Database ל-topic פרטי אחד `community-feed`.
-- ציוץ חדש/נמחק/נערך, לייק/הסרת לייק, תגובה חדשה/נמחקה → אירוע קטן; לייק/תגובה עם ספירה מוחלטת.
-- הפרסום הקיים (postgres_changes על community_posts) נשאר — בילדים ישנים ממשיכים לקבל ציוצים חדשים.

create or replace function public.chat_rt_can_access(p_topic text)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select case
    when p_topic like 'chat-group:%' then exists (
      select 1 from public.chat_group_members m
      where m.user_id = (select auth.uid())
        and m.group_id::text = substr(p_topic, length('chat-group:') + 1))
    when p_topic like 'chat-typing:%' then exists (
      select 1 from public.chat_group_members m
      where m.user_id = (select auth.uid())
        and m.group_id::text = substr(p_topic, length('chat-typing:') + 1))
    when p_topic like 'chat-user:%' then
      substr(p_topic, length('chat-user:') + 1) = (select auth.uid())::text
    when p_topic = 'community-feed' then (select auth.uid()) is not null
    else false
  end;
$function$;

create or replace function public.community_rt_posts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.chat_rt_send('community-feed', 'post_insert', jsonb_build_object('id', new.id, 'user_id', new.user_id));
  elsif tg_op = 'UPDATE' then
    if new.body is distinct from old.body or new.attachments is distinct from old.attachments
       or new.attachment is distinct from old.attachment or new.image_url is distinct from old.image_url then
      perform public.chat_rt_send('community-feed', 'post_update', jsonb_build_object('id', new.id));
    end if;
  elsif tg_op = 'DELETE' then
    perform public.chat_rt_send('community-feed', 'post_delete', jsonb_build_object('id', old.id));
  end if;
  return null;
end; $$;
drop trigger if exists community_rt_posts_trg on public.community_posts;
create trigger community_rt_posts_trg after insert or update or delete on public.community_posts
  for each row execute function public.community_rt_posts();

create or replace function public.community_rt_likes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record; v_count int;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select count(*) into v_count from public.community_post_likes where post_id = r.post_id;
  perform public.chat_rt_send('community-feed', 'like', jsonb_build_object(
    'post_id', r.post_id, 'user_id', r.user_id,
    'op', case when tg_op = 'INSERT' then 'add' else 'remove' end,
    'like_count', v_count));
  return null;
end; $$;
drop trigger if exists community_rt_likes_trg on public.community_post_likes;
create trigger community_rt_likes_trg after insert or delete on public.community_post_likes
  for each row execute function public.community_rt_likes();

create or replace function public.community_rt_replies()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record; v_count int;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select count(*) into v_count from public.community_post_replies where post_id = r.post_id;
  if tg_op = 'INSERT' then
    perform public.chat_rt_send('community-feed', 'reply_insert', jsonb_build_object(
      'id', r.id, 'post_id', r.post_id, 'user_id', r.user_id, 'reply_count', v_count));
  else
    perform public.chat_rt_send('community-feed', 'reply_delete', jsonb_build_object(
      'id', r.id, 'post_id', r.post_id, 'reply_count', v_count));
  end if;
  return null;
end; $$;
drop trigger if exists community_rt_replies_trg on public.community_post_replies;
create trigger community_rt_replies_trg after insert or delete on public.community_post_replies
  for each row execute function public.community_rt_replies();

revoke all on function public.community_rt_posts() from public, anon, authenticated;
revoke all on function public.community_rt_likes() from public, anon, authenticated;
revoke all on function public.community_rt_replies() from public, anon, authenticated;
