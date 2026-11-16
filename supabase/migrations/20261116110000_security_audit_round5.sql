-- סבב אבטחה 5 — תיקונים לממצאים שאומתו מול המסד החי (2026-11-16).

------------------------------------------------------------------------------
-- 1) Storage: הסרת policies פתוחות שביטלו כל הגבלה על קבצים
--    "Allow everything for everyone" (ALL, true, כולל anon) ו-"Allow all operations for authenticated users"
--    אפשרו לכל מחזיק מפתח ציבורי לקרוא/לכתוב/למחוק כל קובץ בכל bucket — כולל chat-media ו-course-media.
--    שלוש ה-policies הישנות של chat-media אפשרו לכל משתמש מחובר להעלות/לדרוס/למחוק כל קובץ שם.
------------------------------------------------------------------------------
drop policy if exists "Allow everything for everyone" on storage.objects;
drop policy if exists "Allow all operations for authenticated users" on storage.objects;
drop policy if exists "Users can upload to chat-media" on storage.objects;
drop policy if exists "Users can update in chat-media" on storage.objects;
drop policy if exists "Users can delete from chat-media" on storage.objects;

-- סטוריז: chat-media/stories/<user_id>/... — כל משתמש מחובר רואה (כמו user_stories_select), רק הבעלים מעלה
drop policy if exists "Stories: authenticated read" on storage.objects;
create policy "Stories: authenticated read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and (storage.foldername(name))[1] = 'stories');

drop policy if exists "Stories: owner upload" on storage.objects;
create policy "Stories: owner upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = 'stories'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- מחיקת מדיה של הקבוצה ע"י אדמין הקבוצה (מחיקה לכולם); הבעלים כבר מכוסה ב-"Users can delete own media"
drop policy if exists "Group admins can delete media" on storage.objects;
create policy "Group admins can delete media" on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1 from public.chat_group_members m
      where m.group_id = ((storage.foldername(name))[1])::uuid
        and m.user_id = (select auth.uid())
        and m.role in ('admin', 'owner')
    )
  );

-- אדמין אפליקציה מנהל את כל ה-buckets (קורסים, רקעים, תמונות קבוצה) — במקום ה-policy הפתוחה
drop policy if exists "App admins manage storage" on storage.objects;
create policy "App admins manage storage" on storage.objects for all to authenticated
  using (public.is_app_admin((select auth.uid())))
  with check (public.is_app_admin((select auth.uid())));

------------------------------------------------------------------------------
-- 2) חדשות: anon לא מוסיף/משנה/מוחק חדשות (הוספה מפעילה פוש לכל המשתמשים)
--    אדמין מוסיף דרך "Admins can insert news" (authenticated).
------------------------------------------------------------------------------
drop policy if exists app_news_clean_anon_insert on public.app_news_clean;
revoke insert, update, delete, truncate on public.app_news_clean from anon;

------------------------------------------------------------------------------
-- 3) ברוקר: קישור broker_accounts ↔ portfolios רק בין שורות של אותו משתמש
--    (אחרת פונקציות ה-service של הברוקר כותבות/מוחקות בתיק של מישהו אחר)
------------------------------------------------------------------------------
create or replace function public.broker_accounts_portfolio_owner_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.portfolio_id is not null and not exists (
    select 1 from public.portfolios p where p.id = new.portfolio_id and p.user_id = new.user_id
  ) then
    raise exception 'portfolio does not belong to broker account owner' using errcode = '42501';
  end if;
  return new;
end; $$;
revoke execute on function public.broker_accounts_portfolio_owner_guard() from public, anon, authenticated;

drop trigger if exists aa_broker_accounts_portfolio_owner on public.broker_accounts;
create trigger aa_broker_accounts_portfolio_owner before insert or update of portfolio_id, user_id on public.broker_accounts
  for each row execute function public.broker_accounts_portfolio_owner_guard();

create or replace function public.portfolios_broker_owner_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.broker_account_id is not null and not exists (
    select 1 from public.broker_accounts ba where ba.id = new.broker_account_id and ba.user_id = new.user_id
  ) then
    raise exception 'broker account does not belong to portfolio owner' using errcode = '42501';
  end if;
  return new;
end; $$;
revoke execute on function public.portfolios_broker_owner_guard() from public, anon, authenticated;

drop trigger if exists aa_portfolios_broker_owner on public.portfolios;
create trigger aa_portfolios_broker_owner before insert or update of broker_account_id, user_id on public.portfolios
  for each row execute function public.portfolios_broker_owner_guard();

------------------------------------------------------------------------------
-- 4) חברות/אדמין בקבוצה: לא מחזירים תשובה על משתמש אחר למי שלא חבר בקבוצה
--    (policies קוראות עם auth.uid() עצמו — לא מושפעות)
------------------------------------------------------------------------------
create or replace function public.is_user_member_of_group(p_group_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null
      or p_user_id = auth.uid()
      or exists (select 1 from public.chat_group_members c where c.group_id = p_group_id and c.user_id = auth.uid())
    then exists (select 1 from public.chat_group_members m where m.group_id = p_group_id and m.user_id = p_user_id)
    else false
  end;
$$;

create or replace function public.is_user_admin_of_group(p_group_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null
      or p_user_id = auth.uid()
      or exists (select 1 from public.chat_group_members c where c.group_id = p_group_id and c.user_id = auth.uid())
    then exists (
      select 1 from public.chat_group_members m
      where m.group_id = p_group_id and m.user_id = p_user_id and m.role = 'admin'
    )
    else false
  end;
$$;

------------------------------------------------------------------------------
-- 5) הודעות צ'אט שנכתבות ישירות (לא דרך chat-send-message)
--    INSERT: created_at ומונים נקבעים בשרת; הודעת מערכת — הצטרפות/עזיבה של עצמך, או אדמין הקבוצה
--    UPDATE: עריכת תוכן עד 48 שעות (כמו באפליקציה), סימון "נערך" בשרת, אין שחזור הודעה שנמחקה
------------------------------------------------------------------------------
create or replace function public.chat_messages_insert_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  new.created_at := now();
  new.comments_count := 0;
  new.read_by_count := 0;
  new.reactions_count := 0;
  new.is_edited := false;
  new.edited_at := null;
  new.is_deleted := false;
  new.deleted_at := null;
  new.deleted_for_everyone := false;
  if coalesce(new.is_system_message, false) or new.message_type = 'system' then
    new.is_system_message := true;
    if not (
      (new.system_message_type in ('user_joined', 'user_left') and new.sender_id = auth.uid())
      or exists (
        select 1 from public.chat_group_members m
        where m.group_id = new.group_id and m.user_id = auth.uid() and m.role in ('admin', 'owner')
      )
    ) then
      raise exception 'system messages are admin-only' using errcode = '42501';
    end if;
  end if;
  return new;
end; $$;
revoke execute on function public.chat_messages_insert_guard() from public, anon, authenticated;

drop trigger if exists aa_chat_messages_insert_guard on public.chat_messages;
create trigger aa_chat_messages_insert_guard before insert on public.chat_messages
  for each row execute function public.chat_messages_insert_guard();

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
  -- אין שחזור של הודעה שנמחקה
  if (coalesce(old.is_deleted, false) and not coalesce(new.is_deleted, false))
     or (coalesce(old.deleted_for_everyone, false) and not coalesce(new.deleted_for_everyone, false)) then
    raise exception 'deleted messages cannot be restored' using errcode = '42501';
  end if;
  -- עריכת תוכן (לא מחיקה): עד 48 שעות, ותמיד מסומנת "נערך"
  if new.content is not null and new.content is distinct from old.content
     and not coalesce(new.is_deleted, false) then
    if old.created_at < now() - interval '48 hours' then
      raise exception 'edit window expired' using errcode = '42501';
    end if;
    new.is_edited := true;
    new.edited_at := now();
  end if;
  return new;
end; $$;
revoke execute on function public.chat_messages_update_guard() from public, anon, authenticated;
