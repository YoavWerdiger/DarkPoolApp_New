-- רכישת קורס בודד (קורס הלוויתנים) דרך CardCom — גישה רק אחרי אישור שרת.
--
-- access = 'purchase': הקורס והשיעורים מוצגים לכולם (דף מכירה + רשימת שיעורים נעולה),
-- אבל הסרטונים (lesson_media_links) נפתחים רק למי שיש לו שורה ב-course_purchases
-- (נכתבת רק ע"י rapid-responder אחרי GetLpResult + בדיקת סכום) או לאדמין.

create table if not exists public.course_purchases (
  user_id uuid not null references public.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  transaction_id text references public.payment_transactions(id) on delete set null,
  amount integer,
  granted_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
alter table public.course_purchases enable row level security;
revoke all on public.course_purchases from anon, authenticated;
grant select on public.course_purchases to authenticated;

drop policy if exists "course_purchases read own" on public.course_purchases;
create policy "course_purchases read own" on public.course_purchases
  for select to authenticated using (user_id = auth.uid());

-- גישה לתוכן קורס: חינם / מנוי בתשלום (הקיים) / רכישה בודדת
create or replace function public.has_course_access(p_course_id text, uid uuid default auth.uid())
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is not null and uid is distinct from auth.uid() then false
    else coalesce((
      select case
        when c.access = 'free' then true
        when c.access = 'purchase' then
          public.is_app_admin(uid)
          or exists (select 1 from public.course_purchases p where p.user_id = uid and p.course_id = c.id)
        else public.has_paid_learning_access(uid)
      end
      from public.courses c where c.id = p_course_id
    ), false)
  end;
$$;
revoke execute on function public.has_course_access(text, uuid) from public, anon;
grant execute on function public.has_course_access(text, uuid) to authenticated, service_role;

-- הסרטונים: רק עם גישה לקורס
drop policy if exists "Authenticated users can view media links" on public.lesson_media_links;
create policy "Authenticated users can view media links" on public.lesson_media_links
  for select to authenticated using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_media_links.lesson_id
        and public.has_course_access(l.course_id)
    )
  );

-- ערך גישה חדש: purchase (בנוסף ל-free / paid / members_only)
alter table public.courses drop constraint if exists courses_access_check;
alter table public.courses add constraint courses_access_check
  check (access = any (array['free'::text, 'paid'::text, 'members_only'::text, 'purchase'::text]));

-- קורס הלוויתנים: רכישה בודדת, ₪531
update public.courses
   set access = 'purchase', price = 531
 where id = 'whales-course-1';
