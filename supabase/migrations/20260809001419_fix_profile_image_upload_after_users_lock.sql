-- Profile image upload hardening after public.users column locks.
--
-- 1) The AFTER UPDATE trigger on public.users that denormalises profile fields
--    into channel_members.user_data ran as the invoking role. If channel_members
--    grants/RLS are tightened later, a legitimate profile_picture UPDATE can
--    fail with 42501 even though users column grants allow the write. Run it as
--    SECURITY DEFINER so profile edits stay independent of channel_members ACL.
--
-- 2) app-media is what mediaService / EditProfile / news / group avatars use.
--    Dedicated bucket policies with an explicit WITH CHECK keep uploads working
--    if the legacy wide-open storage policies are ever removed. Does not widen
--    admin/subscription privileges on public.users.

-- ---------------------------------------------------------------------------
-- 1. channel_members denormalisation trigger
-- ---------------------------------------------------------------------------

create or replace function public.update_channel_member_user_data()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    update public.channel_members
       set user_data = jsonb_build_object(
         'full_name', new.full_name,
         'profile_picture', new.profile_picture,
         'phone', new.phone,
         'display_name', new.display_name,
         'email', new.email
       )
     where user_id = new.id;
  end if;

  return new;
end;
$$;

comment on function public.update_channel_member_user_data() is
  'Keeps channel_members.user_data in sync with public.users. SECURITY DEFINER so own-row profile edits cannot fail on channel_members ACL.';

-- ---------------------------------------------------------------------------
-- 2. app-media storage policies (idempotent)
-- ---------------------------------------------------------------------------

drop policy if exists "Users can upload to app-media" on storage.objects;
drop policy if exists "Users can read from app-media" on storage.objects;
drop policy if exists "Users can delete from app-media" on storage.objects;
drop policy if exists "Users can update in app-media" on storage.objects;
drop policy if exists "Public read app-media" on storage.objects;

create policy "Users can upload to app-media"
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'app-media');

create policy "Users can read from app-media"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'app-media');

create policy "Public read app-media"
  on storage.objects
  for select
  to public
  using (bucket_id = 'app-media');

create policy "Users can update in app-media"
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'app-media')
  with check (bucket_id = 'app-media');

create policy "Users can delete from app-media"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'app-media');
