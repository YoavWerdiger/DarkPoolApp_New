-- app_news (ריקה) ו-backgrounds (4 שורות): לא בשימוש באפליקציה/בשרת, וכל משתמש מחובר יכל לכתוב/למחוק.
-- לא מוחקים טבלאות — כתיבה רק לאדמין (service role עוקף RLS). קריאה ללא שינוי.
-- נבדק אחרי: משתמש רגיל — מחיקה 0, עדכון 0, קריאה 4/4.
drop policy if exists "Allow authenticated and service role to insert news" on public.app_news;
drop policy if exists "Allow authenticated and service role to update news" on public.app_news;
drop policy if exists "Allow authenticated and service role to delete news" on public.app_news;
create policy app_news_admin_write on public.app_news for all to authenticated
  using (public.is_app_admin((select auth.uid()))) with check (public.is_app_admin((select auth.uid())));

drop policy if exists "Authenticated users can insert backgrounds" on public.backgrounds;
drop policy if exists "Authenticated users can update backgrounds" on public.backgrounds;
drop policy if exists "Authenticated users can delete backgrounds" on public.backgrounds;
create policy backgrounds_admin_write on public.backgrounds for all to authenticated
  using (public.is_app_admin((select auth.uid()))) with check (public.is_app_admin((select auth.uid())));
