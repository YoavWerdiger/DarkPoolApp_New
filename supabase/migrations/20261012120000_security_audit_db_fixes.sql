-- סריקת אבטחה 2026-10-12 (run-1): תיקוני הרשאות במסד.
-- כל בדיקה מדלגת כשאין auth.uid() (service role / cron / טריגרים פנימיים) — רק בקשות של משתמשים נבדקות.

-- ============================================================
-- 1) chat_group_members: אי אפשר למנות את עצמך למנהל / להצטרף לקבוצה סגורה
-- ============================================================
create or replace function public.chat_members_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_settings jsonb;
  v_creator uuid;
  v_tiers jsonb;
begin
  if v_uid is null or public.is_app_admin(v_uid) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- הוספת משתמש אחר — רק מנהל הקבוצה, ורק כחבר רגיל
    if new.user_id is distinct from v_uid then
      if not public.is_user_admin_of_group(new.group_id, v_uid) then
        raise exception 'only group admins can add members' using errcode = '42501';
      end if;
      new.role := 'member';
      return new;
    end if;

    select settings, created_by into v_settings, v_creator
    from public.chat_groups where id = new.group_id;
    if not found then
      raise exception 'group not found' using errcode = '42501';
    end if;

    -- יוצר הקבוצה מצטרף כמנהל ראשון (createChatGroup באפליקציה)
    if new.role = 'admin' and v_creator = v_uid
       and not exists (select 1 from public.chat_group_members m where m.group_id = new.group_id) then
      return new;
    end if;

    new.role := 'member';

    if coalesce((v_settings->>'is_public')::boolean, true) = false then
      raise exception 'group is not joinable' using errcode = '42501';
    end if;

    v_tiers := v_settings->'allowed_tiers';
    if jsonb_typeof(v_tiers) = 'array' and jsonb_array_length(v_tiers) > 0
       and not (v_tiers ? (case when public.has_paid_learning_access(v_uid) then 'premium' else 'free' end)) then
      raise exception 'group not available for your plan' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE: לא מזיזים חברות בין קבוצות/משתמשים, ותפקיד משנה רק מנהל הקבוצה
  if new.group_id is distinct from old.group_id or new.user_id is distinct from old.user_id then
    raise exception 'cannot move membership' using errcode = '42501';
  end if;
  if new.role is distinct from old.role and not public.is_user_admin_of_group(old.group_id, v_uid) then
    raise exception 'only group admins can change roles' using errcode = '42501';
  end if;
  return new;
end; $$;

drop trigger if exists aa_chat_members_guard on public.chat_group_members;
create trigger aa_chat_members_guard before insert or update on public.chat_group_members
  for each row execute function public.chat_members_guard();

-- ============================================================
-- 2) chat_messages: עריכה לא יכולה להעביר הודעה לקבוצה אחרת / לשנות שולח
-- ============================================================
create or replace function public.chat_messages_update_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.group_id is distinct from old.group_id
     or new.sender_id is distinct from old.sender_id
     or new.created_at is distinct from old.created_at
     or new.is_system_message is distinct from old.is_system_message then
    raise exception 'immutable message fields' using errcode = '42501';
  end if;
  return new;
end; $$;

drop trigger if exists aa_chat_messages_update_guard on public.chat_messages;
create trigger aa_chat_messages_update_guard before update on public.chat_messages
  for each row execute function public.chat_messages_update_guard();

-- ============================================================
-- 3) complete_user_registration: רק על עצמך
-- ============================================================
create or replace function public.complete_user_registration(
  user_id uuid, user_full_name text, user_phone text, user_track_id text, user_intro_data jsonb)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is not null and user_id is distinct from auth.uid() then
    return false;
  end if;
  if not exists (select 1 from public.users where id = user_id) then
    return false;
  end if;
  if user_phone is not null and exists (select 1 from public.users where phone = user_phone and id <> user_id) then
    return false;
  end if;
  update public.users set
    full_name = user_full_name, phone = user_phone, track_id = user_track_id,
    intro_data = user_intro_data, registration_completed = true, updated_at = now()
  where id = user_id;
  return true;
end; $$;

create or replace function public.complete_user_registration(
  user_id uuid, user_full_name text, user_phone text, user_track_id text, user_intro_data jsonb,
  user_profile_picture text default null)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is not null and user_id is distinct from auth.uid() then
    return false;
  end if;
  if not exists (select 1 from public.users where id = user_id) then
    return false;
  end if;
  if user_phone is not null and exists (select 1 from public.users where phone = user_phone and id <> user_id) then
    return false;
  end if;
  update public.users set
    full_name = user_full_name, phone = user_phone, track_id = user_track_id,
    intro_data = user_intro_data, profile_picture = user_profile_picture,
    registration_completed = true, updated_at = now()
  where id = user_id;
  return true;
end; $$;

-- ============================================================
-- 4) get_last_messages_for_groups: רק קבוצות שאתה חבר בהן
-- ============================================================
create or replace function public.get_last_messages_for_groups(group_ids uuid[])
returns table(group_id uuid, content text, message_type text, created_at timestamptz, sender_id uuid)
language sql stable security definer set search_path = public, extensions as $$
  select distinct on (m.group_id) m.group_id, m.content, m.message_type, m.created_at, m.sender_id
  from public.chat_messages m
  where m.group_id = any(group_ids)
    and m.is_deleted = false
    and exists (select 1 from public.chat_group_members gm
                where gm.group_id = m.group_id and gm.user_id = auth.uid())
  order by m.group_id, m.created_at desc;
$$;

-- ============================================================
-- 5) range_recalc_snapshots: רק התיק שלך, וטווח מוגבל
-- ============================================================
create or replace function public.range_recalc_snapshots(p_portfolio_id uuid, p_from date, p_to date default current_date)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_date date;
  v_to date := least(coalesce(p_to, current_date), current_date);
begin
  if auth.uid() is not null
     and not public.is_app_admin(auth.uid())
     and not exists (select 1 from public.portfolios p where p.id = p_portfolio_id and p.user_id = auth.uid()) then
    raise exception 'not your portfolio' using errcode = '42501';
  end if;
  v_date := greatest(p_from, v_to - 3660);
  while v_date <= v_to loop
    perform public.upsert_daily_snapshot(p_portfolio_id, v_date);
    v_date := v_date + 1;
  end loop;
end; $$;

-- ============================================================
-- 6) reset_unread_count: רק המונה שלך
-- ============================================================
create or replace function public.reset_unread_count(p_group_id uuid, p_user_id uuid, p_last_read_message_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.chat_group_members
  set unread_count = 0, mentioned_count = 0,
      last_read_message_id = p_last_read_message_id, last_read_at = now()
  where group_id = p_group_id and user_id = p_user_id;
end; $$;

-- ============================================================
-- 7) Realtime: ערוצים לא מוכרים סגורים; לקוחות משדרים רק «מקליד» בערוץ נפרד
--    chat-group:<id>  — אירועי השרת (הודעות/חברים/קבוצה). לקוחות קוראים בלבד.
--    chat-typing:<id> — «מקליד...» בין חברי הקבוצה.
--    chat-user:<id>   — ערוץ אישי (קבלות קריאה) — קריאה בלבד.
-- ============================================================
create or replace function public.chat_rt_can_access(p_topic text)
returns boolean language sql stable security definer set search_path = '' as $$
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
    else false
  end;
$$;

drop policy if exists "chat members can broadcast typing" on realtime.messages;
create policy "chat members can broadcast typing" on realtime.messages
  for insert to authenticated
  with check (
    extension = 'broadcast'
    and (select realtime.topic()) like 'chat-typing:%'
    and public.chat_rt_can_access((select realtime.topic()))
  );

-- ============================================================
-- 8) app-media: עדכון/מחיקה רק של קבצים שהעלית
-- ============================================================
drop policy if exists "Users can delete from app-media" on storage.objects;
create policy "Users can delete from app-media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'app-media' and owner_id = (select auth.uid())::text);

drop policy if exists "Users can update in app-media" on storage.objects;
create policy "Users can update in app-media" on storage.objects
  for update to authenticated
  using (bucket_id = 'app-media' and owner_id = (select auth.uid())::text)
  with check (bucket_id = 'app-media' and owner_id = (select auth.uid())::text);

-- ============================================================
-- 9) באקט media הישן (מדיה של הצ'אט הקודם) — לא ציבורי יותר
-- ============================================================
update storage.buckets set public = false where id = 'media';

-- ============================================================
-- 10) פונקציות שלא אמורות להיות נגישות מבחוץ
-- ============================================================
-- get_message_viewers קורא מהטבלה הישנה messages ובלי בדיקת הרשאה
revoke execute on function public.get_message_viewers(uuid) from public, anon, authenticated;
-- הפעלת Edge Function עם מפתח service — רק cron
revoke execute on function public.invoke_earnings_results_notifications() from public, anon, authenticated;
-- פונקציות טריגר — אין סיבה לקרוא להן ב-RPC
revoke execute on function public.enforce_quiet_group_send() from public, anon, authenticated;
revoke execute on function public.notify_community_post_mentions() from public, anon, authenticated;
revoke execute on function public.notify_followed_congress_trade() from public, anon, authenticated;
revoke execute on function public.notify_followed_fund_13f() from public, anon, authenticated;
revoke execute on function public.notify_followed_insider_buy() from public, anon, authenticated;
revoke execute on function public.pending_notifications_respect_prefs() from public, anon, authenticated;
-- בדיקות חברות בקבוצה — לא לאורחים
revoke execute on function public.is_user_member_of_group(uuid, uuid) from anon;
revoke execute on function public.is_user_admin_of_group(uuid, uuid) from anon;

-- ============================================================
-- 11) search_path קבוע (אזהרת advisor)
-- ============================================================
alter function public.economic_display_value_for_push set search_path = public;
alter function public.economic_event_matches_alert_keys set search_path = public;
alter function public.earnings_cap_symbol set search_path = public;
alter function public.earnings_source_rank set search_path = public;
alter function public.skip_noop_update set search_path = public;

-- ============================================================
-- 12) complete_user_registration — בשימוש רק במסך בדיקה (TestRegistrationScreen), לא בהרשמה האמיתית.
--     שתי גרסאות עם אותם שמות פרמטרים (דו-משמעות ב-RPC) — חוסמים גישה מבחוץ.
-- ============================================================
revoke execute on function public.complete_user_registration(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.complete_user_registration(uuid, text, text, text, jsonb, text) from public, anon, authenticated;
