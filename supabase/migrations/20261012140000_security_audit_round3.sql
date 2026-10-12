-- סריקת אבטחה 2026-10-12 — סבב 3 (הוחל בשרת דרך MCP; נבדק בסימולציה: 8/8)

-- a) קבלות קריאה / כוכבים / מחיקה אישית — רק להודעה בקבוצה שאתה חבר בה
drop policy if exists "Users can insert their own read receipts" on public.chat_message_reads;
drop policy if exists "Users can mark messages as read" on public.chat_message_reads;
create policy "Users can mark messages as read" on public.chat_message_reads
  for insert with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.chat_group_members m where m.group_id = chat_message_reads.group_id and m.user_id = (select auth.uid()))
    and exists (select 1 from public.chat_messages cm where cm.id = chat_message_reads.message_id and cm.group_id = chat_message_reads.group_id)
  );

drop policy if exists "Users can star messages" on public.chat_starred_messages;
create policy "Users can star messages" on public.chat_starred_messages
  for insert with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.chat_group_members m where m.group_id = chat_starred_messages.group_id and m.user_id = (select auth.uid()))
    and exists (select 1 from public.chat_messages cm where cm.id = chat_starred_messages.message_id and cm.group_id = chat_starred_messages.group_id)
  );

drop policy if exists "Users can insert their own personal deletions" on public.chat_message_personal_deletions;
create policy "Users can insert their own personal deletions" on public.chat_message_personal_deletions
  for insert with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.chat_messages cm where cm.id = chat_message_personal_deletions.message_id and cm.group_id = chat_message_personal_deletions.group_id)
  );

-- b) chat_groups: created_by לא משתנה
create or replace function public.chat_groups_creator_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_app_admin(auth.uid())
     and new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable' using errcode = '42501';
  end if;
  return new;
end; $$;
drop trigger if exists aa_chat_groups_creator_guard on public.chat_groups;
create trigger aa_chat_groups_creator_guard before update on public.chat_groups
  for each row execute function public.chat_groups_creator_guard();

-- c) user_course_progress: מדיניות כפולה בלי בדיקת קורס בתשלום — מוסרת
drop policy if exists "Users can insert their own progress" on public.user_course_progress;

-- d) תגובות לסטורי: אי אפשר להעביר תגובה לסטורי של עצמך
drop policy if exists user_story_reactions_update on public.user_story_reactions;
create policy user_story_reactions_update on public.user_story_reactions
  for update using (auth.uid() = reactor_id)
  with check (
    auth.uid() = reactor_id
    and not exists (select 1 from public.user_stories s where s.id = user_story_reactions.story_id and s.user_id = auth.uid())
  );

-- e) community_posts: עד 20 תיוגים בפוסט (mentions הוא jsonb)
create or replace function public.community_posts_mentions_cap()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.mentions is not null and jsonb_typeof(new.mentions) = 'array'
     and jsonb_array_length(new.mentions) > 20 then
    raise exception 'too many mentions' using errcode = '22023';
  end if;
  return new;
end; $$;
drop trigger if exists aa_community_posts_mentions_cap on public.community_posts;
create trigger aa_community_posts_mentions_cap before insert or update of mentions on public.community_posts
  for each row execute function public.community_posts_mentions_cap();
