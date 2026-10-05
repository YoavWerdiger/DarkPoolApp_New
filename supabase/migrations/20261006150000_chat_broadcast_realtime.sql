-- ============================================================================
-- Chat realtime at scale: Broadcast from Database (private channels)
-- ----------------------------------------------------------------------------
-- לפני: postgres_changes — כל שינוי ב-chat_messages נבדק מול RLS לכל מנוי, ו-membership
-- channel גלובלי האזין לכל ההודעות במערכת (2,000 מחוברים = 2,000 בדיקות להודעה).
-- אחרי: טריגרים שולחים אירוע אחד ל-topic של הקבוצה (`chat-group:<id>`) / של המשתמש
-- (`chat-user:<id>`). ההרשאה נבדקת פעם אחת בהצטרפות לערוץ הפרטי (RLS על realtime.messages).
--
-- תוספתי בלבד: הפרסום הקיים (supabase_realtime) לא משתנה, כדי שבילדים קיימים ימשיכו
-- לעבוד. ניקוי הפרסום — במיגרציה נפרדת אחרי שכל המשתמשים בגרסה החדשה.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- שליחה בטוחה: כשל שידור לעולם לא מפיל את הכתיבה עצמה
-- ---------------------------------------------------------------------------
create or replace function public.chat_rt_send(p_topic text, p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(p_payload, p_event, p_topic, true);
exception when others then
  raise warning 'chat_rt_send(%,%) failed: %', p_topic, p_event, sqlerrm;
end;
$$;
revoke all on function public.chat_rt_send(text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- chat_messages → chat-group:<group_id>
-- UPDATE משודר רק כשמשהו שמוצג השתנה — לא על מונים (read_by_count / reactions_count),
-- כדי שאלפי אישורי קריאה לא יהפכו לאלפי שידורים.
-- ---------------------------------------------------------------------------
create or replace function public.chat_rt_messages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_noise text[] := array['read_by_count', 'reactions_count', 'updated_at'];
begin
  if tg_op = 'INSERT' then
    perform public.chat_rt_send('chat-group:' || new.group_id, 'message_insert', to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    if (to_jsonb(new) - v_noise) is distinct from (to_jsonb(old) - v_noise) then
      perform public.chat_rt_send('chat-group:' || new.group_id, 'message_update', to_jsonb(new));
    end if;
  elsif tg_op = 'DELETE' then
    perform public.chat_rt_send(
      'chat-group:' || old.group_id,
      'message_delete',
      jsonb_build_object('id', old.id, 'group_id', old.group_id)
    );
  end if;
  return null;
end;
$$;

drop trigger if exists chat_rt_messages_trg on public.chat_messages;
create trigger chat_rt_messages_trg
  after insert or update or delete on public.chat_messages
  for each row execute function public.chat_rt_messages();

-- ---------------------------------------------------------------------------
-- chat_message_reactions → chat-group:<group_id>
-- ---------------------------------------------------------------------------
create or replace function public.chat_rt_reactions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  if r.group_id is null then return null; end if;
  perform public.chat_rt_send(
    'chat-group:' || r.group_id,
    'reaction',
    jsonb_build_object('op', tg_op, 'row', to_jsonb(r))
  );
  return null;
end;
$$;

drop trigger if exists chat_rt_reactions_trg on public.chat_message_reactions;
create trigger chat_rt_reactions_trg
  after insert or delete on public.chat_message_reactions
  for each row execute function public.chat_rt_reactions();

-- ---------------------------------------------------------------------------
-- chat_message_reads → chat-user:<sender_id> בלבד
-- רק השולח צריך לדעת שהודעתו נקראה — אירוע אחד למכשיר אחד, לא לכל הקבוצה.
-- ---------------------------------------------------------------------------
create or replace function public.chat_rt_reads()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender uuid;
begin
  select m.sender_id into v_sender from public.chat_messages m where m.id = new.message_id;
  if v_sender is null or v_sender = new.user_id then return null; end if;
  perform public.chat_rt_send(
    'chat-user:' || v_sender,
    'read',
    jsonb_build_object('message_id', new.message_id, 'user_id', new.user_id, 'group_id', new.group_id)
  );
  return null;
end;
$$;

drop trigger if exists chat_rt_reads_trg on public.chat_message_reads;
create trigger chat_rt_reads_trg
  after insert on public.chat_message_reads
  for each row execute function public.chat_rt_reads();

-- ---------------------------------------------------------------------------
-- chat_group_members → chat-group:<group_id> (רשימת חברים) + chat-user:<user_id> (הצטרפות/הסרה)
-- UPDATE (מוני unread) לא משודר — הלקוח מחשב unread מקומית מאירועי ההודעות.
-- ---------------------------------------------------------------------------
create or replace function public.chat_rt_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  perform public.chat_rt_send(
    'chat-group:' || r.group_id,
    'member',
    jsonb_build_object('op', tg_op, 'row', to_jsonb(r))
  );
  perform public.chat_rt_send(
    'chat-user:' || r.user_id,
    'membership',
    jsonb_build_object('op', tg_op, 'group_id', r.group_id, 'user_id', r.user_id)
  );
  return null;
end;
$$;

drop trigger if exists chat_rt_members_trg on public.chat_group_members;
create trigger chat_rt_members_trg
  after insert or delete on public.chat_group_members
  for each row execute function public.chat_rt_members();

-- ---------------------------------------------------------------------------
-- chat_groups → chat-group:<id> רק כשפרטי הקבוצה השתנו (שם/תמונה/תיאור/הגדרות),
-- לא על מונים ו-last_message (אלה מגיעים מאירוע ההודעה עצמה).
-- ---------------------------------------------------------------------------
create or replace function public.chat_rt_groups()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_noise text[] := array['members_count', 'messages_count', 'last_message_at', 'last_message_preview', 'updated_at'];
begin
  if (to_jsonb(new) - v_noise) is distinct from (to_jsonb(old) - v_noise) then
    perform public.chat_rt_send('chat-group:' || new.id, 'group', to_jsonb(new));
  end if;
  return null;
end;
$$;

drop trigger if exists chat_rt_groups_trg on public.chat_groups;
create trigger chat_rt_groups_trg
  after update on public.chat_groups
  for each row execute function public.chat_rt_groups();

revoke all on function public.chat_rt_messages() from public, anon, authenticated;
revoke all on function public.chat_rt_reactions() from public, anon, authenticated;
revoke all on function public.chat_rt_reads() from public, anon, authenticated;
revoke all on function public.chat_rt_members() from public, anon, authenticated;
revoke all on function public.chat_rt_groups() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- הרשאות לערוצים הפרטיים (realtime.messages)
-- המדיניות הקיימת "authenticated can join realtime channels" (USING true) נשמרת לכל
-- שאר הערוצים באפליקציה — רק topics של הצ'אט מוגבלים לחברי הקבוצה / לבעלים.
-- ---------------------------------------------------------------------------
create or replace function public.chat_rt_can_access(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_topic like 'chat-group:%' then exists (
      select 1 from public.chat_group_members m
      where m.user_id = (select auth.uid())
        and m.group_id::text = substr(p_topic, length('chat-group:') + 1)
    )
    when p_topic like 'chat-user:%' then
      substr(p_topic, length('chat-user:') + 1) = (select auth.uid())::text
    else true
  end;
$$;
revoke all on function public.chat_rt_can_access(text) from public, anon;
grant execute on function public.chat_rt_can_access(text) to authenticated;

alter policy "authenticated can join realtime channels"
  on realtime.messages
  using (public.chat_rt_can_access((select realtime.topic())));

-- שידור מהלקוח (רק «מקליד...») — רק לערוץ של קבוצה שהמשתמש חבר בה
drop policy if exists "chat members can broadcast typing" on realtime.messages;
create policy "chat members can broadcast typing"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) like 'chat-group:%'
    and public.chat_rt_can_access((select realtime.topic()))
  );

-- אינדקס כפול (advisor: duplicate_index)
drop index if exists public.idx_chat_reads_message_id;
