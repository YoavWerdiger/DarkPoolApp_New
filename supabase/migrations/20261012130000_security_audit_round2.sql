-- סריקת אבטחה 2026-10-12 — סבב 2 (הוחל בשרת דרך MCP, כל תיקון נבדק בסימולציה)

-- 1) portfolio_transactions: עדכון לא יכול להעביר תנועה לתיק של משתמש אחר
drop policy if exists portfolio_tx_owner_update on public.portfolio_transactions;
create policy portfolio_tx_owner_update on public.portfolio_transactions
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.portfolios p where p.id = portfolio_transactions.portfolio_id and p.user_id = auth.uid())
  );

-- 2) chat_pinned_messages: נעיצה רק של הודעה מאותה קבוצה (לא לקרוא הודעות של קבוצה זרה)
drop policy if exists "Admins can pin messages" on public.chat_pinned_messages;
create policy "Admins can pin messages" on public.chat_pinned_messages
  for insert
  with check (
    exists (select 1 from public.chat_group_members m
            where m.group_id = chat_pinned_messages.group_id
              and m.user_id = (select auth.uid()) and m.role = 'admin')
    and exists (select 1 from public.chat_messages cm
                where cm.id = chat_pinned_messages.message_id
                  and cm.group_id = chat_pinned_messages.group_id)
  );

-- 3) משתמש מושתק/מושעה לא שולח הודעות (גם בכתיבה ישירה למסד)
create or replace function public.chat_messages_sender_status_guard()
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

drop trigger if exists aa_chat_messages_sender_status on public.chat_messages;
create trigger aa_chat_messages_sender_status before insert on public.chat_messages
  for each row execute function public.chat_messages_sender_status_guard();
