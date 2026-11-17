-- באדג' על אייקון האפליקציה לכל המערכות (לא רק צ'אט):
-- badge = הודעות צ'אט שלא נקראו (chat_group_members.unread_count) + פושים אחרים שלא נראו
-- (חדשות / דוחות / יומן כלכלי / דארקפול ...). המונה מתאפס כשהמשתמש פותח את האפליקציה.

create table if not exists public.push_badge_counts (
  user_id uuid primary key references public.users(id) on delete cascade,
  unseen integer not null default 0 check (unseen >= 0),
  updated_at timestamptz not null default now()
);
alter table public.push_badge_counts enable row level security;
revoke all on public.push_badge_counts from anon, authenticated;

-- השרת: מוסיף פושים שנשלחו (bump) ומחזיר את הבאדג' המלא לכל משתמש
create or replace function public.push_badges_for(p_user_ids uuid[], p_bump integer default 0)
returns table (user_id uuid, badge integer)
language plpgsql security definer set search_path = public as $$
begin
  if p_bump > 0 then
    insert into public.push_badge_counts as b (user_id, unseen, updated_at)
    select u, p_bump, now() from unnest(p_user_ids) as u
    on conflict (user_id) do update
      set unseen = b.unseen + excluded.unseen, updated_at = now();
  end if;
  return query
    select u as user_id,
           (coalesce((select sum(greatest(m.unread_count, 0)) from public.chat_group_members m where m.user_id = u), 0)
            + coalesce((select c.unseen from public.push_badge_counts c where c.user_id = u), 0))::integer
    from unnest(p_user_ids) as u;
end; $$;
revoke execute on function public.push_badges_for(uuid[], integer) from public, anon, authenticated;
grant execute on function public.push_badges_for(uuid[], integer) to service_role;

-- האפליקציה: פתיחה = כל הפושים שאינם צ'אט נחשבים נראו
create or replace function public.reset_push_badge()
returns void
language sql security definer set search_path = public as $$
  update public.push_badge_counts set unseen = 0, updated_at = now()
  where user_id = auth.uid() and unseen <> 0;
$$;
revoke execute on function public.reset_push_badge() from public, anon;
grant execute on function public.reset_push_badge() to authenticated;
