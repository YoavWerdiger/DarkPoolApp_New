-- polls: יוצר הסקר יכול לעדכן (UPDATE בלי WITH CHECK) — לא להעביר סקר לקבוצה אחרת / להחליף יוצר,
-- ומונה ההצבעות ב-options תמיד מחושב מההצבעות האמיתיות. נבדק: נעילה ✓, ספירות מזויפות 999/500 → 1/0, העברת קבוצה ✗.
create or replace function public.polls_update_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.chat_id is distinct from old.chat_id or new.creator_id is distinct from old.creator_id then
    raise exception 'poll group/creator are immutable' using errcode = '42501';
  end if;
  if new.options is distinct from old.options and jsonb_typeof(new.options) = 'array' then
    new.options := (
      select coalesce(jsonb_agg(
        e || jsonb_build_object('votes_count',
          (select count(*) from public.poll_votes v where v.poll_id = new.id and v.option_id::text = e->>'id'))
        order by ord), '[]'::jsonb)
      from jsonb_array_elements(new.options) with ordinality as t(e, ord)
    );
  end if;
  return new;
end; $$;
revoke execute on function public.polls_update_guard() from public, anon, authenticated;

drop trigger if exists aa_polls_update_guard on public.polls;
create trigger aa_polls_update_guard before update on public.polls
  for each row execute function public.polls_update_guard();
