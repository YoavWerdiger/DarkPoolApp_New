-- Voting inserts/deletes on public.poll_votes fire update_poll_vote_counts_trigger,
-- which calls trigger_update_poll_vote_counts() → update_poll_vote_counts().
--
-- 20260809023000 revoked EXECUTE on update_poll_vote_counts from authenticated
-- under the assumption that "a trigger does not consult EXECUTE privileges".
-- That is true for the trigger function itself, but NOT for routines the trigger
-- body calls with PERFORM: those are checked against the current role.
--
-- trigger_update_poll_vote_counts was SECURITY INVOKER, so authenticated needed
-- EXECUTE on update_poll_vote_counts — and after the revoke, every vote failed
-- with: permission denied for function update_poll_vote_counts.
--
-- Fix: make the trigger wrapper SECURITY DEFINER (owned by postgres) so the
-- call chain runs as the owner. Keep client EXECUTE revoked on the SECDEF
-- helper so PostgREST cannot call update_poll_vote_counts as an RPC.
-- Also handle DELETE (NEW is null) via COALESCE(NEW, OLD).

create or replace function public.trigger_update_poll_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_poll_id uuid;
begin
  target_poll_id := coalesce(new.poll_id, old.poll_id);
  if target_poll_id is not null then
    perform public.update_poll_vote_counts(target_poll_id);
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function public.trigger_update_poll_vote_counts() from public, anon, authenticated;
grant execute on function public.trigger_update_poll_vote_counts() to postgres, service_role;

-- Defensive: ensure the SECDEF helper stays off the Data API for clients.
revoke all on function public.update_poll_vote_counts(uuid) from public, anon, authenticated;
grant execute on function public.update_poll_vote_counts(uuid) to postgres, service_role;

notify pgrst, 'reload schema';
