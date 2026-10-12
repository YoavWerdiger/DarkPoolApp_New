-- channels (טבלת ערוצים ישנה, משמשת לסקרים): כל משתמש מחובר יכל לעדכן כל ערוץ (נבדק: 9/9). האפליקציה לא מעדכנת — רק היוצר.
-- נבדק אחרי: ערוצים זרים לעדכון 0, קריאה 9/9 ללא שינוי.
drop policy if exists "Enable update for authenticated users" on public.channels;
create policy channels_update_creator on public.channels
  for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
