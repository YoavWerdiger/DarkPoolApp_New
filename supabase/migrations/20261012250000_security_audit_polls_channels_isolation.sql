-- polls: יצירה וקריאה לפי חברות בקבוצת הצ'אט האמיתית (chat_group_members) ולא לפי channel_members הישנה,
-- שאליה כל משתמש יכול להצטרף בעצמו → ראה סקרים של קבוצות סגורות / יצר סקר בכל קבוצה (נבדק: שניהם הותרו).
-- נבדק אחרי: סקרים של קבוצה זרה 0, יצירה בקבוצה זרה ✗; חבר קבוצה רואה סקרים והצבעות ויוצר סקר ✓.
drop policy if exists "Authenticated users can create polls" on public.polls;
drop policy if exists "Channel members can create polls" on public.polls;
drop policy if exists "polls_insert_creator_is_self" on public.polls;
drop policy if exists "Users can view polls in channels they are members of" on public.polls;
create policy polls_insert_member_self on public.polls
  for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and public.is_user_member_of_group(chat_id, (select auth.uid()))
  );

drop policy if exists "Users can view votes for polls they can see" on public.poll_votes;

-- channel_members (ישנה): מדיניות פתוחות — «הכל למחוברים» ו«הוספה לכולם». נשארות הצטרפות/עדכון/מחיקה עצמיים.
drop policy if exists "Allow all operations for authenticated users" on public.channel_members;
drop policy if exists "Allow insert to all" on public.channel_members;
drop policy if exists "Enable insert for authenticated users" on public.channel_members;
