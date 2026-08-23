-- After 20260809000000 revoked SELECT on users.subscription_role /
-- subscription_expires_at from authenticated, every learning RLS policy that
-- did EXISTS (SELECT 1 FROM users u WHERE u.subscription_role ...) started
-- failing the whole query with 42501 "permission denied for table users".
-- Measured live: SELECT courses / lessons as an authenticated probe returned
-- that error even for access='free' courses, because the paid-branch subquery
-- is still planned and needs the column privilege.
--
-- Same shape already solved for admin checks via is_app_admin() (SECURITY
-- DEFINER). Mirror it for paid learning entitlement, and route the learning
-- policies (and the broken app_news_clean admin policies) through helpers that
-- can read the private columns.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.has_paid_learning_access(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = uid
      and lower(coalesce(u.subscription_role, '')) in (
        'plus_user', 'premium_user', 'vip_user', 'admin', 'super_admin'
      )
      and (
        u.subscription_expires_at is null
        or u.subscription_expires_at > now()
      )
  );
$$;

revoke all on function public.has_paid_learning_access(uuid) from public, anon;
grant execute on function public.has_paid_learning_access(uuid) to authenticated, service_role;

comment on function public.has_paid_learning_access(uuid) is
  'True when uid has a non-expired paid/admin subscription_role. SECURITY DEFINER so RLS can gate learning content after subscription_* columns were revoked from authenticated.';

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------

-- Legacy wide-open policy: any active course visible to everyone, which also
-- forced evaluation of the paid branch (and the 42501) for authenticated.
drop policy if exists "Anyone can view courses" on public.courses;
drop policy if exists "Authenticated users can view courses" on public.courses;

create policy "Authenticated users can view courses"
  on public.courses
  for select
  to authenticated
  using (
    access = 'free'
    or public.has_paid_learning_access(auth.uid())
  );

-- ---------------------------------------------------------------------------
-- lessons
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can view lessons" on public.lessons;

create policy "Authenticated users can view lessons"
  on public.lessons
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.courses c
      where c.id = lessons.course_id
        and (
          c.access = 'free'
          or public.has_paid_learning_access(auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- lesson_media_links
-- ---------------------------------------------------------------------------

drop policy if exists "Authenticated users can view media links" on public.lesson_media_links;

create policy "Authenticated users can view media links"
  on public.lesson_media_links
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = lesson_media_links.lesson_id
        and (
          c.access = 'free'
          or public.has_paid_learning_access(auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- user_course_progress INSERT gate
-- ---------------------------------------------------------------------------

drop policy if exists "Users can insert progress" on public.user_course_progress;

create policy "Users can insert progress"
  on public.user_course_progress
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.lessons l
      join public.courses c on c.id = l.course_id
      where l.id = lesson_id
        and (
          c.access = 'free'
          or public.has_paid_learning_access(auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- app_news_clean admin writes — same column-privilege break
-- ---------------------------------------------------------------------------

drop policy if exists "Admins can insert news" on public.app_news_clean;
drop policy if exists "Admins can update news" on public.app_news_clean;
drop policy if exists "Admins can delete news" on public.app_news_clean;

create policy "Admins can insert news"
  on public.app_news_clean
  for insert
  to authenticated
  with check (public.is_app_admin(auth.uid()));

create policy "Admins can update news"
  on public.app_news_clean
  for update
  to authenticated
  using (public.is_app_admin(auth.uid()))
  with check (public.is_app_admin(auth.uid()));

create policy "Admins can delete news"
  on public.app_news_clean
  for delete
  to authenticated
  using (public.is_app_admin(auth.uid()));

notify pgrst, 'reload schema';
