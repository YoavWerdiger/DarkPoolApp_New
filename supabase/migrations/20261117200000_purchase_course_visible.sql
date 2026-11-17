-- Purchase courses (access = 'purchase') must be visible to every signed-in
-- user: the course card and the lesson list show, the videos stay locked
-- (lesson_media_links uses has_course_access).

drop policy if exists "Authenticated users can view courses"
  on public.courses;
create policy "Authenticated users can view courses"
  on public.courses for select to authenticated
  using (
    access = 'free'
    or access = 'purchase'
    or public.has_paid_learning_access(auth.uid())
  );

drop policy if exists "Authenticated users can view lessons"
  on public.lessons;
create policy "Authenticated users can view lessons"
  on public.lessons for select to authenticated
  using (
    exists (
      select 1 from public.courses c
      where c.id = lessons.course_id
        and (
          c.access = 'free'
          or c.access = 'purchase'
          or public.has_paid_learning_access(auth.uid())
        )
    )
  );
