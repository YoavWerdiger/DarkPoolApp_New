-- Apply on the linked Supabase project if migrations are not auto-applied.
-- Same fix as supabase/migrations/20260814131514_fix_poll_vote_counts_trigger_permissions.sql
--
-- Root cause: trigger_update_poll_vote_counts was SECURITY INVOKER and PERFORM'd
-- update_poll_vote_counts after authenticated EXECUTE was revoked → vote inserts fail.

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

revoke all on function public.update_poll_vote_counts(uuid) from public, anon, authenticated;
grant execute on function public.update_poll_vote_counts(uuid) to postgres, service_role;

notify pgrst, 'reload schema';
