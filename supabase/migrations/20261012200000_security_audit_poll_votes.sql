-- סריקת אבטחה 2026-10-12: poll_votes — שלוש מדיניות INSERT מתירניות (OR): אחת בדקה רק user_id=אני
-- (הצבעה בכל סקר בכל קבוצה) ואחרת בדקה רק חברות (הצבעה בשם משתמש אחר). מדיניות אחת הדוקה + גארד.
-- נבדק: הצבעה בקבוצה שלי ✓; בשם אחר ✗; בקבוצה זרה ✗; שנייה בבחירה יחידה ✗; שינוי כשמותר ✓ / כשלא ✗;
--       בחירה מרובה ✓; אפשרות שלא בסקר ✗.
drop policy if exists "Users can vote on polls in channels they are members of" on public.poll_votes;
drop policy if exists "poll_votes_group_members_insert" on public.poll_votes;
drop policy if exists "poll_votes_insert_voter_is_self" on public.poll_votes;
create policy poll_votes_insert_member_self on public.poll_votes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.polls p
      where p.id = poll_votes.poll_id
        and public.is_user_member_of_group(p.chat_id, (select auth.uid()))
        and not coalesce(p.is_locked, false)
    )
  );

-- האפליקציה לא מעדכנת הצבעות (מחיקה + הוספה) — עדכון חסום (היה בלי WITH CHECK)
drop policy if exists "Users can only modify their own votes" on public.poll_votes;

create or replace function public.poll_votes_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_multi boolean; v_change boolean; v_opts jsonb;
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    select coalesce(multiple_choice, false), options into v_multi, v_opts from public.polls where id = new.poll_id;
    if jsonb_typeof(v_opts) = 'array' and not exists (
      select 1 from jsonb_array_elements(v_opts) e where e->>'id' = new.option_id::text
    ) then
      raise exception 'invalid poll option' using errcode = '42501';
    end if;
    if not v_multi and exists (
      select 1 from public.poll_votes v where v.poll_id = new.poll_id and v.user_id = new.user_id
    ) then
      raise exception 'single-choice poll: already voted' using errcode = '42501';
    end if;
    return new;
  end if;
  select coalesce(allow_vote_change, true) into v_change from public.polls where id = old.poll_id;
  if not v_change then
    raise exception 'vote change not allowed for this poll' using errcode = '42501';
  end if;
  return old;
end; $$;
revoke execute on function public.poll_votes_guard() from public, anon, authenticated;

drop trigger if exists aa_poll_votes_guard on public.poll_votes;
create trigger aa_poll_votes_guard before insert or delete on public.poll_votes
  for each row execute function public.poll_votes_guard();
