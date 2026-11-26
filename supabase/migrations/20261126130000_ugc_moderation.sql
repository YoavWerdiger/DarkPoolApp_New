-- תוכן גולשים: דיווח, חסימה ואישור תנאי שימוש — דרישה של Apple (הנחיה 1.2) ו-Google (UGC policy).
--
-- content_reports — כל משתמש מדווח על הודעה / פוסט / תגובה / סטורי / משתמש. אדמינים רואים ומטפלים.
-- user_blocks     — חסימה: תוכן של משתמש חסום מוסתר אצל החוסם.
-- users.ugc_terms_accepted_at — אישור «אפס סובלנות» לפני הכתיבה הראשונה.

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('message', 'post', 'post_reply', 'message_comment', 'story', 'user')),
  target_id text not null,
  target_user_id uuid references public.users(id) on delete set null,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'violence', 'scam', 'other')),
  details text check (char_length(details) <= 1000),
  -- צילום התוכן בזמן הדיווח (אם יימחק לפני שאדמין רואה)
  content_snapshot text check (char_length(content_snapshot) <= 4000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  handled_by uuid references public.users(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create index if not exists content_reports_open_idx on public.content_reports (created_at desc) where status = 'open';

alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;
grant select, insert on public.content_reports to authenticated;
grant update (status, handled_by, handled_at) on public.content_reports to authenticated;

drop policy if exists "content_reports insert own" on public.content_reports;
create policy "content_reports insert own" on public.content_reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open' and handled_by is null);

drop policy if exists "content_reports read own or admin" on public.content_reports;
create policy "content_reports read own or admin" on public.content_reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or public.is_app_admin((select auth.uid())));

drop policy if exists "content_reports admin update" on public.content_reports;
create policy "content_reports admin update" on public.content_reports
  for update to authenticated
  using (public.is_app_admin((select auth.uid())))
  with check (public.is_app_admin((select auth.uid())));

-- ---------------------------------------------------------------- blocks

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

drop policy if exists "user_blocks own" on public.user_blocks;
create policy "user_blocks own" on public.user_blocks
  for all to authenticated
  using (blocker_id = (select auth.uid()))
  with check (blocker_id = (select auth.uid()));

-- ---------------------------------------------------------------- UGC terms

alter table public.users add column if not exists ugc_terms_accepted_at timestamptz;

-- דרך RPC: עמודות users נעולות לכתיבה ישירה מהלקוח
create or replace function public.accept_ugc_terms()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.users
     set ugc_terms_accepted_at = coalesce(ugc_terms_accepted_at, now())
   where id = v_uid
  returning ugc_terms_accepted_at into v_at;
  return v_at;
end;
$$;

revoke all on function public.accept_ugc_terms() from public, anon;
grant execute on function public.accept_ugc_terms() to authenticated;

notify pgrst, 'reload schema';
