-- תגובות להודעות בקבוצות הכרזות (כמו וואטסאפ): שרשור תגובות לכל הודעה, בלי להעמיס את הקבוצה עצמה.
create table if not exists public.chat_message_comments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  group_id uuid not null,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists chat_message_comments_message_idx on public.chat_message_comments (message_id, created_at);

-- מונה על ההודעה — שינוי בו משודר כבר ב-message_update של chat-group (הספירה מתעדכנת בזמן אמת)
alter table public.chat_messages add column if not exists comments_count integer not null default 0;

alter table public.chat_message_comments enable row level security;

create policy chat_message_comments_select on public.chat_message_comments for select to authenticated
  using (exists (select 1 from public.chat_group_members m where m.group_id = chat_message_comments.group_id and m.user_id = (select auth.uid())));

create policy chat_message_comments_insert on public.chat_message_comments for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.chat_group_members m where m.group_id = chat_message_comments.group_id and m.user_id = (select auth.uid()))
    and exists (select 1 from public.chat_messages cm where cm.id = chat_message_comments.message_id and cm.group_id = chat_message_comments.group_id)
  );

create policy chat_message_comments_delete on public.chat_message_comments for delete to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_app_admin((select auth.uid()))
    or exists (select 1 from public.chat_group_members m where m.group_id = chat_message_comments.group_id and m.user_id = (select auth.uid()) and m.role in ('admin', 'owner'))
  );

create or replace function public.chat_message_comments_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record; v_count int;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select count(*) into v_count from public.chat_message_comments where message_id = r.message_id;
  update public.chat_messages set comments_count = v_count where id = r.message_id;
  if tg_op = 'INSERT' then
    perform public.chat_rt_send('chat-group:' || r.group_id, 'comment_insert',
      jsonb_build_object('id', r.id, 'message_id', r.message_id, 'user_id', r.user_id, 'comments_count', v_count));
  else
    perform public.chat_rt_send('chat-group:' || r.group_id, 'comment_delete',
      jsonb_build_object('id', r.id, 'message_id', r.message_id, 'comments_count', v_count));
  end if;
  return null;
end; $$;
revoke all on function public.chat_message_comments_after() from public, anon, authenticated;

drop trigger if exists chat_message_comments_after_trg on public.chat_message_comments;
create trigger chat_message_comments_after_trg after insert or delete on public.chat_message_comments
  for each row execute function public.chat_message_comments_after();
