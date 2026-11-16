-- סקר נעול (is_locked) נעול גם למחיקת הצבעה — לא רק להוספה.
-- עד עכשיו מצביע יכול היה למחוק את ההצבעה שלו מסקר נעול ולשנות את התוצאה הסופית.
-- מחיקת הסקר עצמו (cascade) לא נחסמת: בזמן ה-cascade שורת הסקר כבר לא נמצאת.

create or replace function public.poll_votes_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_multi boolean; v_change boolean; v_locked boolean; v_opts jsonb;
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
  select coalesce(allow_vote_change, true), coalesce(is_locked, false)
    into v_change, v_locked
    from public.polls where id = old.poll_id;
  if coalesce(v_locked, false) then
    raise exception 'poll is locked' using errcode = '42501';
  end if;
  if not v_change then
    raise exception 'vote change not allowed for this poll' using errcode = '42501';
  end if;
  return old;
end; $$;
revoke execute on function public.poll_votes_guard() from public, anon, authenticated;
